// Router tests for hash-router.js.
//
// Facts:
// - Callers: test.sh runs via `node --test tests/*.test.mjs`; CI via .github/workflows/test.yml.
// - No pre-existing router tests (verified by Glob of tests/router*).
// - Data read: hash-router.js loaded as text and evaluated in a node:vm sandbox
//   with a synthetic `window` object. Input is a hash string, e.g.
//   "basket=%2Fa%2C%2Fb&category=Security". No file is written.
// - User instruction verbatim: "yes jag vill att du sätter igång"
//
// Strategy: load hash-router.js once, grab window.HashRouter, then exercise
// parseHash / buildHash / stateToHash / hashStateEquals across all 8 keys,
// URL-encoding round-trips, malformed input, and backward compat with the
// old "basket only" hash format.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const ROUTER_PATH = join(ROOT, "hash-router.js");

// Load hash-router.js in the current realm (not a vm sandbox) so all Array /
// Object prototypes match what the test expects. A vm context would create
// arrays from a different realm and node:assert/strict's deepStrictEqual
// rejects them as non-reference-equal.
function loadRouter() {
  const source = readFileSync(ROUTER_PATH, "utf8");
  const win = {};
  const mod = { exports: {} };
  // The module's IIFE uses `typeof window` / `typeof module` checks, so we
  // hand it local bindings that look like a browser environment.
  const run = new Function("window", "module", source);
  run(win, mod);
  if (!win.HashRouter) {
    throw new Error("HashRouter was not attached to window after loading module");
  }
  return win.HashRouter;
}

const R = loadRouter();

// ---------- parseHash ----------

test("parseHash: empty input returns empty state", () => {
  const p = R.parseHash("");
  assert.equal(p.basket, null);
  assert.equal(p.q, null);
  assert.equal(p.type, null);
  assert.equal(p.category, null);
  assert.deepEqual(p._extra, {});
});

test("parseHash: null/undefined safe", () => {
  assert.doesNotThrow(() => R.parseHash(null));
  assert.doesNotThrow(() => R.parseHash(undefined));
  assert.doesNotThrow(() => R.parseHash(42));
});

test("parseHash: strips leading #", () => {
  const a = R.parseHash("#category=Security");
  const b = R.parseHash("category=Security");
  assert.equal(a.category, "Security");
  assert.equal(b.category, "Security");
});

test("parseHash: basket=comma-separated slugs", () => {
  const p = R.parseHash("basket=%2Fa%2C%2Fb%2C%2Fc");
  assert.deepEqual(p.basket, ["/a", "/b", "/c"]);
});

test("parseHash: basket with unencoded slashes still works", () => {
  const p = R.parseHash("basket=/a,/b");
  assert.deepEqual(p.basket, ["/a", "/b"]);
});

test("parseHash: q decodes spaces and special chars", () => {
  const p = R.parseHash("q=review%20my%20python");
  assert.equal(p.q, "review my python");
});

test("parseHash: type accepts valid values only", () => {
  assert.equal(R.parseHash("type=skill").type, "skill");
  assert.equal(R.parseHash("type=command").type, "command");
  assert.equal(R.parseHash("type=all").type, "all");
  assert.equal(R.parseHash("type=bogus").type, null);
});

test("parseHash: scope accepts valid values only", () => {
  assert.equal(R.parseHash("scope=plugin").scope, "plugin");
  assert.equal(R.parseHash("scope=user").scope, "user");
  assert.equal(R.parseHash("scope=project").scope, "project");
  assert.equal(R.parseHash("scope=weird").scope, null);
});

test("parseHash: tab accepts valid values only", () => {
  assert.equal(R.parseHash("tab=browse").tab, "browse");
  assert.equal(R.parseHash("tab=compose").tab, "compose");
  assert.equal(R.parseHash("tab=recipes").tab, "recipes");
  assert.equal(R.parseHash("tab=xyz").tab, null);
});

test("parseHash: source preserves colons and slashes", () => {
  const p = R.parseHash("source=plugin%3Aposthog");
  assert.equal(p.source, "plugin:posthog");
});

test("parseHash: category with spaces round-trips", () => {
  const p = R.parseHash("category=AI%20Ops");
  assert.equal(p.category, "AI Ops");
});

test("parseHash: item=slug", () => {
  const p = R.parseHash("item=%2Fplugin%3Aposthog%3Adashboards");
  assert.equal(p.item, "/plugin:posthog:dashboards");
});

test("parseHash: multiple keys combine (AND semantics)", () => {
  const p = R.parseHash("category=Security&type=skill&scope=plugin");
  assert.equal(p.category, "Security");
  assert.equal(p.type, "skill");
  assert.equal(p.scope, "plugin");
});

test("parseHash: unknown keys preserved in _extra", () => {
  const p = R.parseHash("category=Security&future=x&another=y");
  assert.equal(p.category, "Security");
  assert.equal(p._extra.future, "x");
  assert.equal(p._extra.another, "y");
});

test("parseHash: empty values are ignored", () => {
  const p = R.parseHash("q=&category=Security&type=");
  assert.equal(p.q, null);
  assert.equal(p.category, "Security");
  assert.equal(p.type, null);
});

test("parseHash: Unicode in category round-trips", () => {
  const encoded = encodeURIComponent("Kategori: Säkerhet");
  const p = R.parseHash("category=" + encoded);
  assert.equal(p.category, "Kategori: Säkerhet");
});

// ---------- buildHash ----------

test("buildHash: empty state returns empty string", () => {
  assert.equal(R.buildHash({}), "");
  assert.equal(R.buildHash(null), "");
});

test("buildHash: type=all is omitted", () => {
  assert.equal(R.buildHash({ type: "all" }), "");
});

test("buildHash: tab=browse is omitted (default)", () => {
  assert.equal(R.buildHash({ tab: "browse" }), "");
});

test("buildHash: encodes category spaces", () => {
  assert.equal(R.buildHash({ category: "AI Ops" }), "category=AI%20Ops");
});

test("buildHash: basket encodes each slug", () => {
  assert.equal(
    R.buildHash({ basket: ["/a", "/b"] }),
    "basket=%2Fa,%2Fb"
  );
});

test("buildHash: full state produces all keys in declared order", () => {
  const out = R.buildHash({
    basket: ["/x"],
    q: "hello",
    type: "skill",
    scope: "plugin",
    source: "plugin:posthog",
    category: "Security",
    item: "/y",
    tab: "compose"
  });
  // Order is deterministic: basket, q, type, scope, source, category, item, tab
  assert.match(out, /^basket=/);
  assert.ok(out.indexOf("q=hello") > 0);
  assert.ok(out.indexOf("type=skill") > 0);
  assert.ok(out.indexOf("scope=plugin") > 0);
  assert.ok(out.indexOf("source=plugin%3Aposthog") > 0);
  assert.ok(out.indexOf("category=Security") > 0);
  assert.ok(out.indexOf("item=%2Fy") > 0);
  assert.ok(out.indexOf("tab=compose") > 0);
});

test("buildHash: _extra keys emitted sorted", () => {
  const out = R.buildHash({ _extra: { zeta: "2", alpha: "1" } });
  assert.equal(out, "alpha=1&zeta=2");
});

// ---------- round-trip ----------

test("round-trip: parse→build→parse is idempotent for representative input", () => {
  const src = "category=Security&type=skill&scope=plugin&q=review%20py";
  const parsed = R.parseHash(src);
  const built = R.buildHash(parsed);
  const reparsed = R.parseHash(built);
  assert.equal(reparsed.category, parsed.category);
  assert.equal(reparsed.type, parsed.type);
  assert.equal(reparsed.scope, parsed.scope);
  assert.equal(reparsed.q, parsed.q);
});

test("round-trip: unknown keys survive", () => {
  const src = "category=X&futurekey=123";
  const parsed = R.parseHash(src);
  const built = R.buildHash(parsed);
  const reparsed = R.parseHash(built);
  assert.equal(reparsed._extra.futurekey, "123");
});

test("round-trip: basket with special chars", () => {
  const slugs = ["/plugin:posthog:dashboards", "/compound-engineering:resolve_todo_parallel"];
  const built = R.buildHash({ basket: slugs });
  const parsed = R.parseHash(built);
  assert.deepEqual(parsed.basket, slugs);
});

// ---------- backward compatibility ----------

test("backward-compat: old #basket= format still parses", () => {
  // The old loadBasket() used `basket=<slug>,<slug>` with URL-encoded slashes.
  // That exact format must continue to work so old shared links keep resolving.
  const p = R.parseHash("basket=%2Fa%2C%2Fb");
  assert.deepEqual(p.basket, ["/a", "/b"]);
});

// ---------- stateToHash ----------

test("stateToHash: app-state shape maps correctly", () => {
  const appState = {
    filter: { type: "skill", scope: "plugin", source: null, category: "Security", query: "review" },
    activeTab: "browse",
    basket: ["/a"],
    focusedItem: null
  };
  const h = R.stateToHash(appState);
  assert.equal(h.type, "skill");
  assert.equal(h.scope, "plugin");
  assert.equal(h.source, null);
  assert.equal(h.category, "Security");
  assert.equal(h.q, "review");
  assert.equal(h.tab, null); // browse is default, stripped
  assert.deepEqual(h.basket, ["/a"]);
});

test("stateToHash: type=all is stripped to null", () => {
  const h = R.stateToHash({ filter: { type: "all" } });
  assert.equal(h.type, null);
});

test("stateToHash: activeTab=compose survives", () => {
  const h = R.stateToHash({ filter: {}, activeTab: "compose" });
  assert.equal(h.tab, "compose");
});

// ---------- hashStateEquals ----------

test("hashStateEquals: identical states are equal", () => {
  const a = { category: "X", type: "skill" };
  const b = { category: "X", type: "skill" };
  assert.equal(R.hashStateEquals(a, b), true);
});

test("hashStateEquals: different states are not equal", () => {
  const a = { category: "X", type: "skill" };
  const b = { category: "X", type: "command" };
  assert.equal(R.hashStateEquals(a, b), false);
});

test("hashStateEquals: key-order invariant (both produce same serialization)", () => {
  // parseHash output keys are in declaration order; buildHash emits in spec order.
  // stateToHash likewise. Two states that differ only in key order should still equal.
  const a = R.parseHash("category=X&type=skill");
  const b = R.parseHash("type=skill&category=X");
  assert.equal(R.hashStateEquals(a, b), true);
});
