import hre from 'hardhat';
import path from 'path';

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

  const inputPath = path.relative(path.dirname(absolutePath), ast.absolutePath);
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

      ...Array.from(findAll('ContractDefinition', ast), c => [
        `contract X${c.name} is ${c.name} {`,
        spaceBetween(
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
                `return super.${fn.name}(${args.map(a => a.name)});`
              ], `}`,
            ];
          }),
        ),
        `}`,
      ]),
    )
  )
}

interface Argument {
  type: string;
  name: string;
}

function isExternalizable(fnDef: FunctionDefinition): boolean {
  return fnDef.parameters.parameters.every(p => p.storageLocation !== 'storage');
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
  const type = typeString.replace(/^struct /, '') + (typeIdentifier.endsWith('_ptr') ? ` ${location}` : '');
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

  const res = [];

  for (const parent of parents) {
    for (const fn of findAll('FunctionDefinition', parent)) {
      if (fn.visibility === 'internal') {
        res.push(fn);
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
