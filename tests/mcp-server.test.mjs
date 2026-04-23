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
test("listTools returns array of 5 tool definitions", () => {
  const tools = listTools();
  assert.ok(Array.isArray(tools), "listTools should return an array");
  assert.equal(tools.length, 5, "should have exactly 5 tools");
  for (const t of tools) {
    assert.ok(typeof t.name === "string", "each tool should have a name");
    assert.ok(typeof t.description === "string", "each tool should have a description");
    assert.ok(t.inputSchema && typeof t.inputSchema === "object", "each tool should have inputSchema");
  }
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
