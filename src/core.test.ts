import test from 'ava';
import hre from 'hardhat';
import path from 'path';
import { promises as fs } from 'fs';
import { BuildInfo } from 'hardhat/types';
import { getExposed, getExposedPath } from './core';

const baseConfig = {
  exclude: [],
  include: [],
  outDir: 'contracts-exposed',
};

test('snapshot', async t => {
  const exposedPath = getExposedPath(hre.config);
  const rootRelativeExposedPath = path.relative(hre.config.paths.root, exposedPath);

  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, 'utf8'));
  const exposed = getExposed(bi.output, sourceName => !sourceName.startsWith(rootRelativeExposedPath), hre.config);
  const exposedFiles = [...exposed.values()].sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))
  for (const rf of exposedFiles) { 
    t.snapshot(rf.content.rawContent);
  }
});

test('snapshot initializers', async t => {
  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, 'utf8'));
  const config = { paths: hre.config.paths, exposed: { ...baseConfig, initializers: true } };
  const exposed = getExposed(bi.output, sourceName => sourceName === 'contracts/Initializers.sol', config);
  const exposedFiles = [...exposed.values()].sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))
  for (const rf of exposedFiles) {
    t.snapshot(rf.content.rawContent);
  }
});
