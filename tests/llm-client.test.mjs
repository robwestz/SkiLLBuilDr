// tests/llm-client.test.mjs — node:test suite for llm-client.mjs
//
// Facts before edit:
// 1. Callers: test.sh (`node --test tests/*.test.mjs`), .github/workflows/test.yml (same glob)
// 2. No existing file serves the same purpose (confirmed by Glob: tests/llm-client* → no results)
// 3. Reads no data files — uses synthetic in-memory catalog: {slug, name, description, category}
// 4. User instruction verbatim: "create llm-client.mjs with provider-agnostic interface,
//    Groq implementation, and offline fallback"

import { test } from "node:test";
import assert from "node:assert/strict";
import { LLMClient } from "../llm-client.mjs";

// ---------------------------------------------------------------------------
// Mock fetch helper
// ---------------------------------------------------------------------------

function mockFetch(responseBody, status = 200) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  });
}

function mockFetchNetworkError() {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
}

// ---------------------------------------------------------------------------
// Test catalog — synthetic data only, shape: {slug, name, description, category}
// ---------------------------------------------------------------------------

const catalog = [
  {
    slug: "/ecc:python-reviewer",
    name: "python-reviewer",
    description: "Reviews Python code for quality",
    category: "Review",
  },
  {
    slug: "/ecc:go-reviewer",
    name: "go-reviewer",
    description: "Reviews Go code",
    category: "Review",
  },
  {
    slug: "/ecc:tdd-guide",
    name: "tdd-guide",
    description: "Test driven development guide",
    category: "Testing",
  },
  {
    slug: "/ecc:security-reviewer",
    name: "security-reviewer",
    description: "Security vulnerability detection",
    category: "Security",
  },
  {
    slug: "/ecc:planner",
    name: "planner",
    description: "Planning complex features",
    category: "Planning",
  },
];

// ---------------------------------------------------------------------------
// 1. LLMClient.create("offline") returns an instance
// ---------------------------------------------------------------------------
test('LLMClient.create("offline") returns an instance', () => {
  const client = LLMClient.create("offline");
  assert.ok(client, "should return a truthy object");
  assert.equal(typeof client.rankSkills, "function", "should have rankSkills");
  assert.equal(typeof client.buildPackageContext, "function", "should have buildPackageContext");
  assert.equal(typeof client.testConnection, "function", "should have testConnection");
});

// ---------------------------------------------------------------------------
// 2. LLMClient.create("groq", "key") returns an instance
// ---------------------------------------------------------------------------
test('LLMClient.create("groq", "key") returns an instance', () => {
  const client = LLMClient.create("groq", "test-key-abc");
  assert.ok(client, "should return a truthy object");
  assert.equal(typeof client.rankSkills, "function");
  assert.equal(typeof client.testConnection, "function");
});

// ---------------------------------------------------------------------------
// 3. LLMClient.create("unknown") throws
// ---------------------------------------------------------------------------
test('LLMClient.create("unknown") throws', () => {
  assert.throws(
    () => LLMClient.create("unknown"),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes("Unknown LLM provider"), `message was: ${err.message}`);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 4. Offline rankSkills returns array with score field
// ---------------------------------------------------------------------------
test("Offline rankSkills returns array with score field", async () => {
  const client = LLMClient.create("offline");
  const results = await client.rankSkills("review python code", catalog);
  assert.ok(Array.isArray(results), "should return an array");
  assert.ok(results.length > 0, "should return at least one result for matching query");
  for (const r of results) {
    assert.ok(typeof r.score === "number", `score should be a number, got ${r.score}`);
    assert.ok(typeof r.slug === "string", `slug should be a string`);
  }
});

// ---------------------------------------------------------------------------
// 5. Offline rankSkills: python-reviewer ranks in top 3 for "review python code"
// ---------------------------------------------------------------------------
test("Offline rankSkills: python-reviewer ranks in top 3 for 'review python code'", async () => {
  const client = LLMClient.create("offline");
  const results = await client.rankSkills("review python code", catalog);
  const top3Slugs = results.slice(0, 3).map((r) => r.slug);
  assert.ok(
    top3Slugs.includes("/ecc:python-reviewer"),
    `Expected python-reviewer in top 3, got: ${top3Slugs.join(", ")}`
  );
});

// ---------------------------------------------------------------------------
// 6. Offline rankSkills("") returns empty array
// ---------------------------------------------------------------------------
test("Offline rankSkills with empty goal returns empty array", async () => {
  const client = LLMClient.create("offline");
  const results = await client.rankSkills("", catalog);
  assert.deepEqual(results, []);
});

// ---------------------------------------------------------------------------
// 7. Offline rankSkills(goal, []) returns empty array
// ---------------------------------------------------------------------------
test("Offline rankSkills with empty catalog returns empty array", async () => {
  const client = LLMClient.create("offline");
  const results = await client.rankSkills("review python code", []);
  assert.deepEqual(results, []);
});

// ---------------------------------------------------------------------------
// 8. Offline testConnection returns {ok: true, model: "offline-idf"}
// ---------------------------------------------------------------------------
test("Offline testConnection returns {ok: true, model: 'offline-idf'}", async () => {
  const client = LLMClient.create("offline");
  const result = await client.testConnection();
  assert.equal(result.ok, true);
  assert.equal(result.model, "offline-idf");
  assert.equal(result.latencyMs, 0);
});

// ---------------------------------------------------------------------------
// 9. Groq rankSkills — mock valid ranked JSON → result has slug/score/reason
// ---------------------------------------------------------------------------
test("Groq rankSkills with valid mock response returns slug/score/reason fields", async () => {
  mockFetch({
    choices: [
      {
        message: {
          content: JSON.stringify({
            ranked: [
              {
                slug: "/ecc:python-reviewer",
                score: 92,
                reason: "python-reviewer CAUSES static analysis of Python code which goal REQUIRES",
                confidence: "high",
              },
            ],
          }),
        },
      },
    ],
  });

  const client = LLMClient.create("groq", "test-key");
  const results = await client.rankSkills("review python code", catalog);
  assert.ok(Array.isArray(results));
  assert.ok(results.length > 0, "should return results");
  const first = results[0];
  assert.ok(typeof first.slug === "string", "slug should be string");
  assert.ok(typeof first.score === "number", "score should be number");
  assert.ok(typeof first.reason === "string", "reason should be string");
});

// ---------------------------------------------------------------------------
// 10. Groq rankSkills — mock 401 → throws "Invalid API key"
// ---------------------------------------------------------------------------
test("Groq rankSkills with 401 throws Invalid API key error", async () => {
  mockFetch({}, 401);
  const client = LLMClient.create("groq", "bad-key");
  await assert.rejects(
    () => client.rankSkills("review python", catalog),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes("invalid api key"),
        `message was: ${err.message}`
      );
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 11. Groq rankSkills — mock 429 → throws "Rate limit"
// ---------------------------------------------------------------------------
test("Groq rankSkills with 429 throws Rate limit error", async () => {
  mockFetch({}, 429);
  const client = LLMClient.create("groq", "test-key");
  await assert.rejects(
    () => client.rankSkills("review python", catalog),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes("rate limit"),
        `message was: ${err.message}`
      );
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 12. Groq rankSkills — mock returns malformed JSON → throws parse error
// ---------------------------------------------------------------------------
test("Groq rankSkills with malformed JSON in response throws parse error", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      choices: [
        {
          message: {
            content: "this is not json at all {{{",
          },
        },
      ],
    }),
    text: async () => "...",
  });

  const client = LLMClient.create("groq", "test-key");
  await assert.rejects(
    () => client.rankSkills("review python", catalog),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes("not valid json"),
        `message was: ${err.message}`
      );
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 13. Groq rankSkills — valid JSON but `ranked` field missing → throws or returns []
// ---------------------------------------------------------------------------
test("Groq rankSkills with valid JSON missing 'ranked' field throws or returns empty", async () => {
  mockFetch({
    choices: [
      {
        message: {
          content: JSON.stringify({ something_else: [{ slug: "/ecc:python-reviewer" }] }),
        },
      },
    ],
  });

  const client = LLMClient.create("groq", "test-key");
  let threw = false;
  let result;
  try {
    result = await client.rankSkills("review python", catalog);
  } catch (err) {
    threw = true;
    assert.ok(err instanceof Error, "thrown value should be an Error");
  }
  if (!threw) {
    assert.ok(Array.isArray(result), "if not throwing, should return an array");
  }
});

// ---------------------------------------------------------------------------
// 14. Groq testConnection — mock 200 → returns {ok: true}
// ---------------------------------------------------------------------------
test("Groq testConnection with mock 200 returns {ok: true}", async () => {
  mockFetch({ data: [{ id: "llama3-8b-8192" }] }, 200);
  const client = LLMClient.create("groq", "test-key");
  const result = await client.testConnection();
  assert.equal(result.ok, true);
  assert.ok(typeof result.latencyMs === "number");
});

// ---------------------------------------------------------------------------
// 15. Groq testConnection — mock 401 → returns {ok: false}
// ---------------------------------------------------------------------------
test("Groq testConnection with mock 401 returns {ok: false}", async () => {
  mockFetch({}, 401);
  const client = LLMClient.create("groq", "bad-key");
  const result = await client.testConnection();
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// 16. Groq buildPackageContext — mock valid JSON → result has firstMoves array
// ---------------------------------------------------------------------------
test("Groq buildPackageContext with valid mock response returns firstMoves array", async () => {
  mockFetch({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "A CLI tool for reviewing Python code.",
            risks: ["No error handling", "Missing tests"],
            firstMoves: [
              "Define CLI entry point",
              "Write first failing test",
              "Activate python-reviewer",
            ],
            estimatedHours: 8,
          }),
        },
      },
    ],
  });

  const client = LLMClient.create("groq", "test-key");
  const result = await client.buildPackageContext(
    "build a CLI tool to review python code",
    "A tool that reviews Python files",
    [catalog[0]]
  );
  assert.ok(Array.isArray(result.firstMoves), "firstMoves should be an array");
  assert.ok(result.firstMoves.length >= 1, "should have at least one first move");
  assert.ok(typeof result.summary === "string", "summary should be a string");
});

// ---------------------------------------------------------------------------
// 17. Offline buildPackageContext("build a CLI tool", ...) → firstMoves has >= 1 string
// ---------------------------------------------------------------------------
test("Offline buildPackageContext returns firstMoves with at least 1 string", async () => {
  const client = LLMClient.create("offline");
  const result = await client.buildPackageContext(
    "build a CLI tool",
    "A command-line tool",
    [catalog[0]]
  );
  assert.ok(Array.isArray(result.firstMoves), "firstMoves should be an array");
  assert.ok(result.firstMoves.length >= 1, "should have at least one first move");
  assert.ok(
    typeof result.firstMoves[0] === "string",
    `first move should be a string, got: ${typeof result.firstMoves[0]}`
  );
});

// ---------------------------------------------------------------------------
// 18. API key is never included in thrown error messages (security check)
// ---------------------------------------------------------------------------
test("API key is never included in thrown error messages", async () => {
  const secretKey = "sk-super-secret-key-12345-do-not-leak";

  // Test 401 path
  mockFetch({}, 401);
  const client = LLMClient.create("groq", secretKey);
  try {
    await client.rankSkills("test goal", catalog);
    assert.fail("Should have thrown on 401");
  } catch (err) {
    assert.ok(!err.message.includes(secretKey), `API key leaked in 401 error: "${err.message}"`);
  }

  // Test 429 path
  mockFetch({}, 429);
  try {
    await client.rankSkills("test goal", catalog);
    assert.fail("Should have thrown on 429");
  } catch (err) {
    assert.ok(!err.message.includes(secretKey), `API key leaked in 429 error: "${err.message}"`);
  }

  // Test network error path
  mockFetchNetworkError();
  try {
    await client.rankSkills("test goal", catalog);
    assert.fail("Should have thrown on network error");
  } catch (err) {
    assert.ok(
      !err.message.includes(secretKey),
      `API key leaked in network error: "${err.message}"`
    );
  }
});
