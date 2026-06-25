#!/usr/bin/env node
// validate_artifact_cards.mjs — dependency-free Node validator for Artifact
// Intent Cards (AICs). Enforces references/artifact_intent_card_standard.md.
//
// Usage:   node validate_artifact_cards.mjs <path/to/artifact_intent_cards.yaml>
// Exit 0:  every card is VALID. Exit 1: at least one INVALID card (or read error).
//
// No third-party dependencies (repo policy: zero runtime deps). A small
// line-oriented parser is sufficient because the standard keeps cards flat.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED_FIELDS = [
  'artifact_name',
  'artifact_path',
  'artifact_type',
  'why_this_artifact_must_exist',
  'problem_it_prevents',
  'future_artifact_or_workflow_it_enables',
  'intended_consumer',
  'required_inputs',
  'expected_outputs',
  'interface_contract',
  'definition_of_done',
  'validation_method',
  'failure_modes',
  'what_should_not_be_included',
  'assumptions',
  'downstream_snowball_effect',
];

export const ARTIFACT_TYPES = [
  'skill', 'doc', 'script', 'schema', 'template',
  'reference', 'test', 'config', 'example', 'other',
];

export const CONSUMERS = [
  'human', 'Claude', 'future_agent', 'future_skill',
  'validation_script', 'CLI_workflow', 'test_runner',
];

// Placeholders that are never an acceptable value for a required field.
const PLACEHOLDERS = ['todo', 'tbd', '???', 'seems reasonable', 'figure out later', 'fixme', 'xxx'];

// Generic snowball claims that fail the "name a specific artifact/workflow" rule.
const GENERIC_SNOWBALL = ['makes things better', 'improves quality', 'better quality', 'general improvement'];

function stripInlineComment(value) {
  const i = value.indexOf(' #');
  return (i === -1 ? value : value.slice(0, i)).trim();
}

// Parse a multi-document AIC YAML file into an array of flat card objects.
// Each `---` on its own line starts a new card.
export function parseCards(text) {
  const cards = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (trimmed === '---') {
      if (current) cards.push(current);
      current = {};
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):(.*)$/);
    if (!m) continue; // ignore non key:value lines (free prose, list items)
    if (!current) current = {};
    const key = m[1];
    const value = stripInlineComment(m[2].trim());
    current[key] = value;
  }
  if (current && Object.keys(current).length > 0) cards.push(current);
  return cards;
}

function parseList(value) {
  const inner = value.replace(/^\[/, '').replace(/\]$/, '');
  return inner.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

// Returns an array of human-readable error strings for one card (empty = VALID).
export function validateCard(card) {
  const errors = [];
  const label = card.artifact_name || card.artifact_path || '<unnamed card>';

  for (const field of REQUIRED_FIELDS) {
    const v = card[field];
    if (v === undefined || v === '') {
      errors.push(`${label}: missing required field: ${field}`);
      continue;
    }
    const lv = v.toLowerCase();
    if (PLACEHOLDERS.some((p) => lv === p || lv.startsWith(p + ' ') || lv.startsWith(p + ':'))) {
      errors.push(`${label}: placeholder in required field: ${field}`);
    }
  }

  if (card.artifact_type !== undefined && card.artifact_type !== '') {
    if (!ARTIFACT_TYPES.includes(card.artifact_type)) {
      errors.push(`${label}: artifact_type not in enum: ${card.artifact_type}`);
    }
  }

  if (card.intended_consumer !== undefined && card.intended_consumer !== '') {
    const v = card.intended_consumer;
    if (!v.startsWith('[')) {
      errors.push(`${label}: intended_consumer must be a list, got: ${v}`);
    } else {
      const items = parseList(v);
      if (items.length === 0) {
        errors.push(`${label}: intended_consumer is an empty list`);
      }
      for (const item of items) {
        if (!CONSUMERS.includes(item)) {
          errors.push(`${label}: intended_consumer not in enum: ${item}`);
        }
      }
    }
  }

  const snow = card.downstream_snowball_effect;
  if (snow && GENERIC_SNOWBALL.some((g) => snow.toLowerCase().includes(g))) {
    errors.push(`${label}: downstream_snowball_effect is generic (name a specific artifact/workflow)`);
  }

  return errors;
}

// Validate a whole file. Returns { cards, errors }.
export function validateCardsFile(path) {
  const text = readFileSync(path, 'utf8');
  const cards = parseCards(text);
  const errors = [];
  if (cards.length === 0) {
    errors.push(`${path}: no Artifact Intent Cards found`);
  }
  for (const card of cards) errors.push(...validateCard(card));
  return { cards, errors };
}

function main(argv) {
  const path = argv[2];
  if (!path) {
    console.error('usage: validate_artifact_cards.mjs <artifact_intent_cards.yaml>');
    return 2;
  }
  let result;
  try {
    result = validateCardsFile(path);
  } catch (err) {
    console.error(`ERROR: cannot read ${path}: ${err.message}`);
    return 1;
  }
  if (result.errors.length === 0) {
    console.log(`PASS: ${result.cards.length} Artifact Intent Card(s) valid in ${path}`);
    return 0;
  }
  console.error(`FAIL: ${result.errors.length} problem(s) in ${path}`);
  for (const e of result.errors) console.error(`  - ${e}`);
  return 1;
}

// Run as CLI only when invoked directly (not when imported by another module).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv));
}
