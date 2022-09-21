import hre from 'hardhat';
import path from 'path';
import 'array.prototype.flatmap/auto';

import { Visibility, SourceUnit, ContractDefinition, FunctionDefinition, VariableDeclaration, StorageLocation, TypeDescriptions, TypeName } from 'solidity-ast';
import { findAll } from 'solidity-ast/utils';
import { formatLines, spaceBetween } from './utils/format-lines';
import { FileContent, ResolvedFile } from 'hardhat/types';

export interface SolcOutput {
  sources: {
    [file in string]: {
      ast: SourceUnit;
      id: number;
    };
  };
}

const rootPath = hre.config.paths.root;
const sourcesPath = hre.config.paths.sources;
const rootRelativeSourcesPath = path.relative(rootPath, sourcesPath);
export const exposedPath = path.join(rootPath, 'contracts-exposed');
const exposedVersionPragma = '>=0.6.0';
const defaultPrefix = '$';

export function getExposed(solcOutput: SolcOutput, include: (sourceName: string) => boolean, prefix?: string): Map<string, ResolvedFile> {
  const res = new Map<string, ResolvedFile>();
  const contractMap = mapContracts(solcOutput);

  for (const { ast } of Object.values(solcOutput.sources)) {
    if (!include(ast.absolutePath)) {
      continue;
    }
    const destPath = path.join(exposedPath, path.relative(rootRelativeSourcesPath, ast.absolutePath));
    res.set(destPath, getExposedFile(destPath, ast, contractMap, prefix));
  }

  return res;
}

function getExposedFile(absolutePath: string, ast: SourceUnit, contractMap: ContractMap, prefix?: string): ResolvedFile {
  const sourceName = path.relative(rootPath, absolutePath);

  const inputPath = path.relative(path.dirname(absolutePath), ast.absolutePath).replace(/\\/g, '/');
  const content: FileContent = {
    rawContent: getExposedContent(ast, inputPath, contractMap, prefix),
    imports: [inputPath],
    versionPragmas: [exposedVersionPragma],
  };

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

function getExposedContent(ast: SourceUnit, inputPath: string, contractMap: ContractMap, prefix = defaultPrefix): string {
  if (prefix === '' || /^\d|[^0-9a-z_$]/i.test(prefix)) {
    throw new Error(`Prefix '${prefix}' is not valid`);
  }

  const contractPrefix = prefix.replace(/^./, c => c.toUpperCase());

  return formatLines(
    ...spaceBetween(
      ['// SPDX-License-Identifier: UNLICENSED'],
      [`pragma solidity ${exposedVersionPragma};`],
      [`import "${inputPath}";`],

      ...Array.from(findAll('ContractDefinition', ast), c => {
        const isLibrary = c.contractKind === 'library';
        const contractHeader = [`contract ${contractPrefix}${c.name}`];
        if (!areFunctionsFullyImplemented(c, contractMap)) {
          contractHeader.unshift('abstract');
        }
        if (!isLibrary) {
          contractHeader.push(`is ${c.name}`);
        }
        contractHeader.push('{');

        const hasReceiveFunction = getFunctions(c, contractMap, [ 'external' ]).some(fn => fn.kind === 'receive');
        const externalizableFunctions = getFunctions(c, contractMap, !isLibrary && [ 'internal' ]).filter(isExternalizable);
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
              return [
                `event ${prefix}${evName}_Returned(${fn.returnParameters.parameters.map((p, i) => getVarType(p, null) + ` arg${i}`).join(', ')});`
              ]
            }),
            // constructor
            makeConstructor(c, contractMap),
            // accessor to internal variables
            ...getInternalVariables(c, contractMap).map(v => [
              [
                'function',
                `${prefix}${v.name}(${getVarGetterArgs(v).map(a => `${a.type} ${a.name}`).join(', ')})`,
                'external',
                v.mutability === 'mutable' || (v.mutability === 'immutable' && !v.value) ? 'view' : 'pure',
                'returns',
                `(${getVarGetterReturnType(v)})`,
                '{'
              ].join(' '),
              [
                `return ${v.name}${getVarGetterArgs(v).map(a => `[${a.name}]`).join('')};`,
              ],
              '}',
            ]),
            // external functions
            ...externalizableFunctions.map(fn => {
              const fnName = clashingFunctions[getFunctionId(fn)] === 1 ? fn.name : getFunctionNameQualified(fn);
              const fnArgs = getFunctionArguments(fn);
              const evName = isNonViewWithReturns(fn) && (clashingEvents[fn.name] === 1 ? fn.name : getFunctionNameQualified(fn, false));

              // function header
              const header = [
                'function',
                `${prefix}${fnName}(${fnArgs.map(a => `${a.type} ${a.name}`)})`,
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
                header.push(`returns (${fn.returnParameters.parameters.map(p => getVarType(p, 'memory')).join(', ')})`);
              }
              header.push('{');
              // function body
              const body = evName ? [
                `(${fn.returnParameters.parameters.map((p, i) => getVarType(p, 'memory') + ` ret${i}`).join(', ')}) = ` +
                `${isLibrary ? c.name : 'super'}.${fn.name}(${fnArgs.map(a => a.storageVar ? `${prefix}${a.storageVar}[${a.name}]` : a.name)});`,
                `emit ${prefix}${evName}_Returned(${fn.returnParameters.parameters.map((p, i) => `ret${i}`).join(', ')});`,
                `return (${fn.returnParameters.parameters.map((p, i) => `ret${i}`).join(', ')});`,
              ] : [
                `return ${isLibrary ? c.name : 'super'}.${fn.name}(${fnArgs.map(a => a.storageVar ? `${prefix}${a.storageVar}[${a.name}]` : a.name)});`,
              ];
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
}

// Note this is not the same as contract.fullyImplemented, because this does
// not consider missing constructor calls. We don't use contract.abstract
// because even if a user declares a contract abstract, we want to make it
// concrete if it is possible.
function areFunctionsFullyImplemented(contract: ContractDefinition, contractMap: ContractMap): boolean {
  const parents = contract.linearizedBaseContracts.map(id => mustGet(contractMap, id));
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

function makeConstructor(contract: ContractDefinition, contractMap: ContractMap): string[] {
  const parents = contract.linearizedBaseContracts.map(id => mustGet(contractMap, id)).reverse();
  const parentsWithConstructor = parents.filter(c => getConstructor(c)?.parameters.parameters.length);
  const initializedParentIds = new Set(parents.flatMap(p => [
    ...p.baseContracts.filter(c => c.arguments?.length).map(c => c.id),
    ...getConstructor(p)?.modifiers.map(m => m.modifierName.referencedDeclaration).filter(notNull) ?? [],
  ]));
  const uninitializedParents = parentsWithConstructor.filter(c => !initializedParentIds.has(c.id));

  const missingArguments = new Map<string, string>(); // name -> type
  const parentArguments = new Map<string, string[]>();

  for (const c of uninitializedParents) {
    const args = [];
    for (const a of getConstructor(c)!.parameters.parameters) {
      const name = missingArguments.has(a.name) ? `${c.name}_${a.name}` : a.name;
      const type = getVarType(a, 'memory');
      missingArguments.set(name, type);
      args.push(name);
    }
    parentArguments.set(c.name, args);
  }
  return [
    [
      `constructor(${[...missingArguments].map(([name, type]) => `${type} ${name}`).join(', ')})`,
      ...uninitializedParents.map(p => `${p.name}(${mustGet(parentArguments, p.name).join(', ')})`),
      '{}'
    ].join(' '),
  ];
}

function getConstructor(contract: ContractDefinition): FunctionDefinition | undefined {
  for (const fnDef of findAll('FunctionDefinition', contract)) {
    if (fnDef.kind === 'constructor') {
      return fnDef;
    }
  }
}

function notNull<T>(value: T): value is NonNullable<T> {
  return value != undefined;
}

function isExternalizable(fnDef: FunctionDefinition): boolean {
  return fnDef.kind !== 'constructor'
    && fnDef.visibility !== 'private'
    && fnDef.implemented
    && !fnDef.parameters.parameters.some(p => p.typeName?.nodeType === 'FunctionTypeName')
    && !fnDef.returnParameters.parameters.some(p => p.typeName?.nodeType === 'Mapping' || p.typeName?.nodeType === 'FunctionTypeName');
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

type ContractMap = Map<number, ContractDefinition>;

function mapContracts(solcOutput: SolcOutput): ContractMap {
  const res: ContractMap = new Map();

  for (const { ast } of Object.values(solcOutput.sources)) {
    for (const contract of findAll('ContractDefinition', ast)) {
      res.set(contract.id, contract);
    }
  }

  return res;
}

function getInternalVariables(contract: ContractDefinition, contractMap: ContractMap): VariableDeclaration[] {
  const parents = contract.linearizedBaseContracts.map(id => mustGet(contractMap, id));

  const res = [];

  for (const parent of parents) {
    for (const v of findAll('VariableDeclaration', parent)) {
      if (v.stateVariable && v.visibility === 'internal') {
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

function getFunctions(contract: ContractDefinition, contractMap: ContractMap, subset: Visibility[] | false = false): FunctionDefinition[] {
  const parents = contract.linearizedBaseContracts.map(id => mustGet(contractMap, id));

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
