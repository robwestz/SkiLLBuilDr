import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist", "skill-browser.html");
const DIST_PLAYGROUND = join(ROOT, "dist", "playground.html");

before(() => {
  const r = spawnSync(process.execPath, [join(ROOT, "bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
  if (r.status !== 0) {
    throw new Error("bundle.mjs failed: " + (r.stderr || r.stdout || "").toString());
  }
});

test("bundle: file exists and is non-trivial", () => {
  assert.ok(existsSync(DIST), "dist/skill-browser.html must exist");
  const content = readFileSync(DIST, "utf8");
  assert.ok(content.length > 100_000, `bundle too small (${content.length} bytes)`);
});

test("bundle: playground bundle exists and includes inlined data", () => {
  assert.ok(existsSync(DIST_PLAYGROUND), "dist/playground.html must exist");
  const content = readFileSync(DIST_PLAYGROUND, "utf8");
  assert.ok(content.includes("window.__ECC_DATA__"), "playground bundle must inline __ECC_DATA__");
  assert.ok(!/<script[^>]+src=["']data\.js["']/i.test(content), "playground bundle must not depend on external data.js");
});

test("bundle: is self-contained (no external script src refs)", () => {
  const content = readFileSync(DIST, "utf8");
  assert.ok(!/<script[^>]+src=/.test(content), "bundle must not reference external scripts");
});

test("bundle: inlines data and recipes", () => {
  const content = readFileSync(DIST, "utf8");
  assert.ok(content.includes("window.__ECC_DATA__"), "must inline __ECC_DATA__");
  assert.ok(content.includes("window.__ECC_RECIPES__"), "must inline __ECC_RECIPES__");
});

test("bundle: escapes literal closing script tags inside inlined payloads", () => {
  const content = readFileSync(DIST, "utf8");
  const match = content.match(
    /<script>\s*(window\.__ECC_DATA__\s*=\s*[\s\S]*?)\s*<\/script>\s*<script>\s*window\.__ECC_RECIPES__/i
  );
  assert.ok(match, "must inline data script immediately before recipes script");
  assert.ok(match[1].includes("<\\/script>"), "inlined payloads must escape literal </script> sequences");
  assert.ok(!/<\/script>/i.test(match[1]), "raw </script> must not appear inside the inlined data payload");
});

test("bundle: inlines hash-router", () => {
  const content = readFileSync(DIST, "utf8");
  assert.ok(content.includes("HashRouter"), "must inline hash-router (window.HashRouter)");
  assert.ok(content.includes("parseHash"), "must inline parseHash function");
  assert.ok(content.includes("buildHash"), "must inline buildHash function");
});

test("bundle: inlines analytics module", () => {
  const content = readFileSync(DIST, "utf8");
  assert.ok(content.includes("window.Analytics"), "must inline analytics (window.Analytics)");
  assert.ok(content.includes("skill-browser"), "must include $lib identifier");
});

test("bundle: includes UI primitives", () => {
  const content = readFileSync(DIST, "utf8");
  assert.ok(content.includes("Welcome to Skill Browser"), "must include welcome overlay");
  assert.ok(content.includes("Keyboard shortcuts"), "must include help modal");
  assert.ok(content.includes("themeToggle"), "must include theme toggle");
  assert.ok(content.includes("btnExportRecipes"), "must include export button");
  assert.ok(content.includes("btnCopyLink"), "must include share-link button");
});

test("bundle: recipe count matches recipes.json", () => {
  const content = readFileSync(DIST, "utf8");
  const match = content.match(/window\.__ECC_RECIPES__\s*=\s*(\{.+?\});/s);
  assert.ok(match, "recipes payload must be inlined");
  const ids = match[1].match(/"id"\s*:\s*"[^"]+"/g) || [];
  const source = JSON.parse(readFileSync(join(ROOT, "recipes.json"), "utf8"));
  assert.equal(ids.length, source.recipes.length, "inlined recipe count must match source");
});
