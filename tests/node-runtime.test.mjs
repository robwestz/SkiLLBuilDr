import { test } from "node:test";
import assert from "node:assert/strict";

import {
  nodeRuntimeCandidates,
  parseNodeCommand,
  resolveNodeRuntime,
  runPortableNodeCommand,
  splitCommand,
} from "../.agents/node-runtime.mjs";

test("splitCommand handles simple quoting", () => {
  assert.deepEqual(splitCommand('node -e "console.log(1)"'), ["node", "-e", "console.log(1)"]);
  assert.deepEqual(splitCommand("'node' --test tests/foo.test.mjs"), ["node", "--test", "tests/foo.test.mjs"]);
});

test("parseNodeCommand accepts portable node commands", () => {
  assert.deepEqual(parseNodeCommand("node --test tests/foo.test.mjs"), {
    requested: "node",
    args: ["--test", "tests/foo.test.mjs"],
  });
  assert.equal(parseNodeCommand("echo node --test"), null);
});

test("nodeRuntimeCandidates honors explicit env override first", () => {
  const candidates = nodeRuntimeCandidates({
    env: { COMPOUND_NODE: "/opt/node/bin/node" },
    execPath: "/usr/bin/node",
    platform: "linux",
  });
  assert.equal(candidates[0].source, "COMPOUND_NODE");
  assert.equal(candidates[0].executable, "/opt/node/bin/node");
});

test("resolveNodeRuntime can resolve the current test runtime", () => {
  const runtime = resolveNodeRuntime({
    env: { ...process.env, COMPOUND_NODE: process.execPath },
    execPath: process.execPath,
    platform: process.platform,
  });
  assert.equal(runtime.executable, process.execPath);
  assert.match(runtime.version, /^v\d+\./);
});

test("runPortableNodeCommand executes node commands through the resolver", () => {
  const result = runPortableNodeCommand('node -e "console.log(40 + 2)"', {
    env: { ...process.env, COMPOUND_NODE: process.execPath },
    cwd: process.cwd(),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "42");
  assert.equal(result.portableNodeRuntime.executable, process.execPath);
});
