#!/usr/bin/env node
// Cross-platform launcher: rebuild catalog then open index.html in the default browser.
// Used as the npm bin entry for `skill-browser`.

import { spawnSync, exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const invokDir = process.cwd();

const buildArgs = ["build.mjs"];
if (existsSync(join(invokDir, ".claude")) && invokDir !== __dirname) {
  buildArgs.push("--project", invokDir);
}

const result = spawnSync(process.execPath, buildArgs, { cwd: __dirname, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

const target = join(__dirname, "index.html");

if (platform === "win32") {
  exec(`start "" "${target}"`);
} else if (platform === "darwin") {
  exec(`open "${target}"`);
} else {
  exec(`xdg-open "${target}"`);
}

console.log(`Opened: ${target}`);
