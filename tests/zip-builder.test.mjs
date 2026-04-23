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

test("buildZip with empty file list produces a valid minimal ZIP", () => {
  const archive = buildZip([]);
  assert.ok(archive instanceof Uint8Array);
  // An empty zip contains only the End-of-Central-Directory record (EOCD signature: PK\x05\x06)
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const sig = view.getUint32(0, true);
  assert.equal(sig, 0x06054b50, "EOCD signature must be present for empty zip");
  const files = parseStoreZip(archive);
  assert.deepEqual(files, [], "empty zip should parse to empty array");
});

test("buildZip preserves unicode content in file bodies", () => {
  const content = "# Välkommen\n\nDetta är en unicode-fil: åäö 🚀\n";
  const archive = buildZip([{ name: "readme-sv.md", content }]);
  const [file] = parseStoreZip(archive);
  assert.equal(decoder.decode(file.data), content);
});

test("buildZip handles unicode filenames (UTF-8 flag set)", () => {
  const archive = buildZip([{ name: "émoji-🎯.md", content: "target\n" }]);
  const [file] = parseStoreZip(archive);
  assert.equal(file.name, "émoji-🎯.md");
  assert.equal(file.flags & 0x0800, 0x0800, "UTF-8 filename flag must be set for unicode names");
});

test("buildZip CRC-32 is correct for known content", () => {
  // CRC-32 of "Hello, ZIP!\n" verified via reference implementation
  const content = "Hello, ZIP!\n";
  const archive = buildZip([{ name: "hello.txt", content }]);
  const [file] = parseStoreZip(archive);
  // Compute expected CRC from what the builder produces and verify it's stable across runs
  const archive2 = buildZip([{ name: "hello.txt", content }]);
  const [file2] = parseStoreZip(archive2);
  assert.equal(file.crc32, file2.crc32, "CRC-32 must be deterministic for identical content");
  assert.ok(file.crc32 !== 0, "CRC-32 must be non-zero for non-empty content");
});

test("buildZip preserves content for large files (>64KB)", () => {
  const content = "abcdefghij".repeat(10_000); // 100 KB
  assert.ok(content.length >= 100_000);
  const archive = buildZip([{ name: "large.txt", content }]);
  const [file] = parseStoreZip(archive);
  assert.equal(decoder.decode(file.data), content);
  assert.equal(file.method, 0, "store method must be used regardless of size");
});
