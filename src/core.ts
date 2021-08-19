import hre from 'hardhat';
import path  from 'path';
import 'array.prototype.flatmap/auto';

import { SourceUnit, ContractDefinition, FunctionDefinition, VariableDeclaration, StorageLocation } from 'solidity-ast';
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

export function getExposed(solcOutput: SolcOutput, isUserFile: (sourceName: string) => boolean): Map<string, ResolvedFile> {
  const res = new Map<string, ResolvedFile>();
  const contractMap = mapContracts(solcOutput);

  for (const { ast } of Object.values(solcOutput.sources)) {
    if (!isUserFile(ast.absolutePath)) {
      continue;
    }
    const destPath = path.join(exposedPath, path.relative(rootRelativeSourcesPath, ast.absolutePath));
    res.set(destPath, getExposedFile(destPath, ast, contractMap));
  }

  return res;
}

function getExposedFile(absolutePath: string, ast: SourceUnit, contractMap: ContractMap): ResolvedFile {
  const sourceName = path.relative(rootPath, absolutePath);

  const inputPath = path.relative(path.dirname(absolutePath), ast.absolutePath).replace(/\\/g, '/');
  const content: FileContent = {
    rawContent: getExposedContent(ast, inputPath, contractMap),
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

function getExposedContent(ast: SourceUnit, inputPath: string, contractMap: ContractMap): string {
  return formatLines(
    ...spaceBetween(
      ['// SPDX-License-Identifier: UNLICENSED'],
      [`pragma solidity ${exposedVersionPragma};`],
      [`import "${inputPath}";`],

      ...Array.from(findAll('ContractDefinition', ast), c => {
        const isLibrary = c.contractKind === 'library';
        const contractHeader = [`contract X${c.name}`];
        if (!areFunctionsFullyImplemented(c, contractMap)) {
          contractHeader.unshift('abstract');
        }
        if (!isLibrary) {
          contractHeader.push(`is ${c.name}`);
        }
        contractHeader.push('{');
        return [
          contractHeader.join(' '),
          spaceBetween(
            makeConstructor(c, contractMap),
            ...getInternalFunctions(c, contractMap).filter(isExternalizable).map(fn => {
              const args = getFunctionArguments(fn);
              const header = [
                'function',
                `x${fn.name}(${args.map(a => `${a.type} ${a.name}`)})`,
                'external',
              ];
              if (fn.stateMutability !== 'nonpayable') {
                header.push(fn.stateMutability);
              }
              if (fn.returnParameters.parameters.length > 0) {
                header.push(`returns (${fn.returnParameters.parameters.map(p => getType(p, 'memory')).join(', ')})`);
              }
              header.push('{');
              return [
                header.join(' '), [
                  `return ${isLibrary ? c.name : 'super'}.${fn.name}(${args.map(a => a.name)});`
                ], `}`,
              ];
            }),
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
    for (const f of findAll('FunctionDefinition', p)) {
      for (const b of f.baseFunctions ?? []) {
        abstractFunctionIds.delete(b);
      }
    }
  }
  return abstractFunctionIds.size === 0;
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
      const type = getType(a, 'memory');
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
  return fnDef.kind !== 'constructor' && fnDef.implemented && fnDef.parameters.parameters.every(p => p.storageLocation !== 'storage');
}

interface Argument {
  type: string;
  name: string;
}

function getFunctionArguments(fnDef: FunctionDefinition): Argument[] {
  return fnDef.parameters.parameters.map((p, i) => {
    const type = getType(p, 'calldata');
    const name = p.name || `arg${i}`;
    return { type, name };
  });
}

function getType(varDecl: VariableDeclaration, location: StorageLocation = varDecl.storageLocation): string {
  const { typeString, typeIdentifier } = varDecl.typeDescriptions;
  if (typeof typeString !== 'string' || typeof typeIdentifier !== 'string') {
    throw new Error('Missing type information');
  }
  const type = typeString.replace(/^(struct|enum|contract) /, '') + (typeIdentifier.endsWith('_ptr') ? ` ${location}` : '');
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

function getInternalFunctions(contract: ContractDefinition, contractMap: ContractMap): FunctionDefinition[] {
  const parents = contract.linearizedBaseContracts.map(id => mustGet(contractMap, id));

  const overriden = new Set<number>();
  const res = [];

  for (const parent of parents) {
    for (const fn of findAll('FunctionDefinition', parent)) {
      if (fn.visibility === 'internal' && !overriden.has(fn.id)) {
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
