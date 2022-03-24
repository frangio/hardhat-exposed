import test from "ava";
import { promises as fs } from "fs";
import hre from "hardhat";
import { BuildInfo } from "hardhat/types";
import path from "path";
import { exposedPath, getExposed } from "./core";

const rootRelativeExposedPath = path.relative(
  hre.config.paths.root,
  exposedPath
);

test("snapshot", async (t) => {
  const [bip] = await hre.artifacts.getBuildInfoPaths();
  const bi: BuildInfo = JSON.parse(await fs.readFile(bip!, "utf8"));
  const exposed = getExposed(
    bi.output,
    (sourceName) => !sourceName.startsWith(rootRelativeExposedPath),
    []
  );
  const exposedFiles = [...exposed.values()].sort((a, b) =>
    a.absolutePath.localeCompare(b.absolutePath)
  );
  for (const rf of exposedFiles) {
    t.snapshot(rf.content.rawContent);
  }
});
