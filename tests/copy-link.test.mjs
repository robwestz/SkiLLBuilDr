// Tests for lib/copy-link.mjs.
//
// Pure builders → no DOM, no localStorage. We import the module directly and
// feed it (item, config, items) tuples. Each builder must:
//   - Return a valid URL string for the happy-path config.
//   - Return null with no throws when required config or fields are missing.
//
// User instruction verbatim: "Implement the plan as specified".

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalLink,
  buildHostLink,
  buildGithubLink,
  isPublicOnlyMode,
} from "../lib/copy-link.mjs";

// ---------- buildLocalLink ----------

test("buildLocalLink: file:// for posix path", () => {
  const url = buildLocalLink({ path: "/Users/me/.claude/skills/foo/SKILL.md" });
  assert.equal(url, "file:///Users/me/.claude/skills/foo/SKILL.md");
});

test("buildLocalLink: file:/// for Windows C:\\...\\SKILL.md", () => {
  const url = buildLocalLink({ path: "C:\\Users\\robin\\.claude\\skills\\foo\\SKILL.md" });
  assert.equal(url, "file:///C:/Users/robin/.claude/skills/foo/SKILL.md");
});

test("buildLocalLink: null when item.path missing", () => {
  assert.equal(buildLocalLink({}), null);
  assert.equal(buildLocalLink({ path: "" }), null);
  assert.equal(buildLocalLink(null), null);
});

// ---------- buildHostLink ----------

test("buildHostLink: trailing-slash hostBase normalised, slug encoded", () => {
  const item = { slug: "/plugin:posthog:dashboards" };
  const cfg = { hostBase: "https://skills.example.com/" };
  assert.equal(
    buildHostLink(item, cfg),
    "https://skills.example.com/plugin%3Aposthog%3Adashboards"
  );
});

test("buildHostLink: null when hostBase missing", () => {
  const item = { slug: "/plugin:posthog:dashboards" };
  assert.equal(buildHostLink(item, {}), null);
  assert.equal(buildHostLink(item, null), null);
  assert.equal(buildHostLink({}, { hostBase: "https://x" }), null);
});

// ---------- buildGithubLink ----------

test("buildGithubLink: derives repo path via localPrefix strip", () => {
  const item = {
    slug: "/plugin:posthog:foo",
    source: "plugin:posthog",
    path: "C:\\cache\\posthog\\1.0.0\\skills\\foo\\SKILL.md",
  };
  const cfg = {
    github: {
      sources: {
        "plugin:posthog": {
          owner: "PostHog",
          repo: "posthog",
          ref: "main",
          localPrefix: "C:/cache/posthog/1.0.0/",
        },
      },
    },
  };
  assert.equal(
    buildGithubLink(item, cfg),
    "https://github.com/PostHog/posthog/blob/main/skills/foo/SKILL.md"
  );
});

test("buildGithubLink: pathMap takes precedence over localPrefix", () => {
  const item = {
    slug: "/plugin:posthog:foo",
    source: "plugin:posthog",
    path: "C:/cache/posthog/1.0.0/skills/foo/SKILL.md",
  };
  const cfg = {
    github: {
      sources: {
        "plugin:posthog": {
          owner: "PostHog",
          repo: "posthog",
          ref: "v2",
          localPrefix: "C:/cache/posthog/1.0.0/",
          pathMap: { "/plugin:posthog:foo": "custom/path/SKILL.md" },
        },
      },
    },
  };
  assert.equal(
    buildGithubLink(item, cfg),
    "https://github.com/PostHog/posthog/blob/v2/custom/path/SKILL.md"
  );
});

test("buildGithubLink: null when owner/repo missing", () => {
  const item = { slug: "/x", source: "plugin:x", path: "/a/b" };
  assert.equal(buildGithubLink(item, {}), null);
  assert.equal(buildGithubLink(item, { github: { owner: "you" } }), null);
  assert.equal(buildGithubLink(item, { github: { repo: "r" } }), null);
});

test("buildGithubLink: null when path cannot be derived (no pathMap, no localPrefix match)", () => {
  const item = {
    slug: "/plugin:x:y",
    source: "plugin:x",
    path: "/totally/different/place",
  };
  const cfg = {
    github: {
      owner: "you", repo: "r", ref: "main",
      sources: { "plugin:x": { localPrefix: "/cache/x/" } },
    },
  };
  assert.equal(buildGithubLink(item, cfg), null);
});

test("buildGithubLink: repo-wide owner/repo used when no per-source override", () => {
  const item = {
    slug: "/user:foo",
    source: "user",
    path: "C:/repo/skills/foo/SKILL.md",
  };
  const cfg = {
    github: {
      owner: "robin", repo: "ecc-browser", ref: "main",
      sources: { "user": { localPrefix: "C:/repo/" } },
    },
  };
  assert.equal(
    buildGithubLink(item, cfg),
    "https://github.com/robin/ecc-browser/blob/main/skills/foo/SKILL.md"
  );
});

// ---------- isPublicOnlyMode ----------

test("isPublicOnlyMode: true when no item has path, false otherwise", () => {
  assert.equal(isPublicOnlyMode([]), true);
  assert.equal(isPublicOnlyMode([{ slug: "/a" }, { slug: "/b" }]), true);
  assert.equal(isPublicOnlyMode([{ slug: "/a", path: "" }]), true);
  assert.equal(
    isPublicOnlyMode([{ slug: "/a" }, { slug: "/b", path: "/some/path" }]),
    false
  );
  assert.equal(isPublicOnlyMode(null), true);
  assert.equal(isPublicOnlyMode(undefined), true);
});
