// Pure builders for the detail-panel "Copy link" menu.
//
// No DOM, no localStorage — everything is parameterised so both the browser
// and node:test can exercise the same code. index.html injects config
// (parsed from localStorage key "ecc-browser.copy-link.v1") and the full
// items array. Each builder returns either a string (URL) or null when the
// target cannot be resolved; the caller decides how to surface that as a
// disabled menu row with a reason.
//
// Three targets:
//   - Local file (file:// from item.path)
//   - Own host  (<hostBase>/<encoded-slug>)
//   - GitHub    (https://github.com/<owner>/<repo>/blob/<ref>/<repo-path>)
//
// Config shape (all keys optional):
//   {
//     hostBase: "https://skills.example.com",
//     github: {
//       owner, repo, ref,                       // repo-wide defaults
//       sources: {                              // per-source overrides
//         "plugin:posthog": {
//           owner, repo, ref,
//           localPrefix: "C:/.../plugins/cache/posthog/1.0.0/",
//           pathMap: { "/plugin:posthog:foo": "skills/foo/SKILL.md" }
//         }
//       }
//     }
//   }

"use strict";

function normaliseSlashes(p) {
  if (typeof p !== "string") return "";
  return p.replace(/\\/g, "/");
}

// True when no item in the catalog carries a `path` field — the catalog was
// built with `--sanitize` and Local file:// links are not available.
export function isPublicOnlyMode(items) {
  if (!Array.isArray(items)) return true;
  for (let i = 0; i < items.length; i++) {
    const x = items[i];
    if (x && typeof x.path === "string" && x.path) return false;
  }
  return true;
}

// file:// URL from item.path. Windows paths (C:\…) become file:///C:/…,
// POSIX paths (/Users/…) become file:///Users/…. Returns null when the
// item has no path (sanitised build or missing field).
export function buildLocalLink(item) {
  if (!item || typeof item.path !== "string" || !item.path) return null;
  const norm = normaliseSlashes(item.path);
  // Windows drive letter (e.g. "C:/…"): file:///C:/…
  if (/^[A-Za-z]:\//.test(norm)) return `file:///${norm}`;
  // POSIX absolute (e.g. "/Users/…"): file:///Users/…
  if (norm.startsWith("/")) return `file://${norm}`;
  // Relative path — surface as file:/// with no host (best effort).
  return `file:///${norm}`;
}

// <hostBase>/<encoded-slug>. Slug's leading "/" is stripped before encoding
// so the URL stays clean and doesn't double up on slashes.
export function buildHostLink(item, config) {
  if (!item || typeof item.slug !== "string" || !item.slug) return null;
  const cfg = config || {};
  if (!cfg.hostBase || typeof cfg.hostBase !== "string") return null;
  const base = cfg.hostBase.replace(/\/+$/, "");
  const slugClean = item.slug.replace(/^\/+/, "");
  return `${base}/${encodeURIComponent(slugClean)}`;
}

// https://github.com/<owner>/<repo>/blob/<ref>/<repo-relative-path>.
// Per-source overrides win over repo-wide defaults. Path derivation order:
//   1. pathMap[slug] (explicit; required in public-only mode)
//   2. strip localPrefix from item.path (only when both exist and prefix matches)
// Returns null when owner/repo or the path cannot be resolved.
export function buildGithubLink(item, config) {
  if (!item) return null;
  const ghCfg = (config && config.github) || {};
  const src = item.source || "";
  const perSource = (ghCfg.sources && ghCfg.sources[src]) || null;

  const owner = (perSource && perSource.owner) || ghCfg.owner;
  const repo  = (perSource && perSource.repo)  || ghCfg.repo;
  const ref   = (perSource && perSource.ref)   || ghCfg.ref || "main";
  if (!owner || !repo) return null;

  let repoPath = null;
  if (perSource && perSource.pathMap && typeof perSource.pathMap[item.slug] === "string") {
    repoPath = perSource.pathMap[item.slug];
  } else if (typeof item.path === "string" && item.path && perSource && perSource.localPrefix) {
    const norm = normaliseSlashes(item.path);
    const prefix = normaliseSlashes(perSource.localPrefix);
    if (norm.startsWith(prefix)) {
      repoPath = norm.slice(prefix.length).replace(/^\/+/, "");
    }
  }
  if (!repoPath) return null;

  // Encode each segment individually so spaces / unicode are safe but
  // slashes stay as path separators.
  const encoded = repoPath.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${owner}/${repo}/blob/${ref}/${encoded}`;
}

export default {
  isPublicOnlyMode,
  buildLocalLink,
  buildHostLink,
  buildGithubLink,
};
