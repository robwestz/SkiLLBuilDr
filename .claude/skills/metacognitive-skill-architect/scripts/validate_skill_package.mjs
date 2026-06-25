#!/usr/bin/env node
// validate_skill_package.mjs — dependency-free Node validator for a skill
// package. Automates gates G1, G2, G3, G4, G7 from references/process_standard.md
// plus the SKILL.md structural checks from references/skill_standard.md.
//
// Usage:   node validate_skill_package.mjs <path/to/skill/package/dir>
// Exit 0:  package PASSES every automated gate. Exit 1: at least one failure.
//
// No third-party dependencies (repo policy: zero runtime deps).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCardsFile } from './validate_artifact_cards.mjs';

const REQUIRED_HEADINGS = ['When to use', 'Inputs', 'Outputs', 'Steps', 'Validation', 'Examples'];
const MAX_DESCRIPTION = 200;
// G7 detects GPU/heavy-dependency *introductions*: the module specifier of an
// actual import/require statement matching a known heavy/ML/GPU module. It does
// NOT match the word "gpu" in prose, so policy text like "no GPU" never trips it,
// and a denylist defined in source (not imported) cannot flag itself.
const HEAVY_MODULE = /cuda|cudnn|nvidia|onnxruntime|tensorflow|torch|llama\.cpp/i;

// Directories never walked for parity/AIC/hygiene (test data, vcs, deps).
const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);
const EXCLUDED_REL_PREFIXES = ['tests/fixtures'];

function stripInlineComment(value) {
  const i = value.indexOf(' #');
  return (i === -1 ? value : value.slice(0, i)).trim();
}

function stripQuotes(s) {
  return s.replace(/^["']/, '').replace(/["']$/, '');
}

// Parse manifest.yaml -> { files: Set<relpath>, cardsFile: string|null }.
export function parseManifest(text) {
  const files = new Set();
  let cardsFile = null;
  let inFiles = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ');
    if (/^files:\s*$/.test(line)) { inFiles = true; continue; }
    // A non-indented, non-blank line ends the files: block.
    if (inFiles && /^\S/.test(line) && line.trim() !== '') inFiles = false;

    const cardsMatch = line.match(/^artifact_intent_cards:\s*(.+)$/);
    if (cardsMatch) cardsFile = stripQuotes(stripInlineComment(cardsMatch[1].trim()));

    if (!inFiles) continue;

    const inlineList = line.match(/^\s*[A-Za-z_]+:\s*\[(.*)\]\s*$/);
    if (inlineList) {
      for (const item of inlineList[1].split(',')) {
        const v = stripQuotes(stripInlineComment(item.trim()));
        if (v) files.add(v);
      }
      continue;
    }
    const blockItem = line.match(/^\s*-\s*(.+)$/);
    if (blockItem) {
      const v = stripQuotes(stripInlineComment(blockItem[1].trim()));
      if (v) files.add(v);
    }
  }
  return { files, cardsFile };
}

// Recursively list package-relative file paths, skipping excluded dirs/prefixes.
function listFiles(root, dir = root, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(root, full);
    if (EXCLUDED_DIRS.has(entry)) continue;
    if (EXCLUDED_REL_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))) continue;
    if (statSync(full).isDirectory()) listFiles(root, full, acc);
    else acc.push(rel.split('\\').join('/'));
  }
  return acc;
}

function checkSkillMd(root, errors) {
  const skillPath = join(root, 'SKILL.md');
  if (!existsSync(skillPath)) return; // G1 already reports the absence
  const text = readFileSync(skillPath, 'utf8');

  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fm) {
    errors.push('SKILL.md: missing YAML frontmatter');
  } else {
    const body = fm[1];
    const nameMatch = body.match(/^name:\s*(.+)$/m);
    const descMatch = body.match(/^description:\s*(.+)$/m);
    if (!nameMatch) errors.push('SKILL.md: frontmatter missing name');
    else {
      const name = stripQuotes(nameMatch[1].trim());
      const dirName = basename(resolve(root));
      if (name !== dirName) {
        errors.push(`SKILL.md: frontmatter name "${name}" does not match directory "${dirName}"`);
      }
    }
    if (!descMatch) errors.push('SKILL.md: frontmatter missing description');
    else if (stripQuotes(descMatch[1].trim()).length > MAX_DESCRIPTION) {
      errors.push(`SKILL.md: description exceeds ${MAX_DESCRIPTION} chars`);
    }
  }

  if (!/^#\s+\S/m.test(text)) errors.push('SKILL.md: missing H1 title');
  for (const h of REQUIRED_HEADINGS) {
    const re = new RegExp(`^##\\s+${h}\\b`, 'mi');
    if (!re.test(text)) errors.push(`SKILL.md: missing required heading: ${h}`);
  }
}

function importsHeavyModule(text) {
  for (const line of text.split(/\r?\n/)) {
    let spec = null;
    const imp = line.match(/^\s*import\b[^'"]*['"]([^'"]+)['"]/);
    if (imp) spec = imp[1];
    else {
      const req = line.match(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (req) spec = req[1];
    }
    if (spec && HEAVY_MODULE.test(spec)) return spec;
  }
  return null;
}

function checkResourceHygiene(root, diskFiles, errors) {
  for (const rel of diskFiles) {
    let text;
    try { text = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
    const heavy = importsHeavyModule(text);
    if (heavy) {
      errors.push(`G7: GPU/heavy-dependency import "${heavy}" found in ${rel}`);
    }
  }
}

export function validatePackage(root) {
  const errors = [];

  const manifestPath = join(root, 'manifest.yaml');
  if (!existsSync(manifestPath)) {
    return { errors: ['G1: required file missing: manifest.yaml'] };
  }
  const { files: listed, cardsFile } = parseManifest(readFileSync(manifestPath, 'utf8'));

  // G1: core required files exist.
  for (const required of ['SKILL.md', 'manifest.yaml']) {
    if (!existsSync(join(root, required))) errors.push(`G1: required file missing: ${required}`);
  }

  const diskFiles = listFiles(root);
  const diskSet = new Set(diskFiles);

  // The cards collection is referenced via artifact_intent_cards:, not files:.
  const accountedFor = new Set(listed);
  if (cardsFile) accountedFor.add(cardsFile);

  // G4: phantom files (listed in manifest but absent on disk).
  for (const f of listed) {
    if (!diskSet.has(f)) errors.push(`G4: phantom file in manifest: ${f}`);
  }
  if (cardsFile && !diskSet.has(cardsFile)) {
    errors.push(`G4: phantom file in manifest: ${cardsFile}`);
  }

  // G4: orphan files (on disk but not declared in manifest).
  for (const f of diskFiles) {
    if (!accountedFor.has(f)) errors.push(`G4: orphan file not in manifest: ${f}`);
  }

  // G2 + G3: cards present and valid.
  let cardPaths = [];
  if (!cardsFile) {
    errors.push('G2: manifest declares no artifact_intent_cards file');
  } else if (diskSet.has(cardsFile)) {
    const { cards, errors: cardErrors } = validateCardsFile(join(root, cardsFile));
    errors.push(...cardErrors); // G3
    cardPaths = cards.map((c) => (c.artifact_path || '').split('\\').join('/'));
  }

  // G2: every package file (except the cards collection itself) has an AIC.
  for (const f of diskFiles) {
    if (cardsFile && f === cardsFile) continue;
    const hasCard = cardPaths.some((cp) => cp === f || cp.endsWith('/' + f));
    if (!hasCard) errors.push(`G2: file without Artifact Intent Card: ${f}`);
  }

  // skill_standard SKILL.md structural DoD.
  checkSkillMd(root, errors);

  // G7: resource hygiene.
  checkResourceHygiene(root, diskFiles, errors);

  return { errors, listedCount: listed.size, diskCount: diskFiles.length };
}

function main(argv) {
  const root = argv[2];
  if (!root) {
    console.error('usage: validate_skill_package.mjs <skill-package-dir>');
    return 2;
  }
  if (!existsSync(root)) {
    console.error(`ERROR: package dir not found: ${root}`);
    return 1;
  }
  const { errors } = validatePackage(root);
  if (errors.length === 0) {
    console.log(`PASS: skill package valid: ${root}`);
    return 0;
  }
  console.error(`FAIL: ${errors.length} problem(s) in ${root}`);
  for (const e of errors) console.error(`  - ${e}`);
  return 1;
}

// Run as CLI only when invoked directly (not when imported by a test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv));
}
