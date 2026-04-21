import { test } from "node:test";
import { strictEqual, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "..", "analytics.js"), "utf8");

// Run analytics.js in a sandboxed VM context with a mock posthog and window.
// The IIFE picks up `window` from the context globals, so Analytics is both
// assigned to ctx.window.Analytics and exported via ctx.module.exports.
function makeAnalytics() {
  const captured = [];
  const ph = {
    capture: (event, props) => captured.push({ event, props }),
    init: () => {},
    opt_out_capturing: () => {}
  };
  const win = { posthog: ph };
  const ctx = vm.createContext(Object.assign({ module: { exports: {} }, window: win }, win));
  vm.runInContext(SRC, ctx);
  const api = ctx.module.exports;
  api._captured = captured;
  return api;
}

test("analytics: isEnabled returns false before opt-in", () => {
  const a = makeAnalytics();
  strictEqual(a.isEnabled(), false);
});

test("analytics: init with optIn:false leaves disabled", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: false });
  strictEqual(a.isEnabled(), false);
});

test("analytics: init with optIn:true enables tracking", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  strictEqual(a.isEnabled(), true);
});

test("analytics: init with null key stays disabled", () => {
  const a = makeAnalytics();
  a.init(null, { optIn: true });
  strictEqual(a.isEnabled(), false);
});

test("analytics: track returns null when disabled", () => {
  const a = makeAnalytics();
  const result = a.track("app.opened", { viewport_w: 1440 });
  strictEqual(result, null);
  strictEqual(a._captured.length, 0);
});

test("analytics: track returns event object when enabled", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  const result = a.track("app.opened", { viewport_w: 1440 });
  ok(result !== null);
  strictEqual(result.event, "app.opened");
  strictEqual(result.props.viewport_w, 1440);
  strictEqual(result.props.$lib, "skill-browser");
});

test("analytics: track dispatches to posthog.capture", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  a.track("tab.switched", { from: "browse", to: "compose" });
  strictEqual(a._captured.length, 1);
  strictEqual(a._captured[0].event, "tab.switched");
  strictEqual(a._captured[0].props.from, "browse");
  strictEqual(a._captured[0].props.to, "compose");
});

test("analytics: $lib appended to every event", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  const r = a.track("basket.action", { op: "add", count: 1 });
  strictEqual(r.props.$lib, "skill-browser");
});

test("analytics: optOut disables tracking", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  a.optOut();
  strictEqual(a.isEnabled(), false);
  a.track("app.opened", {});
  strictEqual(a._captured.length, 0);
});

test("analytics: optIn after optOut re-enables tracking", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  a.optOut();
  a.optIn();
  strictEqual(a.isEnabled(), true);
  a.track("tab.switched", { from: "browse", to: "recipes" });
  strictEqual(a._captured.length, 1);
});

test("analytics: track does not mutate caller props", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  const original = { from: "browse", to: "compose" };
  a.track("tab.switched", original);
  strictEqual(Object.keys(original).length, 2);
  ok(!("$lib" in original));
});

test("analytics: basket.action shape is correct", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  const r = a.track("basket.action", { op: "clear", count: 0 });
  strictEqual(r.props.op, "clear");
  strictEqual(r.props.count, 0);
});

test("analytics: filter.changed carries facet and value", () => {
  const a = makeAnalytics();
  a.init("phc_test", { optIn: true });
  const r = a.track("filter.changed", { facet: "category", value: "Security" });
  strictEqual(r.props.facet, "category");
  strictEqual(r.props.value, "Security");
});
