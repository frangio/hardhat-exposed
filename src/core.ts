import path from 'path';

import { findAll, astDereferencer, ASTDereferencer } from 'solidity-ast/utils';
import { formatLines, Lines, spaceBetween } from './utils/format-lines';
import type { Visibility, SourceUnit, ContractDefinition, FunctionDefinition, VariableDeclaration, StorageLocation, TypeDescriptions, TypeName, InheritanceSpecifier, ModifierInvocation, FunctionCall } from 'solidity-ast';
import type { FileContent, ProjectPathsConfig, ResolvedFile } from 'hardhat/types';
import type { ExposedConfig } from './config';

export interface SolcOutput {
  sources: {
    [file in string]: {
      ast: SourceUnit;
      id: number;
    };
  };
}

const exposedVersionPragma = '>=0.6.0';
const defaultPrefix = '$';

interface Config {
  paths: ProjectPathsConfig,
  exposed: ExposedConfig,
}

export const getExposedPath = (config: Config) => path.join(config.paths.root, config.exposed.outDir);

export function getExposed(
  solcOutput: SolcOutput,
  include: (sourceName: string) => boolean,
  config: Config,
): Map<string, ResolvedFile> {
  const rootPath = config.paths.root;
  const sourcesPath = config.paths.sources;
  const rootRelativeSourcesPath = path.relative(rootPath, sourcesPath);
  const exposedPath = getExposedPath(config);

  const res = new Map<string, ResolvedFile>();
  const deref = astDereferencer(solcOutput);

  for (const { ast } of Object.values(solcOutput.sources)) {
    if (!include(ast.absolutePath)) {
      continue;
    }
    const destPath = path.join(exposedPath, path.relative(rootRelativeSourcesPath, ast.absolutePath));
    res.set(destPath, getExposedFile(rootPath, destPath, ast, deref, config.exposed.initializers, config.exposed.prefix));
  }

  return res;
}

function getExposedFile(rootPath: string, absolutePath: string, ast: SourceUnit, deref: ASTDereferencer, initializers?: boolean, prefix?: string): ResolvedFile {
  const sourceName = path.relative(rootPath, absolutePath);

  const relativizePath = (p: string) => path.relative(path.dirname(absolutePath), p).replace(/\\/g, '/');
  const content = getExposedContent(ast, relativizePath, deref, initializers, prefix);
  const contentHash = createNonCryptographicHashBasedIdentifier(Buffer.from(content.rawContent)).toString('hex');

  return {
    absolutePath,
    sourceName,
    content,
    contentHash,
    lastModificationDate: new Date(),
    getVersionedName: () => sourceName,
  };
}

function getExposedContent(ast: SourceUnit, relativizePath: (p: string) => string, deref: ASTDereferencer, initializers = false, prefix = defaultPrefix): FileContent {
  if (prefix === '' || /^\d|[^0-9a-z_$]/i.test(prefix)) {
    throw new Error(`Prefix '${prefix}' is not valid`);
  }

  const contractPrefix = prefix.replace(/^./, c => c.toUpperCase());
  const imports = [ast.absolutePath].concat(
    [...findAll('ImportDirective', ast)]
      .filter(i => i.symbolAliases.length > 0)
      .map(i => i.absolutePath),
  ).map(relativizePath);

  const rawContent = formatLines(
    ...spaceBetween(
      ['// SPDX-License-Identifier: UNLICENSED'],
      [`pragma solidity ${exposedVersionPragma};`],
      imports.map(i => `import "${i}";`),

      ...Array.from(findAll('ContractDefinition', ast), c => {
        const isLibrary = c.contractKind === 'library';
        const contractHeader = [`contract ${contractPrefix}${c.name}`];
        if (!areFunctionsFullyImplemented(c, deref)) {
          contractHeader.unshift('abstract');
        }
        if (!isLibrary) {
          contractHeader.push(`is ${c.name}`);
        }
        contractHeader.push('{');

        const subset: Visibility[] = isLibrary ? [ 'internal', 'public', 'external' ] : ['internal'];

        const hasReceiveFunction = getFunctions(c, deref, [ 'external' ]).some(fn => fn.kind === 'receive');
        const externalizableVariables = getVariables(c, deref, subset).filter(v => v.typeName?.nodeType !== 'UserDefinedTypeName' || isTypeExternalizable(v.typeName, deref));
        const externalizableFunctions = getFunctions(c, deref, subset).filter(f => isExternalizable(f, deref));
        const returnedEventFunctions = externalizableFunctions.filter(fn => isNonViewWithReturns(fn));

        const clashingFunctions: Record<string, number> = {};
        for (const fn of externalizableFunctions) {
          const id = getFunctionId(fn);
          clashingFunctions[id] ??= 0;
          clashingFunctions[id] += 1;
        }

        const clashingEvents: Record<string, number> = {};
        for (const fn of returnedEventFunctions) {
          clashingEvents[fn.name] ??= 0;
          clashingEvents[fn.name] += 1;
        }

        return [
          contractHeader.join(' '),
          [`bytes32 public __hh_exposed_bytecode_marker = "hardhat-exposed";\n`],
          spaceBetween(
            // slots for storage function parameters
            ...getAllStorageArguments(externalizableFunctions).map(a => [
              `mapping(uint256 => ${a.storageType}) internal ${prefix}${a.storageVar};`,
            ]),
            // events for internal returns
            ...returnedEventFunctions.map(fn => {
              const evName = clashingEvents[fn.name] === 1 ? fn.name : getFunctionNameQualified(fn, false);
              const params = getFunctionReturnParameters(fn, null);
              return [
                `event return${prefix}${evName}(${params.map(printArgument).join(', ')});`
              ]
            }),
            // constructor
            makeConstructor(c, deref, initializers),
            // accessor to internal variables
            ...externalizableVariables.map(v => [
              [
                'function',
                `${prefix}${v.name}(${getVarGetterArgs(v).map(printArgument).join(', ')})`,
                'external',
                v.mutability === 'mutable' || (v.mutability === 'immutable' && !v.value) ? 'view' : 'pure',
                'returns',
                `(${getVarGetterReturnType(v)})`,
                '{'
              ].join(' '),
              [
                `return ${isLibrary ? c.name + '.' : ''}${v.name}${getVarGetterArgs(v).map(a => `[${a.name}]`).join('')};`,
              ],
              '}',
            ]),
            // external functions
            ...externalizableFunctions.map(fn => {
              const fnName = clashingFunctions[getFunctionId(fn)] === 1 ? fn.name : getFunctionNameQualified(fn);
              const fnArgs = getFunctionArguments(fn);
              const fnRets = getFunctionReturnParameters(fn);
              const evName = isNonViewWithReturns(fn) && (clashingEvents[fn.name] === 1 ? fn.name : getFunctionNameQualified(fn, false));

              // function header
              const header = [
                'function',
                `${prefix}${fnName}(${fnArgs.map(printArgument)})`,
                'external',
              ];

              if (fn.stateMutability !== 'nonpayable') {
                if (fn.stateMutability === 'pure' && fnArgs.some(a => a.storageVar)) {
                  header.push('view');
                } else {
                  header.push(fn.stateMutability);
                }
              } else if (isLibrary) {
                header.push('payable');
              }

              if (fn.returnParameters.parameters.length > 0) {
                header.push(`returns (${fnRets.map(printArgument).join(', ')})`);
              }

              header.push('{');

              // function body
              const body = [
                (fnRets.length === 0 ? '' : `(${fnRets.map(p => p.name).join(', ')}) = `) +
                `${isLibrary ? c.name : 'super'}.${fn.name}(${fnArgs.map(a => a.storageVar ? `${prefix}${a.storageVar}[${a.name}]` : a.name)});`,
              ];

              if (evName) {
                body.push(
                  `emit return${prefix}${evName}(${fnRets.map(p => p.name).join(', ')});`,
                );
              }

              // return function
              return [ header.join(' '), body, `}` ];
            }),
            // receive function
            !hasReceiveFunction ? [ 'receive() external payable {}' ]: [],
          ),
          `}`,
        ]
      }),
    )
  )

  return {
    rawContent,
    imports,
    versionPragmas: [exposedVersionPragma],
  };
}

// Note this is not the same as contract.fullyImplemented, because this does
// not consider missing constructor calls. We don't use contract.abstract
// because even if a user declares a contract abstract, we want to make it
// concrete if it is possible.
function areFunctionsFullyImplemented(contract: ContractDefinition, deref: ASTDereferencer): boolean {
  const parents = contract.linearizedBaseContracts.map(deref('ContractDefinition'));
  const abstractFunctionIds = new Set(parents.flatMap(p => [...findAll('FunctionDefinition', p)].filter(f => !f.implemented).map(f => f.id)));
  for (const p of parents) {
    for (const f of findAll(['FunctionDefinition', 'VariableDeclaration'], p)) {
      for (const b of f.baseFunctions ?? []) {
        abstractFunctionIds.delete(b);
      }
    }
  }
  return abstractFunctionIds.size === 0;
}

function getFunctionId(fn: FunctionDefinition): string {
  const storageArgs = new Set<Argument>(getStorageArguments(fn));
  const nonStorageArgs = getFunctionArguments(fn).filter(a => !storageArgs.has(a));
  return fn.name + nonStorageArgs.map(a => a.type).join('');
}

function getFunctionNameQualified(fn: FunctionDefinition, onlyStorage: boolean = true): string {
  return fn.name + (onlyStorage ? getStorageArguments(fn) : getFunctionArguments(fn))
    .map(arg => arg.storageType ?? arg.type)
    .map(type => type.replace(/ .*/,'').replace(/[^0-9a-zA-Z$_]+/g, '_')) // sanitize
    .join('_')
    .replace(/^./, '_$&');
}

function makeConstructor(contract: ContractDefinition, deref: ASTDereferencer, initializers: boolean): Lines[] {
  const parents = contract.linearizedBaseContracts.map(deref('ContractDefinition')).reverse();

  const constructors = new Map(parents.map(p => getConstructor(p, initializers)).filter(notNull).map(c => [c.scope, c]));

  const initializedParents = new Set<number>();

  for (const p of parents) {
    for (const c of p.baseContracts) {
      if (c.arguments?.length) {
        initializedParents.add(c.baseName.referencedDeclaration);
      }
    }

    const ctor = constructors.get(p.id);

    if (ctor) {
      if (ctor.kind === 'constructor') {
        for (const m of ctor.modifiers) {
          if (m.modifierName.referencedDeclaration != undefined) {
            initializedParents.add(m.modifierName.referencedDeclaration);
          }
        }
      }

      if (initializers) {
        for (const fnCall of findAll('FunctionCall', ctor)) {
          if (fnCall.expression.nodeType === 'Identifier' && isInitializerName(fnCall.expression.name, 'unchained')) {
            const fnDef = deref('FunctionDefinition', fnCall.expression.referencedDeclaration!);
            if (fnDef.scope !== p.id) {
              initializedParents.add(fnDef.scope);
            }
          }
        }
      }
    }
  }

  const uninitializedParents = parents.filter(c => c.contractKind === 'contract' && constructors.has(c.id) && !initializedParents.has(c.id));

  const missingArguments = new Map<string, string>(); // name -> type
  const parentArguments = new Map<string, string[]>();

  for (const c of uninitializedParents) {
    const args = [];
    for (const a of constructors.get(c.id)?.parameters.parameters ?? []) {
      const name = missingArguments.has(a.name) ? `${c.name}_${a.name}` : a.name;
      const type = getVarType(a, 'memory');
      missingArguments.set(name, type);
      args.push(name);
    }
    parentArguments.set(c.name, args);
  }

  const parentConstructorCalls = [];
  const parentInitializerCalls = [];

  for (const p of uninitializedParents) {
    const ctor = constructors.get(p.id);
    if (ctor) {
      const params = mustGet(parentArguments, p.name).join(', ');
      if (ctor.kind === 'constructor') {
        if (ctor.parameters.parameters.length) {
          parentConstructorCalls.push(`${p.name}(${params})`);
        }
      } else {
        parentInitializerCalls.push(`${ctor.name}(${params})`);
      }
    }
  }

  return [
    [
      `constructor(${[...missingArguments].map(([name, type]) => `${type} ${name}`).join(', ')})`,
      ...parentConstructorCalls,
      ...(parentInitializerCalls.length ? ['initializer'] : []),
      '{',
    ].join(' '),
    parentInitializerCalls.map(e => `${e};`),
    '}',
  ];
}

function getConstructor(contract: ContractDefinition, initializers: boolean): FunctionDefinition | undefined {
  let ctor;
  let init;

  for (const fnDef of findAll('FunctionDefinition', contract)) {
    if (fnDef.kind === 'constructor') {
      ctor = fnDef;
      if (!initializers) break;
    }
    if (initializers && isInitializerName(fnDef.name)) {
      init = fnDef;
      if (ctor) break;
    }
  }
  return init || ctor;
}

function isInitializerName(fnName: string, kind?: 'unchained'): boolean {
  if (kind === 'unchained') {
    return /^__[a-zA-Z0-9$_]+_init_unchained$/.test(fnName);
  } else {
    return /^__[a-zA-Z0-9$_]+_init$/.test(fnName);
  }
}

function notNull<T>(value: T): value is NonNullable<T> {
  return value != undefined;
}

function isExternalizable(fnDef: FunctionDefinition, deref: ASTDereferencer): boolean {
  return fnDef.kind !== 'constructor'
    && fnDef.visibility !== 'private'
    && fnDef.implemented
    && !fnDef.parameters.parameters.some(p => p.typeName?.nodeType === 'FunctionTypeName')
    && fnDef.returnParameters.parameters.every(p => isTypeExternalizable(p.typeName, deref));
}

function isTypeExternalizable(typeName: TypeName | null | undefined, deref: ASTDereferencer): boolean {
  if (typeName == undefined) {
    return true;
  } if (typeName.nodeType === 'UserDefinedTypeName') {
    const typeDef = deref(['StructDefinition', 'EnumDefinition', 'ContractDefinition', 'UserDefinedValueTypeDefinition'], typeName.referencedDeclaration);
    if (typeDef.nodeType !== 'StructDefinition') {
      return true;
    } else {
      return typeDef.members.every(m => isTypeExternalizable(m.typeName, deref));
    }
  } else {
    return typeName.nodeType !== 'Mapping' && typeName.nodeType !== 'FunctionTypeName';
  }
}

function isNonViewWithReturns(fnDef: FunctionDefinition): boolean {
  return [ 'payable', 'nonpayable' ].includes(fnDef.stateMutability) && fnDef.returnParameters.parameters.length > 0
}

interface Argument {
  type: string;
  name: string;
  storageVar?: string;
  storageType?: string;
}

const printArgument = (arg: Argument) => `${arg.type} ${arg.name}`;

function getFunctionArguments(fnDef: FunctionDefinition): Argument[] {
  return fnDef.parameters.parameters.map((p, i) => {
    const name = p.name || `arg${i}`;
    if (p.storageLocation === 'storage') {
      const storageType = getVarType(p, null);
      const storageVar = 'v_' + storageType.replace(/[^0-9a-zA-Z$_]+/g, '_');
      // The argument is an index to an array in storage.
      return { name, type: 'uint256', storageVar, storageType };
    } else {
      const type = getVarType(p, 'calldata');
      return { name, type };
    }
  });
}

function getStorageArguments(fn: FunctionDefinition): Required<Argument>[] {
  return getFunctionArguments(fn)
    .filter((a): a is Required<Argument> => !!(a.storageVar && a.storageType));
}

function getAllStorageArguments(fns: FunctionDefinition[]): Required<Argument>[] {
  return [
    ...new Map(
      fns.flatMap(getStorageArguments).map(a => [a.storageVar, a]),
    ).values(),
  ];
}

function getFunctionReturnParameters(fnDef: FunctionDefinition, location: StorageLocation | null = 'memory'): Argument[] {
  return fnDef.returnParameters.parameters.map((p, i) => {
    const name = p.name || `ret${i}`;
    const type = getVarType(p, location);
    return { name, type };
  });
}

function getVarType(varDecl: VariableDeclaration, location: StorageLocation | null = varDecl.storageLocation): string {
  if (!varDecl.typeName) {
    throw new Error('Missing type information');
  }
  return getType(varDecl.typeName, location);
}

function getType(typeName: TypeName, location: StorageLocation | null): string {
  const { typeString, typeIdentifier } = typeName.typeDescriptions;
  if (typeof typeString !== 'string' || typeof typeIdentifier !== 'string') {
    throw new Error('Missing type information');
  }
  const type = typeString.replace(/^(struct|enum|contract) /, '') + (typeIdentifier.endsWith('_ptr') && location ? ` ${location}` : '');
  return type;
}

function getVariables(contract: ContractDefinition, deref: ASTDereferencer, subset?: Visibility[]): VariableDeclaration[] {
  const parents = contract.linearizedBaseContracts.map(deref('ContractDefinition'));

  const res = [];

  for (const parent of parents) {
    for (const v of findAll('VariableDeclaration', parent)) {
      if (v.stateVariable && (!subset || subset.includes(v.visibility))) {
        res.push(v);
      }
    }
  }

  return res;
}

function getVarGetterArgs(v: VariableDeclaration): Argument[] {
  if (!v.typeName) {
    throw new Error('missing typenName');
  }
  const types = [];
  for (let t = v.typeName; t.nodeType === 'Mapping'; t = t.valueType) {
    types.push({ name: `arg${types.length}`, type: getType(t.keyType, 'memory') })
  }
  return types;
}

function getVarGetterReturnType(v: VariableDeclaration): string {
  if (!v.typeName) {
    throw new Error('missing typenName');
  }
  let t = v.typeName;
  while (t.nodeType === 'Mapping') {
    t = t.valueType;
  }
  return getType(t, 'memory');
}

function getFunctions(contract: ContractDefinition, deref: ASTDereferencer, subset?: Visibility[]): FunctionDefinition[] {
  const parents = contract.linearizedBaseContracts.map(deref('ContractDefinition'));

  const overriden = new Set<number>();
  const res = [];

  for (const parent of parents) {
    for (const fn of findAll('FunctionDefinition', parent)) {
      if (!overriden.has(fn.id) && (!subset || subset.includes(fn.visibility))) {
        res.push(fn);
      }
      for (const b of fn.baseFunctions ?? []) {
        overriden.add(b);
      }
    }
  }

  return res;
}

function mustGet<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error('Key not found');
  }
  return value;
}

function createNonCryptographicHashBasedIdentifier(input: Buffer): Buffer {
  const { createHash } = require("crypto") as typeof import('crypto');
  return createHash("md5").update(input).digest();
}
