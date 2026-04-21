// Structural test for recipes.json seed data.
//
// Facts:
// - Callers: test.sh (same task) runs this via `node --test tests/*.test.mjs`.
//   CI and humans invoke test.sh. No other callers.
// - No pre-existing recipes test (initial Glob showed no test files; the other three
//   new test files cover build/query/intent respectively, not recipes).
// - Data read: recipes.json. Synthetic example shape (no raw production values):
//     {
//       version: 1,
//       generatedAt: "YYYY-MM-DD",   // calendar date, NOT ISO 8601
//       note: "string",
//       recipes: [
//         { id: "kebab-case-id", title: "string", description: "string",
//           intent: "string", slugs: ["/namespace:command-name"] }
//       ]
//     }
//   Date format: "YYYY-MM-DD" (differs from data.json which uses full ISO 8601).
// - User's instruction verbatim: "försök få det till så att du och agent team kan bygga färdig prod version tills jag vaknar och dit är det ca 5h"

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const RECIPES = join(ROOT, "recipes.json");

function loadRecipes() {
  const raw = readFileSync(RECIPES, "utf8");
  return JSON.parse(raw);
}

test("recipes.json parses and has a recipes[] array", () => {
  const data = loadRecipes();
  assert.equal(typeof data, "object");
  assert.ok(data !== null);
  assert.ok(Array.isArray(data.recipes), "recipes is not an array");
  assert.ok(data.recipes.length > 0, "recipes array is empty");
});

test("each recipe has id, title, and slugs[] with at least one slug", () => {
  const data = loadRecipes();
  for (const r of data.recipes) {
    assert.ok(typeof r.id === "string" && r.id.length > 0, `bad id on recipe: ${JSON.stringify(r)}`);
    assert.ok(typeof r.title === "string" && r.title.length > 0, `bad title on recipe ${r.id}`);
    assert.ok(Array.isArray(r.slugs), `recipe ${r.id} has non-array slugs`);
    assert.ok(r.slugs.length > 0, `recipe ${r.id} has empty slugs array`);
  }
});

test("every slug starts with /", () => {
  const data = loadRecipes();
  for (const r of data.recipes) {
    for (const slug of r.slugs) {
      assert.equal(typeof slug, "string", `recipe ${r.id}: non-string slug`);
      assert.ok(slug.startsWith("/"), `recipe ${r.id}: slug does not start with /: "${slug}"`);
    }
  }
});

test("recipe ids are unique", () => {
  const data = loadRecipes();
  const ids = data.recipes.map((r) => r.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, `duplicate recipe ids in: ${ids.join(", ")}`);
});
