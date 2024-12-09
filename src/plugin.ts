import { extendConfig, task } from 'hardhat/config';
import {
  TASK_COMPILE_SOLIDITY,
  TASK_COMPILE_SOLIDITY_COMPILE,
  TASK_COMPILE_SOLIDITY_COMPILE_JOB,
  TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT,
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  TASK_CLEAN,
} from 'hardhat/builtin-tasks/task-names';
import type { CompilationJob, CompilerInput, CompilerOutput, HardhatConfig, HardhatRuntimeEnvironment, SolcBuild } from 'hardhat/types';

import type {} from './type-extensions';

extendConfig((config, { exposed: userConfig }) => {
  config.exposed = {
    ...userConfig,
    exclude: userConfig?.exclude ?? [],
    include: userConfig?.include ?? ['**/*'],
    outDir: userConfig?.outDir ?? "contracts-exposed",
  };
});

task(TASK_CLEAN, async (opts: { global: boolean }, hre, superCall) => {
  if (!opts.global) {
    await cleanExposed(hre);
  }
  return superCall();
});

task(TASK_COMPILE_SOLIDITY, async ({ force }: { force: boolean }, hre, superCall) => {
  if (force) {
    await cleanExposed(hre);
  }
  return superCall();
});

task(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS, async (_, hre, superCall: () => Promise<string[]>) => {
  const path = await import('path');
  const { getExposedPath } = await import('./core');
  const exposedPath = getExposedPath(hre.config);
  const paths = await superCall();
  return paths.filter(p => !p.startsWith(exposedPath + path.sep));
});

interface CompileJobArgs {
  compilationJob: CompilationJob;
  compilationJobs: CompilationJob[];
  compilationJobIndex: number;
  quiet: boolean;
  emitsArtifacts: boolean;
}

interface CompileReturn {
  output: CompilerOutput & { errors?: { severity: string }[] };
  solcBuild: SolcBuild;
}

task<CompileJobArgs>(TASK_COMPILE_SOLIDITY_COMPILE_JOB, async (args, hre, superCall) => {
  let { compilationJob } = args;

  let input: CompilerInput = await hre.run( TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT, { compilationJob });

  // Improves performance a little by not requesting bytecode or optimizations.
  input = {
    ...input,
    settings: {
      ...input.settings,
      optimizer: { enabled: false },
      outputSelection: { '*': { '': ['ast'] } },
    },
  };

  const { output }: CompileReturn = await hre.run(TASK_COMPILE_SOLIDITY_COMPILE, {
    solcVersion: compilationJob.getSolcConfig().version,
    input,
    ...args,
  });

  if (!output.errors?.some(e => e.severity === 'error')) {
    const exposedJob = await getExposedJob(hre, compilationJob, output);
    await writeExposed(exposedJob);
    compilationJob = compilationJob.merge(exposedJob);
  }

  return superCall({ ...args, compilationJob });
});

async function getExposedJob(hre: HardhatRuntimeEnvironment, compilationJob: CompilationJob, output: CompilerOutput): Promise<CompilationJob> {
  const { getExposed } = await import('./core');

  const include = await getMatcher(hre.config);
  const exposed = getExposed(output, include, hre.config);

  const cj: CompilationJob = {
    getResolvedFiles: () => [...exposed.values()],
    emitsArtifacts: file => exposed.has(file.absolutePath),
    getSolcConfig: () => compilationJob.getSolcConfig(),
    hasSolc9573Bug: () => compilationJob.hasSolc9573Bug(),
    merge: other => other.merge(cj),
  };

  return cj;
}

async function writeExposed(exposedJob: CompilationJob) {
  const path = await import('path');
  const { promises: fs } = await import('fs');

  for (const file of exposedJob.getResolvedFiles()) {
    await fs.mkdir(path.dirname(file.absolutePath), { recursive: true });
    await fs.writeFile(file.absolutePath, file.content.rawContent);
  }
}

async function cleanExposed(hre: HardhatRuntimeEnvironment) {
  const fs = await import('fs/promises');
  const { getExposedPath } = await import('./core');

  const exposedPath = getExposedPath(hre.config);
  await fs.rm(exposedPath, { recursive: true, force: true });
}

async function getMatcher(config: HardhatConfig) {
  const { isMatch } = await import('micromatch');
  const path = await import('path');

  const sourcesDir = path.relative(config.paths.root, config.paths.sources);
  const includePatterns = config.exposed.include;
  const excludePatterns = config.exposed.exclude;

  return function (sourceName: string) {
    if (!sourceName.startsWith(sourcesDir)) {
      return false;
    }
    sourceName = path.relative(sourcesDir, sourceName);
    return (
      includePatterns.some(p => isMatch(sourceName, p)) &&
      !excludePatterns.some(p => isMatch(sourceName, p))
    );
  };
}
