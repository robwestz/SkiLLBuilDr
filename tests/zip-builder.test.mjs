import { test } from "node:test";
import assert from "node:assert/strict";

import { buildZip, parseStoreZip } from "../zip-builder.mjs";

const decoder = new TextDecoder();

test("buildZip creates a readable store-only archive with nested paths", () => {
  const archive = buildZip([
    { name: "KICKOFF.md", content: "# Kickoff\n\nHello world.\n" },
    { name: "CLAUDE.md", content: "## Skills\n- `/agents:test`\n" },
    { name: "workflows/demo.yaml", content: "name: demo\nprovider: claude\n" },
  ]);

  assert.ok(archive instanceof Uint8Array);
  assert.ok(archive.length > 100, "zip output should be non-trivial");

  const files = parseStoreZip(archive);
  assert.deepEqual(
    files.map((file) => file.name),
    ["KICKOFF.md", "CLAUDE.md", "workflows/demo.yaml"]
  );
  assert.equal(files[0].method, 0, "zip builder should use store method");
  assert.match(decoder.decode(files[0].data), /Kickoff/);
  assert.match(decoder.decode(files[2].data), /provider: claude/);
});

test("buildZip normalizes slashes and keeps UTF-8 flag enabled", () => {
  const archive = buildZip([
    { name: "workflows\\nested\\plan.yaml", content: "ok: true\n" },
  ]);
  const [file] = parseStoreZip(archive);
  assert.equal(file.name, "workflows/nested/plan.yaml");
  assert.equal(file.flags & 0x0800, 0x0800, "UTF-8 filename flag must be enabled");
});
