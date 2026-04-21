// Skill Browser analytics module.
//
// GDPR-first opt-in: no events leave the user's machine until they
// explicitly consent. PostHog is loaded lazily only when opted in.
//
// To enable analytics: set POSTHOG_KEY in index.html to your PostHog
// project key (the phc_... public key — not a secret). Leave null to
// disable entirely (default).
//
// DOM-free core API — testable in Node.js via node:vm. Only _bootstrap()
// touches the DOM; the rest is pure state + conditional dispatch.
(function attach(root) {
  "use strict";

  var _key = null;
  var _host = "https://eu.i.posthog.com";
  var _cdn = "https://eu-assets.i.posthog.com/static/array.js";
  var _enabled = false;
  var _loaded = false;
  var _queue = []; // events captured before PostHog script loads

  function init(key, opts) {
    if (!key || typeof key !== "string") return;
    _key = key;
    if (opts && typeof opts.host === "string") _host = opts.host;
    if (opts && typeof opts.cdn === "string") _cdn = opts.cdn;
    if (opts && opts.optIn === true) {
      _enabled = true;
      _bootstrap();
    }
  }

  function _bootstrap() {
    if (_loaded || typeof document === "undefined") return;
    _loaded = true;
    var s = document.createElement("script");
    s.src = _cdn;
    s.async = true;
    s.onload = function () {
      var ph = root && root.posthog;
      if (ph && typeof ph.init === "function") {
        ph.init(_key, {
          api_host: _host,
          autocapture: false,
          capture_pageview: false,
          persistence: "memory"
        });
        var pending = _queue.splice(0);
        for (var i = 0; i < pending.length; i++) {
          ph.capture(pending[i].event, pending[i].props);
        }
      }
    };
    document.head.appendChild(s);
  }

  function track(event, props) {
    if (!_enabled || !_key) return null;
    var payload = Object.assign({}, props || {}, { $lib: "skill-browser" });
    var ph = root && root.posthog;
    if (ph && typeof ph.capture === "function") {
      ph.capture(event, payload);
    } else {
      _queue.push({ event: event, props: payload });
    }
    return { event: event, props: payload };
  }

  function optIn() {
    _enabled = true;
    if (_key) _bootstrap();
  }

  function optOut() {
    _enabled = false;
    _queue = [];
    _loaded = false; // allow re-bootstrap if user opts back in
    var ph = root && root.posthog;
    if (ph && typeof ph.opt_out_capturing === "function") {
      ph.opt_out_capturing();
    }
  }

  function isEnabled() {
    return _enabled;
  }

  var api = {
    init: init,
    track: track,
    optIn: optIn,
    optOut: optOut,
    isEnabled: isEnabled
  };

  if (root) root.Analytics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
