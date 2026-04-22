// Deep-link hash router for Skill Browser.
//
// Pure functions — no DOM access — so both the browser and node:vm-based tests
// can exercise the same code. Exposes `window.HashRouter` when loaded via <script>.
//
// Hash spec (all keys optional, combinable, AND-filter semantics on filters):
//   basket=<slug>,<slug>       comma-separated URL-encoded slugs (leading "/" expected)
//   q=<search>                 URL-encoded free-text search
//   type=skill|command|all     type filter
//   scope=plugin|user|project  scope filter
//   source=<id>                URL-encoded source id (e.g. "plugin:posthog")
//   category=<name>            URL-encoded category name
//   item=<slug>                URL-encoded slug to focus/scroll-to in Browse
//   tab=browse|compose|recipes initial active tab
//
// Unknown keys are preserved under `_extra` so links can round-trip through
// future versions without data loss.
(function attach(root) {
  "use strict";

  var TYPE_VALUES = ["all", "skill", "command"];
  var SCOPE_VALUES = ["plugin", "user", "project"];
  var TAB_VALUES = ["browse", "compose", "recipes"];

  function parseHash(hashStr) {
    var out = {
      basket: null,
      q: null,
      type: null,
      scope: null,
      source: null,
      category: null,
      item: null,
      tab: null,
      _extra: {}
    };
    if (typeof hashStr !== "string" || !hashStr) return out;
    var raw = hashStr.charAt(0) === "#" ? hashStr.slice(1) : hashStr;
    if (!raw) return out;

    // Use URLSearchParams when available (browser + modern Node); fall back to
    // a manual split so the pure-function contract holds in every context.
    var pairs;
    if (typeof URLSearchParams === "function") {
      pairs = [];
      var sp = new URLSearchParams(raw);
      sp.forEach(function (v, k) { pairs.push([k, v]); });
    } else {
      pairs = raw.split("&").map(function (seg) {
        var eq = seg.indexOf("=");
        if (eq < 0) return [decodeURIComponent(seg), ""];
        return [decodeURIComponent(seg.slice(0, eq)), decodeURIComponent(seg.slice(eq + 1))];
      });
    }

    for (var i = 0; i < pairs.length; i++) {
      var k = pairs[i][0];
      var v = pairs[i][1];
      if (v === "" || v == null) continue;

      switch (k) {
        case "basket":
          out.basket = v
            .split(",")
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
          break;
        case "q":
          out.q = v;
          break;
        case "type":
          out.type = TYPE_VALUES.indexOf(v) >= 0 ? v : null;
          break;
        case "scope":
          out.scope = SCOPE_VALUES.indexOf(v) >= 0 ? v : null;
          break;
        case "source":
          out.source = v;
          break;
        case "category":
          out.category = v;
          break;
        case "item":
          out.item = v;
          break;
        case "tab":
          out.tab = TAB_VALUES.indexOf(v) >= 0 ? v : null;
          break;
        default:
          out._extra[k] = v;
      }
    }
    return out;
  }

  // Takes an object shaped like parseHash() output (or a looser superset from
  // application state) and serialises to a hash string suitable for location.hash.
  // Empty/null values are omitted so the URL stays clean.
  function buildHash(state) {
    if (!state || typeof state !== "object") return "";
    var parts = [];

    if (Array.isArray(state.basket) && state.basket.length > 0) {
      parts.push("basket=" + state.basket.map(encodeURIComponent).join(","));
    }
    if (typeof state.q === "string" && state.q.length > 0) {
      parts.push("q=" + encodeURIComponent(state.q));
    }
    if (typeof state.type === "string" && state.type && state.type !== "all") {
      parts.push("type=" + encodeURIComponent(state.type));
    }
    if (typeof state.scope === "string" && state.scope) {
      parts.push("scope=" + encodeURIComponent(state.scope));
    }
    if (typeof state.source === "string" && state.source) {
      parts.push("source=" + encodeURIComponent(state.source));
    }
    if (typeof state.category === "string" && state.category) {
      parts.push("category=" + encodeURIComponent(state.category));
    }
    if (typeof state.item === "string" && state.item) {
      parts.push("item=" + encodeURIComponent(state.item));
    }
    if (typeof state.tab === "string" && state.tab && state.tab !== "browse") {
      parts.push("tab=" + encodeURIComponent(state.tab));
    }
    if (state._extra && typeof state._extra === "object") {
      var keys = Object.keys(state._extra).sort();
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = state._extra[k];
        if (v == null || v === "") continue;
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
      }
    }
    return parts.join("&");
  }

  // True when two hash-state objects would serialise to the same hash.
  function hashStateEquals(a, b) {
    return buildHash(a || {}) === buildHash(b || {});
  }

  // Derive a hash-state from the app's `state` shape used in index.html.
  // Lives here so tests can verify the mapping without a DOM.
  function stateToHash(appState) {
    if (!appState) return {};
    var f = appState.filter || {};
    return {
      basket: Array.isArray(appState.basket) ? appState.basket.slice() : null,
      q: f.query || null,
      type: f.type && f.type !== "all" ? f.type : null,
      scope: f.scope || null,
      source: f.source || null,
      category: f.category || null,
      item: appState.focusedItem || null,
      tab: appState.activeTab && appState.activeTab !== "browse" ? appState.activeTab : null
    };
  }

  var api = {
    parseHash: parseHash,
    buildHash: buildHash,
    hashStateEquals: hashStateEquals,
    stateToHash: stateToHash,
    TYPE_VALUES: TYPE_VALUES.slice(),
    SCOPE_VALUES: SCOPE_VALUES.slice(),
    TAB_VALUES: TAB_VALUES.slice()
  };

  if (root) root.HashRouter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
