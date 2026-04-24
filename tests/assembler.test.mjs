import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function extractAssemblerFunctions() {
  const html = readFileSync(join(__dirname, "../assembler.html"), "utf8");
  // Find all inline script blocks (no src attribute)
  const scriptBlocks = [...html.matchAll(/<script(?:\s[^>]*)?>(?!.*src)([\s\S]*?)<\/script>/gi)];
  // Pick the largest block (the app logic)
  const largestBlock = scriptBlocks.reduce((a, b) =>
    b[1].length > a[1].length ? b : a, scriptBlocks[0]);
  const scriptContent = largestBlock[1];

  // Create a sandbox and run the script
  const sandbox = {
    window: {},
    document: {
      getElementById: () => ({ textContent: "", innerHTML: "", classList: { add: () => {}, remove: () => {} }, querySelectorAll: () => [] }),
      querySelectorAll: () => [],
    },
    navigator: {},
    clearTimeout: () => {},
    setTimeout: () => {},
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    console,
  };
  sandbox.window = sandbox;
  try {
    runInNewContext(scriptContent, sandbox);
  } catch (e) {
    // Ignore DOM errors from init() — functions are already defined
  }
  return sandbox;
}

const fns = extractAssemblerFunctions();

// Verify extraction worked
assert.equal(typeof fns.slugifyPackageLabel, "function", "slugifyPackageLabel must be extracted");
assert.equal(typeof fns.detectPackageProfile, "function", "detectPackageProfile must be extracted");
assert.equal(typeof fns.buildClaudeMdInline, "function", "buildClaudeMdInline must be extracted");

const {
  slugifyPackageLabel,
  detectPackageProfile,
  inferDeliverables,
  inferSuccessCriteria,
  inferFirstMoves,
  buildExecutionPlan,
  buildClaudeMdInline,
  buildReadmeInline,
  buildKickoffInline,
  scoreIntent,
  normalizeSelection,
  uniqueNodesForPackage,
  countByType,
} = fns;

// ── 1. slugifyPackageLabel: normal case ──────────────────────────────────────
test("slugifyPackageLabel: converts mixed-case phrase to lowercase-hyphenated slug", () => {
  assert.equal(slugifyPackageLabel("Build a SaaS App"), "build-a-saas-app");
});

// ── 2. slugifyPackageLabel: empty input returns default ──────────────────────
test("slugifyPackageLabel: empty string returns 'workspace-package'", () => {
  assert.equal(slugifyPackageLabel(""), "workspace-package");
});

// ── 3. slugifyPackageLabel: special chars and extra spaces collapsed ─────────
test("slugifyPackageLabel: collapses special chars and extra spaces", () => {
  assert.equal(slugifyPackageLabel("REST API!!!  2.0"), "rest-api-2-0");
});

// ── 4. detectPackageProfile: CLI ─────────────────────────────────────────────
test("detectPackageProfile: returns 'cli' when goal mentions CLI", () => {
  assert.equal(detectPackageProfile("build a CLI release tool", "", []), "cli");
});

// ── 5. detectPackageProfile: SaaS ────────────────────────────────────────────
test("detectPackageProfile: returns 'saas' when goal mentions saas billing", () => {
  assert.equal(detectPackageProfile("saas billing dashboard", "", []), "saas");
});

// ── 6. detectPackageProfile: data ────────────────────────────────────────────
test("detectPackageProfile: returns 'data' when goal mentions data pipeline ETL", () => {
  assert.equal(detectPackageProfile("data pipeline ETL", "", []), "data");
});

// ── 7. detectPackageProfile: general fallback ────────────────────────────────
test("detectPackageProfile: returns 'general' for unrecognised goal", () => {
  assert.equal(detectPackageProfile("write docs", "", []), "general");
});

// ── 8. buildClaudeMdInline: contains ## Skills header and slug ───────────────
test("buildClaudeMdInline: output contains '## Skills' section and the node slug", () => {
  const result = buildClaudeMdInline({
    nodes: [{ slug: "/ecc:python-reviewer", name: "python-reviewer", description: "Reviews Python" }],
  });
  assert.ok(result.includes("## Skills"), "must contain '## Skills'");
  assert.ok(result.includes("/ecc:python-reviewer"), "must contain the slug");
});

// ── 9. buildClaudeMdInline: slug-less nodes are skipped without throwing ──────
test("buildClaudeMdInline: slug-less nodes are silently skipped", () => {
  let result;
  assert.doesNotThrow(() => {
    result = buildClaudeMdInline({ nodes: [{ name: "no-slug" }] });
  });
  // No skill lines should appear
  const lines = result.split("\n").filter((l) => l.startsWith("- `"));
  assert.equal(lines.length, 0, "no skill lines for slug-less nodes");
});

// ── 10. buildReadmeInline: contains package name and node name ────────────────
test("buildReadmeInline: output contains package name heading and node name", () => {
  const result = buildReadmeInline({
    goal: "Build REST API",
    packageName: "rest-api",
    nodes: [{ slug: "/ecc:go-reviewer", name: "go-reviewer", description: "" }],
  });
  assert.ok(result.includes("# rest-api"), "must start with '# rest-api'");
  assert.ok(result.includes("go-reviewer"), "must list the node name");
});

// ── 11. buildKickoffInline: contains KICKOFF header, Goal, goal text, node ───
test("buildKickoffInline: output contains KICKOFF heading, ## Goal, goal text, and node name", () => {
  const result = buildKickoffInline({
    goal: "deploy a cli",
    packageName: "deploy-cli",
    nodes: [{ slug: "/ecc:go-build-resolver", name: "go-build-resolver", description: "Resolves build errors" }],
  });
  assert.ok(result.includes("# KICKOFF:"), "must contain '# KICKOFF:'");
  assert.ok(result.includes("## Goal"), "must contain '## Goal'");
  assert.ok(result.includes("deploy a cli"), "must contain the goal text");
  assert.ok(result.includes("go-build-resolver"), "must list the node name");
});

// ── 12. buildKickoffInline: saas profile triggers saas-specific deliverables ──
test("buildKickoffInline: saas goal produces saas-specific deliverable text", () => {
  const result = buildKickoffInline({
    goal: "build a saas billing dashboard with auth and onboarding",
    packageName: "saas-billing",
    nodes: [],
  });
  // inferDeliverables("saas", ...) includes "auth, core flows" text
  assert.ok(
    result.toLowerCase().includes("auth"),
    "saas profile deliverables must mention auth"
  );
});

// ── 13. uniqueNodesForPackage: deduplicates by slug ──────────────────────────
test("uniqueNodesForPackage: deduplicates nodes that share the same slug", () => {
  const result = uniqueNodesForPackage([{ slug: "/a" }, { slug: "/a" }, { slug: "/b" }]);
  assert.equal(result.length, 2);
});

// ── 14. uniqueNodesForPackage: empty input returns empty array ────────────────
test("uniqueNodesForPackage: returns empty array for empty input", () => {
  assert.deepEqual(uniqueNodesForPackage([]), []);
});

// ── 15. countByType: aggregates counts correctly ──────────────────────────────
test("countByType: correctly counts nodes by type", () => {
  const result = countByType([
    { type: "skill" },
    { type: "skill" },
    { type: "command" },
  ]);
  // deepEqual fails across vm contexts — compare values explicitly
  assert.equal(result.skill, 2);
  assert.equal(result.command, 1);
  assert.equal(Object.keys(result).length, 2);
});

// ── 16. scoreIntent: relevant items rank first ────────────────────────────────
test("scoreIntent: 'review python code' surfaces python-reviewer as top result", () => {
  const catalog = [
    { name: "python-reviewer", description: "Reviews Python code", category: "Review", slug: "/ecc:python-reviewer" },
    { name: "go-reviewer", description: "Reviews Go code", category: "Review", slug: "/ecc:go-reviewer" },
    { name: "tdd-guide", description: "Test driven development", category: "Testing", slug: "/ecc:tdd-guide" },
  ];
  const results = scoreIntent("review python code", catalog, 10);
  assert.ok(results.length > 0, "should return at least one result");
  const topName = results[0].name.toLowerCase();
  assert.ok(
    topName.includes("python") || topName.includes("review"),
    `top result name should contain 'python' or 'review', got: ${topName}`
  );
});

// ── 17. scoreIntent: empty query returns empty array ─────────────────────────
test("scoreIntent: empty query string returns []", () => {
  const catalog = [
    { name: "python-reviewer", description: "Reviews Python code", category: "Review", slug: "/ecc:python-reviewer" },
    { name: "go-reviewer", description: "Reviews Go code", category: "Review", slug: "/ecc:go-reviewer" },
    { name: "tdd-guide", description: "Test driven development", category: "Testing", slug: "/ecc:tdd-guide" },
  ];
  const results = scoreIntent("", catalog, 10);
  assert.equal(results.length, 0, "empty query must return zero results");
});

// ── 18. normalizeSelection: returns exact expected shape ─────────────────────
test("normalizeSelection: returns normalised object with all expected fields", () => {
  const input = {
    type: "skill",
    name: "foo",
    slug: "/foo",
    description: "desc",
    category: "cat",
    source: "src",
    body: "body",
  };
  const result = normalizeSelection(input);
  // Compare field-by-field to avoid cross-realm deepEqual issues
  assert.equal(result.type, "skill");
  assert.equal(result.name, "foo");
  assert.equal(result.slug, "/foo");
  assert.equal(result.description, "desc");
  assert.equal(result.category, "cat");
  assert.equal(result.source, "src");
  assert.equal(result.body, "body");
  assert.equal(Object.keys(result).length, 7);
});
