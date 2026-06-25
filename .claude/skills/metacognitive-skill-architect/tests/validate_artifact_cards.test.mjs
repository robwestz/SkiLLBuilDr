import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCards,
  validateCard,
  validateCardsFile,
  REQUIRED_FIELDS,
} from '../scripts/validate_artifact_cards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const valid = join(here, 'fixtures', 'valid_skill_package', 'artifact_intent_cards.yaml');
const invalid = join(here, 'fixtures', 'invalid_skill_package', 'artifact_intent_cards.yaml');

test('valid fixture cards all pass', () => {
  const { cards, errors } = validateCardsFile(valid);
  assert.equal(cards.length, 2);
  assert.deepEqual(errors, []);
});

test('invalid fixture flags the TODO placeholder', () => {
  const { errors } = validateCardsFile(invalid);
  assert.ok(errors.length >= 1);
  assert.ok(errors.some((e) => /placeholder in required field: why_this_artifact_must_exist/.test(e)));
});

test('parseCards splits documents on ---', () => {
  const cards = parseCards('---\nartifact_name: a\n---\nartifact_name: b\n');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].artifact_name, 'a');
  assert.equal(cards[1].artifact_name, 'b');
});

test('missing required field is reported', () => {
  const card = { artifact_name: 'x' };
  const errors = validateCard(card);
  // one error per missing required field except artifact_name which is present.
  assert.equal(errors.length, REQUIRED_FIELDS.length - 1);
});

test('artifact_type must be in enum', () => {
  const base = fullCard();
  base.artifact_type = 'widget';
  assert.ok(validateCard(base).some((e) => /artifact_type not in enum/.test(e)));
});

test('intended_consumer must be a list of enum values', () => {
  const notList = fullCard();
  notList.intended_consumer = 'everyone';
  assert.ok(validateCard(notList).some((e) => /intended_consumer must be a list/.test(e)));

  const badItem = fullCard();
  badItem.intended_consumer = '[human, everyone]';
  assert.ok(validateCard(badItem).some((e) => /intended_consumer not in enum: everyone/.test(e)));
});

test('generic snowball claim is rejected', () => {
  const card = fullCard();
  card.downstream_snowball_effect = 'makes things better';
  assert.ok(validateCard(card).some((e) => /downstream_snowball_effect is generic/.test(e)));
});

test('a fully filled card is valid', () => {
  assert.deepEqual(validateCard(fullCard()), []);
});

function fullCard() {
  const c = {};
  for (const f of REQUIRED_FIELDS) c[f] = 'a concrete, specific value';
  c.artifact_type = 'reference';
  c.intended_consumer = '[human, future_agent]';
  c.downstream_snowball_effect = 'enables validate_skill_package.mjs to assert parity';
  return c;
}
