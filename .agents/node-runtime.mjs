#!/usr/bin/env node
// Portable Node runtime selection for Compound DoD checks.
// Keeps ledger commands portable while allowing host-specific fallbacks locally.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SMOKE_ARGS = [
  "-e",
  "require('node:crypto').randomBytes(1); process.stdout.write(process.version)",
];

function uniqCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    if (!candidate.executable) continue;
    const key = String(candidate.executable).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function windowsFallbacks(env) {
  const paths = [];
  if (env.ProgramFiles) paths.push(join(env.ProgramFiles, "heroku", "client", "bin", "node.exe"));
  if (env.LOCALAPPDATA) paths.push(join(env.LOCALAPPDATA, "Programs", "nodejs", "node.exe"));
  if (env.ProgramFiles) paths.push(join(env.ProgramFiles, "nodejs", "node.exe"));
  if (env["ProgramFiles(x86)"]) paths.push(join(env["ProgramFiles(x86)"], "nodejs", "node.exe"));
  return paths.filter((p) => existsSync(p));
}

export function nodeRuntimeCandidates({
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
} = {}) {
  const candidates = [];
  for (const key of ["COMPOUND_NODE", "BUILD_NODE", "NODE_RUNTIME"]) {
    if (env[key]) candidates.push({ executable: env[key], source: key });
  }
  if (platform === "win32") {
    for (const executable of windowsFallbacks(env)) {
      candidates.push({ executable, source: "windows-fallback" });
    }
  }
  if (execPath) candidates.push({ executable: execPath, source: "process.execPath" });
  candidates.push({ executable: "node", source: "PATH" });
  return uniqCandidates(candidates);
}

export function smokeNodeRuntime(executable, { cwd = process.cwd(), env = process.env, timeoutMs = 5000 } = {}) {
  const result = spawnSync(executable, SMOKE_ARGS, {
    cwd,
    env,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    error: result.error,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export function resolveNodeRuntime(options = {}) {
  const failures = [];
  for (const candidate of nodeRuntimeCandidates(options)) {
    const smoke = smokeNodeRuntime(candidate.executable, options);
    if (smoke.ok) {
      return {
        executable: candidate.executable,
        source: candidate.source,
        version: smoke.stdout.trim(),
      };
    }
    failures.push({
      executable: candidate.executable,
      source: candidate.source,
      status: smoke.status,
      signal: smoke.signal,
      error: smoke.error?.message,
      stderr: smoke.stderr.trim().split("\n").slice(-2).join("\n"),
    });
  }
  const detail = failures.map((f) => `${f.source}:${f.executable}`).join(", ");
  throw new Error(`No usable Node runtime found. Tried: ${detail}`);
}

export function splitCommand(command) {
  const text = String(command || "").trim();
  const parts = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

export function parseNodeCommand(command) {
  const parts = splitCommand(command);
  if (!parts.length) return null;
  const exeName = parts[0].split(/[\\/]/).pop().toLowerCase();
  if (parts[0].toLowerCase() !== "node" && exeName !== "node" && exeName !== "node.exe") return null;
  return { requested: parts[0], args: parts.slice(1) };
}

export function runPortableNodeCommand(command, options = {}) {
  const parsed = parseNodeCommand(command);
  if (!parsed) return null;
  const runtime = resolveNodeRuntime(options);
  const result = spawnSync(runtime.executable, parsed.args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: "utf-8",
    stdio: "pipe",
  });
  result.portableNodeRuntime = runtime;
  return result;
}

function main() {
  const runtime = resolveNodeRuntime();
  const result = spawnSync(runtime.executable, process.argv.slice(2), {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
