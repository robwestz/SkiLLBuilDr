#!/usr/bin/env node
// Produces a self-contained dist/skill-browser.html by:
//   1. running build.mjs (forwarding any CLI args) to refresh data.js + recipes.js
//   2. reading index.html + the freshly generated data.js + recipes.js
//   3. replacing the two external <script src="..."></script> tags with inline <script>...</script>
//   4. writing the merged HTML to dist/skill-browser.html (no external deps, double-click openable)
//
// Usage:
//   node bundle.mjs
//   node bundle.mjs --project /path/to/repo
//
// Zero npm deps. Pure Node ESM: node:fs, node:path, node:child_process.

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function run() {
  // ---- 1. rebuild data ----
  const forwardedArgs = process.argv.slice(2);
  console.log(`[bundle] running build.mjs ${forwardedArgs.join(" ")}`.trim());
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "build.mjs"), ...forwardedArgs],
    { cwd: __dirname, stdio: "inherit" }
  );
  if (result.status !== 0) {
    console.error(`[bundle] build.mjs exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }

  // ---- 2. read inputs ----
  const indexPath = join(__dirname, "index.html");
  const analyticsPath = join(__dirname, "analytics.js");
  const routerPath = join(__dirname, "hash-router.js");
  const dataPath = join(__dirname, "data.js");
  const recipesPath = join(__dirname, "recipes.js");

  const indexHtml = readFileSync(indexPath, "utf8");
  const analyticsJs = readFileSync(analyticsPath, "utf8");
  const routerJs = readFileSync(routerPath, "utf8");
  const dataJs = readFileSync(dataPath, "utf8");
  const recipesJs = readFileSync(recipesPath, "utf8");

  // ---- 3. splice inline <script> blocks ----
  // Escape any literal "</script>" inside the JS so the browser doesn't end our inline tag early.
  // Done via replace, case-insensitive, only if the substring actually appears.
  function escapeScriptClose(src) {
    if (!/<\/script>/i.test(src)) return src;
    return src.replace(/<\/script>/gi, "</scr" + "ipt>");
  }

  const inlineAnalytics = `<script>\n${escapeScriptClose(analyticsJs)}\n</script>`;
  const inlineRouter = `<script>\n${escapeScriptClose(routerJs)}\n</script>`;
  const inlineData = `<script>\n${escapeScriptClose(dataJs)}\n</script>`;
  const inlineRecipes = `<script>\n${escapeScriptClose(recipesJs)}\n</script>`;

  // Tolerate single/double quotes and extra whitespace on the src= tags.
  const analyticsTagRe = /<script\s+src\s*=\s*["']analytics\.js["']\s*>\s*<\/script>/i;
  const routerTagRe = /<script\s+src\s*=\s*["']hash-router\.js["']\s*>\s*<\/script>/i;
  const dataTagRe = /<script\s+src\s*=\s*["']data\.js["']\s*>\s*<\/script>/i;
  const recipesTagRe = /<script\s+src\s*=\s*["']recipes\.js["']\s*>\s*<\/script>/i;

  if (!analyticsTagRe.test(indexHtml)) {
    console.error(`[bundle] could not find <script src="analytics.js"></script> in index.html`);
    process.exit(1);
  }
  if (!routerTagRe.test(indexHtml)) {
    console.error(`[bundle] could not find <script src="hash-router.js"></script> in index.html`);
    process.exit(1);
  }
  if (!dataTagRe.test(indexHtml)) {
    console.error(`[bundle] could not find <script src="data.js"></script> in index.html`);
    process.exit(1);
  }
  if (!recipesTagRe.test(indexHtml)) {
    console.error(`[bundle] could not find <script src="recipes.js"></script> in index.html`);
    process.exit(1);
  }

  let merged = indexHtml.replace(analyticsTagRe, () => inlineAnalytics);
  merged = merged.replace(routerTagRe, () => inlineRouter);
  merged = merged.replace(dataTagRe, () => inlineData);
  merged = merged.replace(recipesTagRe, () => inlineRecipes);

  // ---- 4. write output ----
  const distDir = join(__dirname, "dist");
  mkdirSync(distDir, { recursive: true });
  const outPath = join(distDir, "skill-browser.html");
  writeFileSync(outPath, merged, "utf8");

  // Copy playground.html to dist — standalone, no inlining needed
  const playgroundSrc = join(__dirname, "playground.html");
  const playgroundDst = join(distDir, "playground.html");
  writeFileSync(playgroundDst, readFileSync(playgroundSrc, "utf8"), "utf8");

  // ---- 5. log size + item count ----
  const { size } = statSync(outPath);
  const itemCount = extractItemCount(dataJs);

  const sizeKb = (size / 1024).toFixed(1);
  const sizeMb = (size / (1024 * 1024)).toFixed(2);
  console.log(
    `[bundle] wrote ${outPath}  ` +
      `(${size.toLocaleString()} bytes / ${sizeKb} KB / ${sizeMb} MB)  ` +
      `items=${itemCount}`
  );
}

function extractItemCount(dataJs) {
  // data.js is a single assignment:  window.__ECC_DATA__ = { ... };
  // We pull the JSON payload and read counts.total without evaling code.
  const eq = dataJs.indexOf("=");
  if (eq < 0) return "?";
  const semi = dataJs.lastIndexOf(";");
  const jsonText = (semi > eq ? dataJs.slice(eq + 1, semi) : dataJs.slice(eq + 1)).trim();
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && parsed.counts && typeof parsed.counts.total === "number") {
      return `${parsed.counts.total} (skills=${parsed.counts.skills ?? "?"}, commands=${parsed.counts.commands ?? "?"})`;
    }
    if (Array.isArray(parsed?.items)) return String(parsed.items.length);
    return "?";
  } catch {
    // Fallback: regex for "total":N
    const m = dataJs.match(/"total"\s*:\s*(\d+)/);
    return m ? m[1] : "?";
  }
}

run();
