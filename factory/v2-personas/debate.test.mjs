import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DebateConfigError,
  normalizeDebateConfig,
  readJsonFile,
  runDebate,
  validateDebateConfig,
} from './debate.mjs';

test('validateDebateConfig rejects incomplete configs', () => {
  const errors = validateDebateConfig({ personas: [] });

  assert.match(errors.join('\n'), /at least 2 persona specs/);
});

test('normalizeDebateConfig rejects duplicate persona ids and invalid thresholds', () => {
  assert.throws(
    () =>
      normalizeDebateConfig({
        personas: [
          persona({ id: 'same', escalationThreshold: 1.1 }),
          persona({ id: 'same' }),
        ],
      }),
    DebateConfigError,
  );
});

test('runDebate accepts an N-persona config and returns a decision artifact', async () => {
  const config = await readJsonFile(new URL('./examples/memory-architect.config.json', import.meta.url));
  const proposal = await readJsonFile(new URL('./examples/memory-batch.proposal.json', import.meta.url));

  const result = await runDebate(config, proposal, { now: '2026-04-25T00:00:00.000Z' });

  assert.equal(result.schema, 'v2-personas.decision.v1');
  assert.equal(result.status, 'accepted');
  assert.equal(result.selectedOption, 'approve');
  assert.equal(result.rounds.length, 3);
  assert.equal(result.personas.length, 3);
  assert.equal(result.consensus.blockedBy.length, 0);
});

test('runDebate escalates when a weighted persona lacks confidence', async () => {
  const config = {
    name: 'Escalation gate',
    debate: { rounds: 1, consensusThreshold: 0.6, requireAllConfident: true },
    personas: [
      persona({ id: 'risk', weight: 2, escalationThreshold: 0.9 }),
      persona({ id: 'builder', escalationThreshold: 0.4 }),
    ],
  };
  const proposal = { title: 'Sparse proposal', signals: { ready: 'unknown' } };

  const result = await runDebate(config, proposal);

  assert.equal(result.status, 'escalated');
  assert.equal(result.selectedOption, 'escalate');
  assert.deepEqual(result.consensus.blockedBy, ['risk']);
});

test('runDebate returns no_consensus when threshold is deliberately unreachable', async () => {
  const config = {
    name: 'High threshold',
    debate: { rounds: 1, consensusThreshold: 0.99, minimumMargin: 0.01, requireAllConfident: false },
    personas: [persona({ id: 'a' }), persona({ id: 'b' })],
  };

  const result = await runDebate(config, { title: 'Good but not unanimous', signals: { ready: 'pass' } });

  assert.equal(result.status, 'no_consensus');
  assert.equal(result.selectedOption, 'escalate');
});

function persona(overrides = {}) {
  return {
    id: overrides.id ?? 'persona',
    name: overrides.name ?? 'Persona',
    role: overrides.role ?? 'Reviews the proposal.',
    systemPrompt: overrides.systemPrompt ?? 'Review the proposal against criteria.',
    weight: overrides.weight ?? 1,
    escalationThreshold: overrides.escalationThreshold ?? 0.5,
    criteria: overrides.criteria ?? [{ id: 'ready', question: 'Is it ready?', weight: 1 }],
  };
}
