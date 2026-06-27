// Tests for the deterministic core of the session-kickoff orchestrator.
// Run: node --test .claude/skills/session-kickoff-orchestrator/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  declaredDependencies,
  lockedPackages,
  detectLockfileDrift,
  parsePorcelain,
  parseRevisitAssumptions,
  parseOpenTasks,
  renderCard,
} from '../scripts/kickoff.mjs';

const PKG = JSON.stringify({
  dependencies: { '@xenova/transformers': '2.17.2', left: '1.0.0' },
  devDependencies: { tap: '18.0.0' },
});

const LOCK_IN_SYNC = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    '': {},
    'node_modules/@xenova/transformers': { version: '2.17.2' },
    'node_modules/left': { version: '1.0.0' },
    'node_modules/tap': { version: '18.0.0' },
  },
});

const LOCK_DRIFTED = JSON.stringify({
  lockfileVersion: 3,
  packages: { '': {}, 'node_modules/left': { version: '1.0.0' }, 'node_modules/tap': { version: '18.0.0' } },
});

test('declaredDependencies merges deps, devDeps, optionalDeps', () => {
  assert.deepEqual(declaredDependencies(PKG).sort(), ['@xenova/transformers', 'left', 'tap']);
});

test('declaredDependencies tolerates malformed json', () => {
  assert.deepEqual(declaredDependencies('{ not json'), []);
});

test('lockedPackages reads scoped and unscoped node_modules keys', () => {
  const s = lockedPackages(LOCK_IN_SYNC);
  assert.ok(s.has('@xenova/transformers'));
  assert.ok(s.has('left'));
  assert.ok(!s.has(''));
});

test('detectLockfileDrift reports a clean lockfile as in sync', () => {
  const d = detectLockfileDrift(PKG, LOCK_IN_SYNC);
  assert.equal(d.inSync, true);
  assert.deepEqual(d.missing, []);
  assert.equal(d.declaredCount, 3);
});

test('detectLockfileDrift catches the @xenova/transformers e2e failure', () => {
  const d = detectLockfileDrift(PKG, LOCK_DRIFTED);
  assert.equal(d.inSync, false);
  assert.deepEqual(d.missing, ['@xenova/transformers']);
});

test('detectLockfileDrift flags an absent lockfile (with deps) as drift, not GREEN', () => {
  const d = detectLockfileDrift(PKG, null);
  assert.equal(d.noLockfile, true);
  assert.equal(d.inSync, false);
  assert.equal(d.declaredCount, 3);
});

test('detectLockfileDrift with no deps and no lockfile is in sync', () => {
  const d = detectLockfileDrift('{}', null);
  assert.equal(d.noLockfile, true);
  assert.equal(d.inSync, true);
});

test('renderCard reports a MISSING lockfile and ATTENTION', () => {
  const card = renderCard({
    timestamp: '2026-01-01T00:00:00.000Z',
    branch: 'main',
    drift: detectLockfileDrift(PKG, null),
    tree: parsePorcelain(''),
    contracts: [{ path: 'CLAUDE.md', present: true }],
    openTasks: [],
    revisit: [],
    recentCommits: [],
  });
  assert.match(card, /health: \*\*ATTENTION\*\*/);
  assert.match(card, /lockfile: \*\*MISSING\*\*/);
});

test('parsePorcelain distinguishes clean from dirty', () => {
  assert.equal(parsePorcelain('').dirty, false);
  const dirty = parsePorcelain(' M a.js\n?? b.js\n');
  assert.equal(dirty.dirty, true);
  assert.equal(dirty.count, 2);
});

test('parseRevisitAssumptions extracts only flagged table rows, skipping prose/headers', () => {
  const md = [
    '# ASSUMPTIONS',
    '| # | assumption | status | affects |',
    '|---|------------|--------|---------|',
    '| A1 | uses node test | revisit_required | validation |',
    '| A2 | locked choice | locked | n/a |',
    'plain revisit_required note',
  ].join('\n');
  const r = parseRevisitAssumptions(md);
  assert.equal(r.length, 1);
  assert.equal(r[0], 'A1: uses node test');
});

test('parseOpenTasks filters out done/completed/closed and reads goal/state', () => {
  const text = JSON.stringify({
    tasks: [
      { id: 1, title: 'open one', status: 'in_progress' },
      { id: 2, title: 'finished', status: 'done' },
      { id: 3, title: 'shipped', status: 'completed' },
      { id: 4, title: 'todo' },
      { id: 5, goal: 'ledger task', state: 'parked' },
      { id: 6, goal: 'shipped ledger', state: 'done' },
    ],
  });
  const open = parseOpenTasks(text);
  assert.deepEqual(open.map((t) => t.id), ['1', '4', '5']);
  const five = open.find((t) => t.id === '5');
  assert.equal(five.title, 'ledger task');
  assert.equal(five.status, 'parked');
});

test('parseOpenTasks tolerates a bare array and bad json', () => {
  assert.equal(parseOpenTasks('[{"id":9,"title":"x","status":"open"}]').length, 1);
  assert.deepEqual(parseOpenTasks('nope'), []);
});

test('renderCard marks ATTENTION and lists drift when lockfile drifted', () => {
  const card = renderCard({
    timestamp: '2026-01-01T00:00:00.000Z',
    branch: 'main',
    drift: detectLockfileDrift(PKG, LOCK_DRIFTED),
    tree: parsePorcelain(''),
    contracts: [{ path: 'CLAUDE.md', present: true }],
    openTasks: [],
    revisit: [],
    recentCommits: ['abc init'],
  });
  assert.match(card, /health: \*\*ATTENTION\*\*/);
  assert.match(card, /@xenova\/transformers/);
  assert.match(card, /Session Intent Card/);
});

test('renderCard marks GREEN when everything is healthy', () => {
  const card = renderCard({
    timestamp: '2026-01-01T00:00:00.000Z',
    branch: 'main',
    drift: detectLockfileDrift(PKG, LOCK_IN_SYNC),
    tree: parsePorcelain(''),
    contracts: [{ path: 'CLAUDE.md', present: true }],
    openTasks: [{ id: '1', title: 'do thing', status: 'open' }],
    revisit: [],
    recentCommits: [],
    previousCard: '.agents/kickoffs/prev-kickoff.md',
  });
  assert.match(card, /health: \*\*GREEN\*\*/);
  assert.match(card, /previous card/);
});
