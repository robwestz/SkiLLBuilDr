// tests/mcp-server.test.mjs — unit tests for mcp-server.mjs exported handlers
// Uses a synthetic 5-item catalog so no data.json is required.
//
// Facts:
// 1. Callers: test.sh (`node --test tests/*.test.mjs`), .github/workflows/test.yml
// 2. No existing file serves the same purpose (Glob: tests/mcp*.mjs → no results)
// 3. Synthetic catalog shape: [{slug, name, description, category, type, source}]
// 4. User instruction: "paus kan jag säga till om och tills dess får du gärna grinda!"

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleToolCall, listTools } from "../mcp-server.mjs";
import { parseStoreZip } from "../zip-builder.mjs";

// ---------------------------------------------------------------------------
// Synthetic catalog — no data.json needed
// ---------------------------------------------------------------------------

const CATALOG = [
  { slug: "/ecc:python-reviewer", name: "python-reviewer", description: "Reviews Python code for quality", category: "Review", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/ecc:tdd-guide", name: "tdd-guide", description: "Test-driven development guide", category: "Testing", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/ecc:security-reviewer", name: "security-reviewer", description: "Security vulnerability detection and remediation", category: "Security", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/ecc:planner", name: "planner", description: "Planning complex features and tasks", category: "Planning", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/posthog:instrument-llm-analytics", name: "instrument-llm-analytics", description: "Instrument LLM API calls into PostHog analytics", category: "Observability", type: "skill", source: "plugin:posthog" },
];

// ---------------------------------------------------------------------------
// 1. listTools returns array of 5 tool definitions
// ---------------------------------------------------------------------------
test("listTools returns array of 6 tool definitions", () => {
  const tools = listTools();
  assert.ok(Array.isArray(tools), "listTools should return an array");
  assert.equal(tools.length, 6, "should have exactly 6 tools");
  for (const t of tools) {
    assert.ok(typeof t.name === "string", "each tool should have a name");
    assert.ok(typeof t.description === "string", "each tool should have a description");
    assert.ok(t.inputSchema && typeof t.inputSchema === "object", "each tool should have inputSchema");
  }
  // Spot-check the new one is listed
  assert.ok(tools.some((t) => t.name === "assemble_from_goal"), "should expose assemble_from_goal");
});

// ---------------------------------------------------------------------------
// 2. search_skills returns array with score field
// ---------------------------------------------------------------------------
test("search_skills returns array with score field", () => {
  const result = handleToolCall("search_skills", { query: "review python code" }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  assert.ok(Array.isArray(result.content), "content should be array");
  const items = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(items), "parsed text should be array");
  for (const item of items) {
    assert.ok(typeof item.score === "number", "each result should have a numeric score");
    assert.ok(typeof item.slug === "string", "each result should have a slug");
  }
});

// ---------------------------------------------------------------------------
// 3. rank_skills_for_goal returns results sorted by score desc
// ---------------------------------------------------------------------------
test("rank_skills_for_goal returns results sorted by score desc", () => {
  const result = handleToolCall("rank_skills_for_goal", { goal: "review python code security" }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const items = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(items), "result should be array");
  for (let i = 1; i < items.length; i++) {
    assert.ok(
      items[i - 1].score >= items[i].score,
      `results should be sorted desc: ${items[i - 1].score} >= ${items[i].score}`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. get_skill returns item by exact slug
// ---------------------------------------------------------------------------
test("get_skill returns item by exact slug", () => {
  const result = handleToolCall("get_skill", { slug: "/ecc:tdd-guide" }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const item = JSON.parse(result.content[0].text);
  assert.equal(item.slug, "/ecc:tdd-guide");
  assert.equal(item.name, "tdd-guide");
});

// ---------------------------------------------------------------------------
// 5. get_skill returns error for unknown slug
// ---------------------------------------------------------------------------
test("get_skill returns error for unknown slug", () => {
  const result = handleToolCall("get_skill", { slug: "/nonexistent:skill" }, CATALOG);
  assert.ok(result.error, "should return an error object");
  assert.ok(
    result.error.code === -32602 || result.error.code === -32603,
    `error code should be -32602 or -32603, got ${result.error.code}`
  );
  assert.ok(typeof result.error.message === "string", "error should have a message");
});

// ---------------------------------------------------------------------------
// 6. assemble_package returns base64 ZIP with expected files
// ---------------------------------------------------------------------------
test("assemble_package returns base64 ZIP for valid slugs", () => {
  const result = handleToolCall("assemble_package", {
    goal: "build a Python code review tool",
    description: "A tool that reviews Python files automatically",
    slugs: ["/ecc:python-reviewer", "/ecc:tdd-guide"],
  }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const payload = JSON.parse(result.content[0].text);
  assert.ok(typeof payload.base64zip === "string", "should have base64zip string");
  assert.ok(payload.base64zip.length > 0, "base64zip should be non-empty");
  assert.ok(Array.isArray(payload.files), "should have files array");
  assert.ok(payload.files.includes("KICKOFF.md"), "should include KICKOFF.md");
  assert.ok(payload.files.includes("CLAUDE.md"), "should include CLAUDE.md");
  assert.ok(payload.files.includes("README.md"), "should include README.md");
  const bytes = Buffer.from(payload.base64zip, "base64");
  assert.equal(bytes[0], 0x50, "ZIP should start with P (0x50)");
  assert.equal(bytes[1], 0x4b, "ZIP should start with PK (0x4b)");
});

// ---------------------------------------------------------------------------
// 7. list_sources returns array with count field
// ---------------------------------------------------------------------------
test("list_sources returns array with count field", () => {
  const result = handleToolCall("list_sources", {}, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const sources = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(sources), "sources should be array");
  assert.ok(sources.length > 0, "should have at least one source");
  for (const s of sources) {
    assert.ok(typeof s.source === "string", "each source should have a source string");
    assert.ok(typeof s.count === "number", "each source should have a count");
    assert.ok(typeof s.types === "object", "each source should have a types object");
  }
});

// ---------------------------------------------------------------------------
// 8. unknown tool returns -32601 error
// ---------------------------------------------------------------------------
test("unknown tool returns -32601 error", () => {
  const result = handleToolCall("nonexistent_tool", {}, CATALOG);
  assert.ok(result.error, "should return an error object");
  assert.equal(result.error.code, -32601, "error code should be -32601");
  assert.ok(result.error.message.includes("nonexistent_tool"), "error message should name the tool");
});

// ---------------------------------------------------------------------------
// 9. search_skills with missing query returns -32602 error
// ---------------------------------------------------------------------------
test("search_skills with missing query returns -32602 error", () => {
  const result = handleToolCall("search_skills", {}, CATALOG);
  assert.ok(result.error, "should return an error object");
  assert.equal(result.error.code, -32602, "error code should be -32602");
  assert.ok(result.error.message.toLowerCase().includes("query"), "error should mention 'query'");
});

// ---------------------------------------------------------------------------
// 10. rank_skills_for_goal with missing goal returns -32602 error
// ---------------------------------------------------------------------------
test("rank_skills_for_goal with missing goal returns -32602 error", () => {
  const result = handleToolCall("rank_skills_for_goal", {}, CATALOG);
  assert.ok(result.error, "should return an error object");
  assert.equal(result.error.code, -32602, "error code should be -32602");
});

// ---------------------------------------------------------------------------
// 11. assemble_package KICKOFF.md contains Phase 0 — Preflight Contract
// (parity with assemble.mjs / buildKickoffWithPhase0)
// ---------------------------------------------------------------------------
test("assemble_package KICKOFF.md contains Phase 0 — Preflight Contract", () => {
  const result = handleToolCall("assemble_package", {
    goal: "build a Python code review tool",
    slugs: ["/ecc:python-reviewer", "/ecc:tdd-guide"],
  }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const payload = JSON.parse(result.content[0].text);
  const zipBytes = Buffer.from(payload.base64zip, "base64");
  const files = parseStoreZip(new Uint8Array(zipBytes));
  const kickoffEntry = files.find((f) => f.name === "KICKOFF.md");
  assert.ok(kickoffEntry, "KICKOFF.md must exist in the ZIP");
  const kickoff = new TextDecoder().decode(kickoffEntry.data);
  assert.match(kickoff, /Phase 0 — Preflight Contract/);
  assert.match(kickoff, /### 0\.1 Goal restate/);
  assert.match(kickoff, /Compound Mechanisms/);
  assert.match(kickoff, /Quality Gate/);
});

// ---------------------------------------------------------------------------
// 12. assemble_package respects tier="mvp" override in KICKOFF
// ---------------------------------------------------------------------------
test("assemble_package respects tier='mvp' override in KICKOFF", () => {
  const result = handleToolCall("assemble_package", {
    goal: "minimal cli",
    slugs: ["/ecc:tdd-guide"],
    tier: "mvp",
  }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const payload = JSON.parse(result.content[0].text);
  const zipBytes = Buffer.from(payload.base64zip, "base64");
  const files = parseStoreZip(new Uint8Array(zipBytes));
  const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
  assert.match(kickoff, /\*\*Tier:\*\* MVP/);
});

// ---------------------------------------------------------------------------
// 13. assemble_package inputSchema exposes tier/scenarioGate/debate
// ---------------------------------------------------------------------------
test("assemble_package inputSchema exposes tier/scenarioGate/debate as optional", () => {
  const tools = listTools();
  const assemble = tools.find((t) => t.name === "assemble_package");
  assert.ok(assemble, "assemble_package tool should be listed");
  const props = assemble.inputSchema.properties;
  assert.ok(props.tier, "tier should be in inputSchema");
  assert.ok(props.scenarioGate, "scenarioGate should be in inputSchema");
  assert.ok(props.debate, "debate should be in inputSchema");
  // None of the new fields are required (backwards-compatible)
  assert.deepEqual(assemble.inputSchema.required, ["goal", "slugs"]);
});

// ---------------------------------------------------------------------------
// 14. assemble_package ignores invalid tier (falls back to production default)
// ---------------------------------------------------------------------------
test("assemble_package falls back to production tier on invalid tier arg", () => {
  const result = handleToolCall("assemble_package", {
    goal: "x",
    slugs: ["/ecc:tdd-guide"],
    tier: "bogus-tier",
  }, CATALOG);
  assert.ok(!result.error, `should not error on invalid tier: ${result.error?.message}`);
  const payload = JSON.parse(result.content[0].text);
  const zipBytes = Buffer.from(payload.base64zip, "base64");
  const files = parseStoreZip(new Uint8Array(zipBytes));
  const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
  assert.match(kickoff, /\*\*Tier:\*\* Production/);
});

// ---------------------------------------------------------------------------
// 15. assemble_from_goal one-call: rank+select+package returns Phase 0 ZIP
// ---------------------------------------------------------------------------
test("assemble_from_goal ranks catalog and assembles a Phase 0 package in one call", () => {
  const result = handleToolCall("assemble_from_goal", {
    goal: "review python code security",
    limit: 3,
  }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const payload = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(payload.picked), "should return picked array");
  assert.ok(payload.picked.length > 0 && payload.picked.length <= 3, "picked length within limit");
  for (const p of payload.picked) {
    assert.ok(typeof p.slug === "string");
    assert.ok(typeof p.score === "number");
  }
  const zipBytes = Buffer.from(payload.base64zip, "base64");
  const files = parseStoreZip(new Uint8Array(zipBytes));
  const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
  assert.match(kickoff, /Phase 0 — Preflight Contract/);
  assert.match(kickoff, /### 0\.1 Goal restate/);
});

// ---------------------------------------------------------------------------
// 16. assemble_from_goal clamps limit and rejects missing goal
// ---------------------------------------------------------------------------
test("assemble_from_goal rejects missing goal with -32602", () => {
  const result = handleToolCall("assemble_from_goal", {}, CATALOG);
  assert.ok(result.error, "should return error");
  assert.equal(result.error.code, -32602);
});

test("assemble_from_goal returns -32603 when no items match the goal", () => {
  const result = handleToolCall("assemble_from_goal", {
    goal: "zzznosuchwordzzz qqqq",
  }, CATALOG);
  assert.ok(result.error, "should return error when nothing matches");
  assert.equal(result.error.code, -32603);
});

// ---------------------------------------------------------------------------
// 17. assemble_from_goal respects tier override
// ---------------------------------------------------------------------------
test("assemble_from_goal respects tier='cutting-edge' override", () => {
  const result = handleToolCall("assemble_from_goal", {
    goal: "review python code",
    tier: "cutting-edge",
    limit: 2,
  }, CATALOG);
  assert.ok(!result.error, `should not error: ${result.error?.message}`);
  const payload = JSON.parse(result.content[0].text);
  const zipBytes = Buffer.from(payload.base64zip, "base64");
  const files = parseStoreZip(new Uint8Array(zipBytes));
  const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
  assert.match(kickoff, /\*\*Tier:\*\* Cutting-edge/);
});
