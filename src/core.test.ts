import test from 'ava';
import hre from 'hardhat';
import path from 'path';
import { promises as fs } from 'fs';
import { BuildInfo } from 'hardhat/types';
import { getExposed, exposedPath } from './core';

const rootRelativeExposedPath = path.relative(hre.config.paths.root, exposedPath);

test('snapshot', async t => {
  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, 'utf8'));
  const exposed = getExposed(bi.output, sourceName => !sourceName.startsWith(rootRelativeExposedPath));
  const exposedFiles = [...exposed.values()].sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))
  for (const rf of exposedFiles) { 
    t.snapshot(rf.content.rawContent);
  }
});

test('constructor structs', async t => {
  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, 'utf8'));
  const exposed = getExposed(bi.output, sourceName => sourceName === 'contracts/Inheritance.sol', undefined, true);
  const exposedFiles = [...exposed.values()].sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))
  for (const rf of exposedFiles) {
    t.snapshot(rf.content.rawContent);
  }
});
