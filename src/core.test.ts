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
  const rootRelativeSourcesPath = path.relative(hre.config.paths.root, hre.config.paths.sources);
  const sourcesPathPrefix = path.normalize(rootRelativeSourcesPath + '/');
  const include = (sourceName: string) => sourceName.startsWith(sourcesPathPrefix);

  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, 'utf8'));
  const config = { paths: hre.config.paths, exposed: { ...baseConfig, initializers: false } };
  const exposed = getExposed(bi.output, include, config);
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

test('snapshot imports', async t => {
  const rootRelativeSourcesPath = path.relative(hre.config.paths.root, hre.config.paths.sources);
  const sourcesPathPrefix = path.normalize(rootRelativeSourcesPath + '/');

  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, 'utf8'));
  const config = { paths: hre.config.paths, exposed: { ...baseConfig, initializers: false, imports: true } };
  const exposed = getExposed(bi.output, sourceName => sourceName === 'contracts/Imported.sol', config);
  const exposedFiles = [...exposed.values()].sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))
  for (const rf of exposedFiles) { 
    const absolutePath = path.relative(process.cwd(), rf.absolutePath);
    const { rawContent } = rf.content;
    t.snapshot({ absolutePath, rawContent });
  }
});
