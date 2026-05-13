// tests/routine.test.mjs — exercises lib/routine.mjs + the 3 example routines.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROUTINE_VERSION,
  validateRoutine,
  loadRoutine,
  recipeToRoutine,
} from "../lib/routine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ROUTINES_DIR = join(ROOT, "routines");

// ─── Schema constant ──────────────────────────────────────────────────────

test("ROUTINE_VERSION is 1", () => {
  assert.equal(ROUTINE_VERSION, 1);
});

// ─── Pure validator behaviour ─────────────────────────────────────────────

test("validateRoutine: accepts a minimal valid routine", () => {
  const r = validateRoutine({
    version: 1,
    id: "demo-routine",
    title: "Demo",
    cadence: "manual",
    steps: [{ kind: "skill", ref: "/foo:bar" }],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test("validateRoutine: rejects wrong version", () => {
  const r = validateRoutine({
    version: 2,
    id: "x",
    title: "X",
    cadence: "manual",
    steps: [{ kind: "skill", ref: "/x" }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /version/.test(e)));
});

test("validateRoutine: rejects invalid id pattern", () => {
  const r = validateRoutine({
    version: 1,
    id: "Has Spaces",
    title: "X",
    cadence: "manual",
    steps: [{ kind: "skill", ref: "/x" }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /id/.test(e)));
});

test("validateRoutine: rejects unknown cadence", () => {
  const r = validateRoutine({
    version: 1,
    id: "x",
    title: "X",
    cadence: "weekly",
    steps: [{ kind: "skill", ref: "/x" }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /cadence/.test(e)));
});

test("validateRoutine: rejects empty steps", () => {
  const r = validateRoutine({
    version: 1,
    id: "x",
    title: "X",
    cadence: "manual",
    steps: [],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /steps/.test(e)));
});

test("validateRoutine: accepts kb_query step kind (Fas 5 KB adapter)", () => {
  const r = validateRoutine({
    version: 1,
    id: "demo-kb",
    title: "KB",
    cadence: "manual",
    steps: [{ kind: "kb_query", ref: "docs/PHASE_PLAN_AGENTIC_FACTORY.md", args: { provider: "file" } }],
  });
  assert.equal(r.ok, true, `errors: ${r.errors.join("; ")}`);
});

test("validateRoutine: rejects unknown step.kind", () => {
  const r = validateRoutine({
    version: 1,
    id: "x",
    title: "X",
    cadence: "manual",
    steps: [{ kind: "magic", ref: "/x" }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /kind/.test(e)));
});

test("validateRoutine: rejects verify=command without command field", () => {
  const r = validateRoutine({
    version: 1,
    id: "x",
    title: "X",
    cadence: "manual",
    steps: [{ kind: "skill", ref: "/x", verify: { kind: "command" } }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /verify\.command required/.test(e)));
});

test("validateRoutine: accepts verify=artifact with path", () => {
  const r = validateRoutine({
    version: 1,
    id: "x",
    title: "X",
    cadence: "manual",
    steps: [{ kind: "skill", ref: "/x", verify: { kind: "artifact", path: "OUT.md" } }],
  });
  assert.equal(r.ok, true);
});

// ─── recipeToRoutine transformation ───────────────────────────────────────

test("recipeToRoutine produces a valid routine from a recipe-shape input", () => {
  const recipe = {
    id: "demo",
    title: "Demo",
    description: "d",
    intent: "do x",
    slugs: ["/a", "/b"],
  };
  const r = recipeToRoutine(recipe);
  const v = validateRoutine(r);
  assert.equal(v.ok, true, `errors: ${v.errors.join("; ")}`);
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0].kind, "skill");
  assert.equal(r.steps[0].ref, "/a");
  assert.equal(r.metadata.source_recipe_id, "demo");
});

test("recipeToRoutine throws on missing recipe id", () => {
  assert.throws(() => recipeToRoutine({}), /id/);
});

// ─── Example routines on disk validate ────────────────────────────────────

const EXPECTED_ROUTINES = [
  "code-review.routine.json",
  "onboard-repo.routine.json",
  "security-audit.routine.json",
];

for (const file of EXPECTED_ROUTINES) {
  test(`routines/${file} validates against v1`, () => {
    const loaded = loadRoutine(join(ROUTINES_DIR, file));
    assert.equal(loaded.version, 1);
    assert.ok(Array.isArray(loaded.steps) && loaded.steps.length >= 2);
  });
}

test("routines/ contains at least 3 example routines", () => {
  const files = readdirSync(ROUTINES_DIR).filter((f) => f.endsWith(".routine.json"));
  assert.ok(files.length >= 3, `expected >= 3 routine files, found ${files.length}: ${files.join(", ")}`);
});

// ─── All real recipes can transform without code edits ────────────────────

test("every entry in recipes.json can be expressed as a valid routine", () => {
  const recipesPath = join(ROOT, "recipes.json");
  const parsed = JSON.parse(readFileSync(recipesPath, "utf-8"));
  const list = Array.isArray(parsed) ? parsed : parsed.recipes;
  assert.ok(Array.isArray(list) && list.length > 0, "recipes.json should expose a list");
  let counted = 0;
  for (const recipe of list) {
    if (recipe.packageTemplate) continue;
    if (!Array.isArray(recipe.slugs) || recipe.slugs.length === 0) continue;
    const routine = recipeToRoutine(recipe);
    const result = validateRoutine(routine);
    assert.equal(result.ok, true, `recipe ${recipe.id} failed validation: ${result.errors.join("; ")}`);
    counted += 1;
  }
  assert.ok(counted >= 3, `expected >= 3 transformable recipes, got ${counted}`);
});
