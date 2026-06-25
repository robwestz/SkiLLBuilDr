import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackage, parseManifest } from '../scripts/validate_skill_package.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const valid = join(here, 'fixtures', 'valid_skill_package');
const invalid = join(here, 'fixtures', 'invalid_skill_package');
const skillRoot = join(here, '..');

test('valid fixture package passes every gate', () => {
  const { errors } = validatePackage(valid);
  assert.deepEqual(errors, []);
});

test('the skill package validates itself (dogfood)', () => {
  const { errors } = validatePackage(skillRoot);
  assert.deepEqual(errors, []);
});

test('invalid fixture fails on the six named dimensions', () => {
  const { errors } = validatePackage(invalid);
  const joined = errors.join('\n');
  assert.match(joined, /description exceeds 200 chars/);
  assert.match(joined, /missing required heading: Steps/);
  assert.match(joined, /missing required heading: Validation/);
  assert.match(joined, /orphan file not in manifest: helpers\.mjs/);
  assert.match(joined, /phantom file in manifest: references\/notes\.md/);
  assert.match(joined, /placeholder in required field: why_this_artifact_must_exist/);
  assert.match(joined, /file without Artifact Intent Card: helpers\.mjs/);
});

test('parseManifest reads block and inline lists plus cards pointer', () => {
  const text = [
    'files:',
    '  required:',
    '    - SKILL.md',
    '  references: [a.md, b.md]',
    'artifact_intent_cards: artifact_intent_cards.yaml',
  ].join('\n');
  const { files, cardsFile } = parseManifest(text);
  assert.ok(files.has('SKILL.md'));
  assert.ok(files.has('a.md'));
  assert.ok(files.has('b.md'));
  assert.equal(cardsFile, 'artifact_intent_cards.yaml');
});
