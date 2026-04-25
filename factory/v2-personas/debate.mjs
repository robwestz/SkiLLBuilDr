import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OPTIONS = [
  { id: 'approve', label: 'Approve' },
  { id: 'revise', label: 'Revise' },
  { id: 'escalate', label: 'Escalate' },
];

const DEFAULT_DEBATE = {
  rounds: 2,
  consensusThreshold: 0.66,
  minimumMargin: 0.05,
  requireAllConfident: true,
};

export class DebateConfigError extends Error {
  constructor(errors) {
    super(`Invalid debate config:\n- ${errors.join('\n- ')}`);
    this.name = 'DebateConfigError';
    this.errors = errors;
  }
}

export function validateDebateConfig(config) {
  const errors = [];

  if (!isPlainObject(config)) {
    return ['config must be an object'];
  }

  if (!Array.isArray(config.personas) || config.personas.length < 2) {
    errors.push('personas must contain at least 2 persona specs');
  }

  const ids = new Set();
  for (const [index, persona] of (config.personas ?? []).entries()) {
    const prefix = `personas[${index}]`;
    if (!isPlainObject(persona)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (!nonEmptyString(persona.id)) errors.push(`${prefix}.id is required`);
    if (!nonEmptyString(persona.name)) errors.push(`${prefix}.name is required`);
    if (!nonEmptyString(persona.role)) errors.push(`${prefix}.role is required`);
    if (!nonEmptyString(persona.systemPrompt)) errors.push(`${prefix}.systemPrompt is required`);
    if (ids.has(persona.id)) errors.push(`${prefix}.id duplicates "${persona.id}"`);
    ids.add(persona.id);
    if (!validPositiveNumber(persona.weight)) errors.push(`${prefix}.weight must be a positive number`);
    if (!validScore(persona.escalationThreshold)) {
      errors.push(`${prefix}.escalationThreshold must be between 0 and 1`);
    }
    if (!Array.isArray(persona.criteria) || persona.criteria.length === 0) {
      errors.push(`${prefix}.criteria must contain at least 1 criterion`);
    }
    for (const [criterionIndex, criterion] of (persona.criteria ?? []).entries()) {
      const criterionPrefix = `${prefix}.criteria[${criterionIndex}]`;
      if (!isPlainObject(criterion)) {
        errors.push(`${criterionPrefix} must be an object`);
        continue;
      }
      if (!nonEmptyString(criterion.id)) errors.push(`${criterionPrefix}.id is required`);
      if (!nonEmptyString(criterion.question)) errors.push(`${criterionPrefix}.question is required`);
      if (!validPositiveNumber(criterion.weight)) {
        errors.push(`${criterionPrefix}.weight must be a positive number`);
      }
    }
  }

  if (config.debate !== undefined && !isPlainObject(config.debate)) {
    errors.push('debate must be an object when provided');
  }
  if (config.debate?.rounds !== undefined && !Number.isInteger(config.debate.rounds)) {
    errors.push('debate.rounds must be an integer');
  }
  if (config.debate?.rounds !== undefined && config.debate.rounds < 1) {
    errors.push('debate.rounds must be >= 1');
  }
  if (config.debate?.consensusThreshold !== undefined && !validScore(config.debate.consensusThreshold)) {
    errors.push('debate.consensusThreshold must be between 0 and 1');
  }
  if (config.debate?.minimumMargin !== undefined && !validScore(config.debate.minimumMargin)) {
    errors.push('debate.minimumMargin must be between 0 and 1');
  }

  return errors;
}

export function normalizeDebateConfig(config) {
  const errors = validateDebateConfig(config);
  if (errors.length > 0) {
    throw new DebateConfigError(errors);
  }

  const debate = { ...DEFAULT_DEBATE, ...(config.debate ?? {}) };
  const options = normalizeOptions(config.decision?.options ?? DEFAULT_OPTIONS);

  return {
    schema: config.schema ?? 'v2-personas.config.v1',
    name: config.name ?? 'Unnamed debate',
    decision: {
      question: config.decision?.question ?? 'Which option should be selected?',
      options,
    },
    debate,
    personas: config.personas.map((persona) => ({
      ...persona,
      criteria: persona.criteria.map((criterion) => ({ ...criterion })),
    })),
  };
}

export async function runDebate(configInput, proposalInput = {}, options = {}) {
  const config = normalizeDebateConfig(configInput);
  const proposal = normalizeProposal(proposalInput, config);
  const responder = options.responder ?? createDeterministicResponder();
  const rounds = [];
  let priorAggregate = null;

  for (let roundNumber = 1; roundNumber <= config.debate.rounds; roundNumber += 1) {
    const responses = [];
    for (const persona of config.personas) {
      const response = await responder({
        config,
        proposal,
        persona,
        round: roundNumber,
        priorAggregate,
        options: config.decision.options,
      });
      responses.push(normalizePersonaResponse(response, persona, config.decision.options));
    }
    const aggregate = aggregateResponses(config, responses);
    rounds.push({ round: roundNumber, responses, aggregate });
    priorAggregate = aggregate;
  }

  const finalAggregate = rounds.at(-1).aggregate;
  const decision = decide(config, finalAggregate);

  return {
    schema: 'v2-personas.decision.v1',
    decisionId: stableDecisionId(config, proposal),
    createdAt: options.now ?? new Date().toISOString(),
    configName: config.name,
    question: proposal.question,
    selectedOption: decision.selectedOption,
    status: decision.status,
    consensus: {
      ...decision.consensus,
      rounds: config.debate.rounds,
      threshold: config.debate.consensusThreshold,
      minimumMargin: config.debate.minimumMargin,
    },
    personas: config.personas.map((persona) => ({
      id: persona.id,
      name: persona.name,
      role: persona.role,
      weight: persona.weight,
      escalationThreshold: persona.escalationThreshold,
    })),
    rounds,
    proposal: {
      title: proposal.title,
      signals: proposal.signals,
    },
  };
}

export function createDeterministicResponder() {
  return ({ persona, proposal, round, priorAggregate, options }) => {
    const criterionStates = persona.criteria.map((criterion) => ({
      id: criterion.id,
      state: signalState(proposal.signals[criterion.id]),
      weight: criterion.weight,
    }));

    const totalWeight = criterionStates.reduce((sum, criterion) => sum + criterion.weight, 0);
    const passWeight = criterionStates
      .filter((criterion) => criterion.state === 'pass')
      .reduce((sum, criterion) => sum + criterion.weight, 0);
    const failWeight = criterionStates
      .filter((criterion) => criterion.state === 'fail')
      .reduce((sum, criterion) => sum + criterion.weight, 0);
    const unknownWeight = Math.max(0, totalWeight - passWeight - failWeight);
    const readiness = totalWeight === 0 ? 0.5 : clamp((passWeight + 0.35 * unknownWeight) / totalWeight);
    const uncertainty = totalWeight === 0 ? 0.5 : clamp((unknownWeight + failWeight * 0.5) / totalWeight);
    const confidence = clamp(0.62 + Math.abs(readiness - 0.5) * 0.5 - unknownWeight / Math.max(totalWeight, 1) * 0.25);

    const optionScores = {};
    for (const option of options) {
      const base = scoreOption(option.id, readiness, uncertainty);
      const priorNudge = priorAggregate?.scores?.[option.id] === undefined ? 0 : (priorAggregate.scores[option.id] - 0.5) * 0.06;
      optionScores[option.id] = clamp(base + priorNudge + (round - 1) * 0.01);
    }

    const recommendation = topOption(optionScores).id;
    const failedCriteria = criterionStates.filter((criterion) => criterion.state === 'fail').map((criterion) => criterion.id);

    return {
      personaId: persona.id,
      recommendation,
      optionScores,
      confidence,
      rationale: `${persona.name} weights ${formatPercent(readiness)} readiness across ${persona.criteria.length} criteria.`,
      risks: failedCriteria.length === 0 ? [] : failedCriteria.map((id) => `criterion failed: ${id}`),
      escalate: confidence < persona.escalationThreshold,
    };
  };
}

export async function readJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function aggregateResponses(config, responses) {
  const optionIds = config.decision.options.map((option) => option.id);
  const scores = Object.fromEntries(optionIds.map((id) => [id, 0]));
  const totalWeight = config.personas.reduce((sum, persona) => sum + persona.weight, 0);
  let weightedConfidence = 0;
  const escalations = [];

  for (const response of responses) {
    const persona = config.personas.find((candidate) => candidate.id === response.personaId);
    for (const optionId of optionIds) {
      scores[optionId] += (response.optionScores[optionId] ?? 0) * persona.weight;
    }
    weightedConfidence += response.confidence * persona.weight;
    if (response.escalate) escalations.push(response.personaId);
  }

  for (const optionId of optionIds) {
    scores[optionId] = clamp(scores[optionId] / totalWeight);
  }

  const ranked = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return {
    scores,
    ranked,
    confidence: clamp(weightedConfidence / totalWeight),
    escalations,
  };
}

function decide(config, aggregate) {
  const [winner, runnerUp] = aggregate.ranked;
  const margin = winner.score - (runnerUp?.score ?? 0);
  const blockedByConfidence = config.debate.requireAllConfident && aggregate.escalations.length > 0;
  const hasConsensus = winner.score >= config.debate.consensusThreshold && margin >= config.debate.minimumMargin;

  if (blockedByConfidence) {
    return {
      status: 'escalated',
      selectedOption: 'escalate',
      consensus: {
        winner: winner.id,
        winnerScore: winner.score,
        margin,
        blockedBy: aggregate.escalations,
        reason: 'one or more personas fell below escalationThreshold',
      },
    };
  }

  if (!hasConsensus) {
    return {
      status: 'no_consensus',
      selectedOption: 'escalate',
      consensus: {
        winner: winner.id,
        winnerScore: winner.score,
        margin,
        blockedBy: [],
        reason: 'winner did not satisfy consensusThreshold and minimumMargin',
      },
    };
  }

  return {
    status: 'accepted',
    selectedOption: winner.id,
    consensus: {
      winner: winner.id,
      winnerScore: winner.score,
      margin,
      blockedBy: [],
      reason: 'weighted persona consensus satisfied all thresholds',
    },
  };
}

function normalizePersonaResponse(response, persona, options) {
  if (!isPlainObject(response)) {
    throw new TypeError(`responder for ${persona.id} must return an object`);
  }
  const optionScores = {};
  for (const option of options) {
    const score = response.optionScores?.[option.id];
    if (!validScore(score)) {
      throw new TypeError(`responder for ${persona.id} returned invalid score for option "${option.id}"`);
    }
    optionScores[option.id] = score;
  }

  const recommendation = response.recommendation ?? topOption(optionScores).id;
  if (!options.some((option) => option.id === recommendation)) {
    throw new TypeError(`responder for ${persona.id} returned unknown recommendation "${recommendation}"`);
  }

  return {
    personaId: persona.id,
    recommendation,
    optionScores,
    confidence: validScore(response.confidence) ? response.confidence : 0.5,
    rationale: String(response.rationale ?? ''),
    risks: Array.isArray(response.risks) ? response.risks.map(String) : [],
    escalate: Boolean(response.escalate),
  };
}

function normalizeProposal(proposalInput, config) {
  const proposal = isPlainObject(proposalInput) ? proposalInput : {};
  const signals = isPlainObject(proposal.signals) ? proposal.signals : {};
  return {
    title: proposal.title ?? 'Untitled proposal',
    question: proposal.question ?? config.decision.question,
    signals,
  };
}

function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length < 2) {
    throw new DebateConfigError(['decision.options must contain at least 2 options']);
  }
  const ids = new Set();
  return options.map((option, index) => {
    if (!isPlainObject(option) || !nonEmptyString(option.id)) {
      throw new DebateConfigError([`decision.options[${index}].id is required`]);
    }
    if (ids.has(option.id)) {
      throw new DebateConfigError([`decision.options[${index}].id duplicates "${option.id}"`]);
    }
    ids.add(option.id);
    return {
      id: option.id,
      label: option.label ?? option.id,
      description: option.description ?? '',
    };
  });
}

function scoreOption(optionId, readiness, uncertainty) {
  if (optionId === 'approve') return 0.12 + readiness * 0.82;
  if (optionId === 'revise') return 0.25 + (1 - Math.abs(readiness - 0.55) * 1.35) * 0.42 + uncertainty * 0.18;
  if (optionId === 'escalate') return 0.18 + (1 - readiness) * 0.52 + uncertainty * 0.24;
  return 0.35 + readiness * 0.25 - uncertainty * 0.1;
}

function signalState(value) {
  if (value === true || value === 'pass' || value === 'present' || value === 'yes') return 'pass';
  if (value === false || value === 'fail' || value === 'missing' || value === 'no') return 'fail';
  return 'unknown';
}

function topOption(scores) {
  return Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];
}

function stableDecisionId(config, proposal) {
  const hash = createHash('sha256')
    .update(JSON.stringify({ name: config.name, question: proposal.question, title: proposal.title }))
    .digest('hex')
    .slice(0, 12);
  return `decision_${hash}`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validScore(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function parseCliArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') args.config = argv[++index];
    else if (arg === '--proposal') args.proposal = argv[++index];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node factory/v2-personas/debate.mjs --config <config.json> --proposal <proposal.json> [--json]

Runs an offline N-persona debate and emits a structured decision artifact.`);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args.config || !args.proposal) {
    printUsage();
    process.exitCode = args.help ? 0 : 1;
    return;
  }

  const config = await readJsonFile(args.config);
  const proposal = await readJsonFile(args.proposal);
  const result = await runDebate(config, proposal);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Decision: ${result.selectedOption} (${result.status})`);
  console.log(`Consensus: ${result.consensus.winner} ${formatPercent(result.consensus.winnerScore)}; ${result.consensus.reason}`);
  console.log(`Decision artifact: ${result.decisionId}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
