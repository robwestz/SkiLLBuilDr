#!/usr/bin/env node
// kickoff.mjs — deterministic, dependency-free session-start orchestrator.
//
// v1 does exactly two things, with zero model calls and zero runtime deps:
//   (a) health-check  — lockfile drift, dirty tree, branch position, contracts
//   (b) knowledge-load — open tasks, revisit_required assumptions, recent commits,
//                        and a link to the previous session's kickoff card.
// It then renders a "Session Intent Card" (markdown). With --write the card is
// persisted under .agents/kickoffs/ so the next session starts from better priors
// (the dogfood snowball). The model "council" is intentionally deferred to v2.
//
// Usage:
//   node kickoff.mjs [repoRoot] [--write]
// Exit 0 always when it can run; health problems are reported in the card, not
// as a process failure, so the kickoff never blocks a session from starting.
//
// No third-party dependencies (repo policy: zero runtime deps).

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Pure functions (no IO) — these are what the test suite exercises.
// ---------------------------------------------------------------------------

// Names a package.json declares as runtime/dev dependencies.
export function declaredDependencies(pkgText) {
  let pkg;
  try { pkg = JSON.parse(pkgText); } catch { return []; }
  const names = new Set();
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const obj = pkg[field];
    if (obj && typeof obj === 'object') for (const name of Object.keys(obj)) names.add(name);
  }
  return [...names];
}

// Top-level packages an npm lockfile (v2/v3) has resolved into node_modules/<name>.
export function lockedPackages(lockText) {
  let lock;
  try { lock = JSON.parse(lockText); } catch { return new Set(); }
  const names = new Set();
  const pkgs = lock.packages;
  if (pkgs && typeof pkgs === 'object') {
    for (const key of Object.keys(pkgs)) {
      const m = key.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)$/);
      if (m) names.add(m[1]);
    }
  }
  const legacy = lock.dependencies; // lockfile v1 fallback
  if (legacy && typeof legacy === 'object') for (const name of Object.keys(legacy)) names.add(name);
  return names;
}

// Dependencies declared in package.json but absent from the lockfile.
// This is precisely the drift that makes `npm ci` fail with
// "Missing: <pkg> from lock file" — the failure this skill exists to pre-empt.
export function detectLockfileDrift(pkgText, lockText) {
  const declared = declaredDependencies(pkgText);
  const locked = lockedPackages(lockText);
  const missing = declared.filter((name) => !locked.has(name)).sort();
  return { missing, inSync: missing.length === 0, declaredCount: declared.length };
}

// Parse `git status --porcelain` output into a dirty-tree summary.
export function parsePorcelain(stdout) {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  return { dirty: lines.length > 0, count: lines.length, entries: lines };
}

// Extract assumptions flagged `revisit_required`. ASSUMPTIONS.md records them as
// markdown table rows, so only `|`-delimited rows are considered (prose lines
// that merely mention the phrase are ignored). The first cell (the id) is kept.
export function parseRevisitAssumptions(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (!/revisit_required/i.test(line)) continue;
    if (/^\|[\s|:-]+\|?$/.test(line)) continue; // header separator row
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    const id = cells[0] || '';
    const what = cells[1] || '';
    out.push(what ? `${id}: ${what}` : id);
  }
  return out;
}

// Open (not-done) tasks from a .agents/TASKS.json ledger, defensively parsed.
export function parseOpenTasks(tasksText) {
  let data;
  try { data = JSON.parse(tasksText); } catch { return []; }
  const list = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
  const isOpen = (t) => {
    const s = String((t && (t.status || t.state)) || '').toLowerCase();
    return s !== 'done' && s !== 'completed' && s !== 'closed';
  };
  return list.filter(isOpen).map((t) => ({
    id: t.id != null ? String(t.id) : '',
    title: String(t.title || t.name || t.goal || t.description || '').trim(),
    status: String(t.status || t.state || 'open'),
  }));
}

// Render a Session Intent Card (markdown) from a collected report object.
export function renderCard(report) {
  const { timestamp, branch, ahead, behind, drift, tree, contracts,
    openTasks, revisit, recentCommits, previousCard } = report;
  const warn = [];
  if (drift && !drift.inSync) warn.push(`lockfile drift: ${drift.missing.length} dep(s) missing from lockfile`);
  if (tree && tree.dirty) warn.push(`working tree dirty: ${tree.count} change(s)`);
  for (const c of (contracts || [])) if (!c.present) warn.push(`missing contract: ${c.path}`);
  const health = warn.length === 0 ? 'GREEN' : 'ATTENTION';

  const L = [];
  L.push(`# Session Intent Card — ${timestamp}`);
  L.push('');
  L.push(`- branch: \`${branch || '(unknown)'}\`` + (ahead || behind ? ` (ahead ${ahead || 0}, behind ${behind || 0})` : ''));
  L.push(`- health: **${health}**`);
  if (previousCard) L.push(`- previous card: \`${previousCard}\``);
  L.push('');
  L.push('## (a) Health check');
  if (drift) L.push(drift.inSync
    ? `- lockfile: in sync (${drift.declaredCount} deps declared)`
    : `- lockfile: **DRIFT** — missing from lockfile: ${drift.missing.join(', ')}`);
  if (tree) L.push(tree.dirty ? `- working tree: **${tree.count} uncommitted change(s)**` : '- working tree: clean');
  for (const c of (contracts || [])) L.push(`- contract ${c.path}: ${c.present ? 'present' : '**MISSING**'}`);
  L.push('');
  L.push('## (b) Knowledge load');
  L.push(`- open tasks: ${openTasks && openTasks.length ? openTasks.length : 0}`);
  for (const t of (openTasks || []).slice(0, 10)) L.push(`  - [${t.status}] ${t.id ? t.id + ': ' : ''}${t.title}`);
  L.push(`- revisit_required assumptions: ${revisit && revisit.length ? revisit.length : 0}`);
  for (const r of (revisit || []).slice(0, 10)) L.push(`  - ${r}`);
  if (recentCommits && recentCommits.length) {
    L.push('- recent commits:');
    for (const c of recentCommits.slice(0, 5)) L.push(`  - ${c}`);
  }
  L.push('');
  L.push('## Suggested focus');
  if (warn.length) {
    L.push('Resolve health attention items before feature work:');
    for (const w of warn) L.push(`- ${w}`);
  } else {
    L.push('- Health GREEN. Proceed to the highest-priority open task above.');
  }
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// IO wiring (CLI only).
// ---------------------------------------------------------------------------

function findRepoRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return ''; }
}

function readIf(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function findAssumptions(root) {
  const base = join(root, '.claude', 'skills');
  const found = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (e === 'ASSUMPTIONS.md') found.push(full);
    }
  };
  walk(base);
  return found;
}

function previousCardPath(root) {
  const dir = join(root, '.agents', 'kickoffs');
  let entries;
  try { entries = readdirSync(dir); } catch { return null; }
  const cards = entries.filter((e) => e.endsWith('-kickoff.md')).sort();
  return cards.length ? relative(root, join(dir, cards[cards.length - 1])).split('\\').join('/') : null;
}

function collect(root) {
  const pkgText = readIf(join(root, 'package.json'));
  const lockText = readIf(join(root, 'package-lock.json'));
  const drift = pkgText && lockText ? detectLockfileDrift(pkgText, lockText) : null;

  const tree = parsePorcelain(git(root, ['status', '--porcelain']));
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const ahead = Number((git(root, ['rev-list', '--count', '@{u}..HEAD']) || '0').trim()) || 0;
  const behind = Number((git(root, ['rev-list', '--count', 'HEAD..@{u}']) || '0').trim()) || 0;
  const recentCommits = git(root, ['log', '-5', '--oneline']).split(/\r?\n/).filter(Boolean);

  const contracts = ['CLAUDE.md', 'AGENT_ONBOARDING.md', '.agents/PROTOCOL.md']
    .map((p) => ({ path: p, present: existsSync(join(root, p)) }));

  const tasksText = readIf(join(root, '.agents', 'TASKS.json'));
  const openTasks = tasksText ? parseOpenTasks(tasksText) : [];

  const revisit = [];
  for (const f of findAssumptions(root)) {
    const t = readIf(f);
    if (t) revisit.push(...parseRevisitAssumptions(t));
  }

  return {
    timestamp: new Date().toISOString(),
    branch, ahead, behind, drift, tree, contracts,
    openTasks, revisit, recentCommits,
    previousCard: previousCardPath(root),
  };
}

function main(argv) {
  const args = argv.slice(2);
  const write = args.includes('--write');
  const posArg = args.find((a) => !a.startsWith('--'));
  const root = findRepoRoot(posArg || process.cwd());

  const report = collect(root);
  const card = renderCard(report);
  process.stdout.write(card + '\n');

  if (write) {
    const dir = join(root, '.agents', 'kickoffs');
    mkdirSync(dir, { recursive: true });
    const stamp = report.timestamp.replace(/[:.]/g, '-');
    const out = join(dir, `${stamp}-kickoff.md`);
    writeFileSync(out, card + '\n');
    process.stderr.write(`written: ${relative(root, out)}\n`);
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv));
}
