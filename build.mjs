#!/usr/bin/env node
// Multi-source skill/command scanner for Claude Code.
// Reads: all installed plugins under ~/.claude/plugins/cache/**, user skills/commands,
// and (optionally) project-level .claude/{skills,commands} via --project <path>.
// Writes data.json + data.js (the latter for file:// use by index.html).

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const PLUGINS_ROOT = join(HOME, ".claude", "plugins", "cache");

function parseArgs(argv) {
  const out = { project: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") out.project = argv[++i];
    else if (a === "--verbose" || a === "-v") out.verbose = true;
  }
  return out;
}

function safeReaddir(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function mtime(p) {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const yaml = text.slice(3, end).replace(/^\n/, "");
  const out = {};
  let currentKey = null;
  let buffer = [];
  const flush = () => {
    if (currentKey !== null) {
      out[currentKey] = buffer.join(" ").trim();
      buffer = [];
      currentKey = null;
    }
  };
  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      flush();
      currentKey = m[1];
      const rest = m[2];
      if (rest.length > 0) buffer.push(stripQuotes(rest));
    } else if (currentKey && /^\s+\S/.test(line)) {
      buffer.push(stripQuotes(line.trim()));
    }
  }
  flush();
  return out;
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function extractBody(text) {
  if (!text.startsWith("---")) return text.trim();
  const end = text.indexOf("\n---", 3);
  if (end === -1) return "";
  return text.slice(end + 4).replace(/^\r?\n/, "").trimEnd();
}

// Returns first meaningful non-heading line from body text (for rules without descriptions).
function firstLine(body) {
  for (const raw of body.split("\n")) {
    const t = raw.replace(/^#+\s*/, "").trim();
    if (t && !t.startsWith("|") && !t.startsWith("---") && !t.startsWith("```")) {
      return t.slice(0, 120);
    }
  }
  return "";
}

function deriveCategory(name, source) {
  const n = name.toLowerCase();
  const src = (source && source.namespace) || "";
  const sourceDefaults = {
    "posthog": "PostHog",
    "data": "Data",
    "gsd": "GSD",
    "planning-with-files": "Planning",
    "compound-engineering": "Compound",
    "pinecone": "Data",
    "supabase": "Data",
    "clickhouse-io": "Data",
    "figma": "Design",
    "vercel": "DevOps",
    "playwright": "Testing",
    "firebase": "DevOps",
    "github": "DevOps",
    "commit-commands": "DevOps",
    "linear": "Ops",
    "serena": "AI Ops",
    "ralph-loop": "Agents",
    "superpowers": "ECC-meta",
    "buildr-executor": "Buildr",
    "buildr-operator": "Buildr",
    "buildr-rescue": "Buildr",
    "buildr-scout": "Buildr",
    "buildr-smith": "Buildr",
    "greptile": "AI Ops",
    "context7": "AI Ops",
    "sonatype-guide": "Security",
    "security-guidance": "Security",
    "qodo-skills": "Testing",
    "csharp-lsp": ".NET",
    "typescript-lsp": "Node/TS",
    "pyright-lsp": "Python",
    "laravel-boost": "PHP",
    "pr-review-toolkit": "Testing",
    "code-review": "Testing",
    "feature-dev": "Planning",
    "learning-output-style": "Content",
    "plugin-dev": "DevOps",
    "claude-md-management": "ECC-meta",
    "agent-sdk-dev": "AI Ops",
    "cli-anything": "Ops",
    "planning-with-files": "Planning",
  };

  const rules = [
    [/^kotlin|^android|compose-multiplatform|^gradle/, "Kotlin/Android"],
    [/^flutter|^dart\b|flutter-/, "Flutter/Dart"],
    [/^swift|^ios\b|liquid-glass|foundation-models-on-device/, "Swift/iOS"],
    [/^python|^django|^pytorch/, "Python"],
    [/^rust/, "Rust"],
    [/^go-|^golang/, "Go"],
    [/^cpp/, "C++"],
    [/^java|^springboot|jpa-patterns/, "Java/Spring"],
    [/^csharp|^dotnet/, ".NET"],
    [/^nestjs|^nodejs|^bun\b|^nextjs|^nuxt/, "Node/TS"],
    [/^perl/, "Perl"],
    [/^laravel|^php/, "PHP"],
    [/^frontend|^ui-|^ux-|design-system|accessibility|^polish|^critique/, "Frontend/UI"],
    [/^backend|^api-design|hexagonal|architecture-decision/, "Backend/API"],
    [/^security|hipaa|^defi|^evm|llm-trading|security-/, "Security"],
    [/healthcare/, "Healthcare"],
    [/review$|^review-|^code-review|asyncreview|^raise-the-bar/, "Review"],
    [/^e2e|^tdd|^test|testing|benchmark|browser-qa|ai-regression|eval-harness|^evaluation$|^advanced-evaluation|^agent-evaluation|^bdi-/, "Testing"],
    [/^commit|^clean_gone|^git|^github|^docker|deployment|^deploy|database-migrations|canary-watch|devfleet|create-plugin|plugin-dev|git-workflow/, "DevOps"],
    [/^postgres|^clickhouse|^data-|knowledge-ops|^warehouse|lineage|^dag|airflow|cosmos-dbt|^supabase|pinecone/, "Data"],
    [/^agent|autonomous|continuous-agent|^mcp-|^team|orchestrat|multi-agent|hosted-agents|harness|archon|session-launcher|^loop$|^schedule$|tool-design|ralph-loop|^swarm/, "Agents"],
    [/^writing|^article|^content|^video|^manim|^remotion|^brand|crosspost|^seo|^slides|^x-api|^showcase|^frontend-slides|showcase-presenter/, "Content"],
    [/^ecc|continuous-learning|^instinct|^hookify|^learn-eval|^safety-guard|^santa|^skill-|^repo-scan|^plankton|^prompt|^context-budget|workspace-surface|gateguard|agent-sort|configure-ecc|strategic-compact|token-budget|^ck\b|nanoclaw|^council|^evolve|^projects|^promote|^prune|^resume-session|^save-session|^sessions|^aside|^checkpoint|^claw|^docs$|^eval$|^orchestrate|^verify|^learn|^find-skills|using-superpowers|^brainstorm|^simplify|^polish$|^pause-work|^resume-work/, "ECC-meta"],
    [/^planning|writing-plans|plan-phase|create-roadmap|roadmap|execute-plan|execute-phase|feature-dev|^discuss|^progress$|add-phase|remove-phase|insert-phase|new-milestone|new-project|map-codebase|complete-milestone|research-phase|consider-issues/, "Planning"],
    [/^gsd|get-shit-done/, "GSD"],
    [/posthog/, "PostHog"],
    [/^compound-engineering|deepen-plan|^ce-/, "Compound"],
    [/^buildr/, "Buildr"],
    [/^200k/, "200k"],
    [/^claude-api|^claude-code|^ai-first|^ai-|^cost-aware|^llm|^codebase-onboarding|hosted-agents|^spec-to-app|last30days|deep-research/, "AI Ops"],
    [/^research|research-ops|^ops$|^email-|^messages-|google-workspace|unified-notifications|terminal-ops/, "Ops"],
    [/^investor|market-research|^lead-|customer-billing|finance-|automation-audit|ecc-tools-cost/, "Business"],
    [/carrier|customs|energy|inventory|logistics|quality-nonconformance|production-scheduling|returns/, "Domain"],
    [/figma|canva/, "Design"],
    [/^debug|^verify-work|^plan-fix|^the-cleaner|refactor-clean|verification-loop|quality-gate/, "Debug"],
    [/^prp-/, "Planning"],
    [/^multi-|ralphinho-rfc/, "Agents"],
    [/^context-|filesystem-context|memory-systems/, "Context"],
    [/^loop-|^setup-pm|^pm2|^update-codemaps|^update-docs/, "DevOps"],
    [/^blueprint|product-capability|product-lens|^project-|^workspace-planner/, "Planning"],
    [/documentation-lookup|exa-search|search-first|iterative-retrieval|model-route|dashboard-builder|fal-ai-media|nutrient-document-processing|jira|jira-integration|regex-vs-llm|browser-use|cli-anything-obsidian|cli-hub-meta-skill|deep-research|last30days/, "AI Ops"],
    [/social-graph|connections-optimizer|opensource-pipeline|visa-doc-translate|code-tour|click-path-audit|coding-standards|openclaw|secure-linux|performance-report-generator|portable-kit-prompt-compiler|rules-distill|api-connector-builder|dmux-workflows|enterprise-agent-ops|build-fix|gan-build|gan-design|^plan$/, "ECC-meta"],
    // Agent role names (no prefix, generic role nouns)
    [/^architect$|^code-architect$|^a11y-architect$|^analyst$|^executor$|^scientist$|^gan-/, "Agents"],
    [/^planner$/, "Planning"],
    [/^critic$|^comment-analyzer$|^typescript-reviewer$/, "Review"],
    [/^designer$|^type-design-analyzer$|^a11y-/, "Frontend/UI"],
    [/^build-error-resolver$|^silent-failure-hunter$|^performance-optimizer$|^tracer$|^trace$/, "Debug"],
    [/^chief-of-staff$|^conversation-analyzer$/, "Ops"],
    [/^database-reviewer$/, "Data"],
    [/^typescript-reviewer$/, "Node/TS"],
    [/^doc-updater$|^code-explorer$|^code-simplifier$|^explore$|^verifier$/, "ECC-meta"],
    [/^docs-lookup$|^autoresearch$|^wiki$|^external-context$|^deep-dive$|^deep-interview$/, "AI Ops"],
    [/^opensource-forker$|^opensource-packager$|^opensource-sanitizer$/, "DevOps"],
    [/^pr-test-analyzer$|^qa-tester$|^ultraqa$|^visual-verdict$/, "Testing"],
    [/^writer$|^writer-memory$/, "Content"],
    [/^autopilot$|^ultrawork$|^ralph$|^ralplan$/, "Agents"],
    [/^omc-|^ccg$|^sciomc$|^deepinit$|^hud$|^configure-notifications$|^remember$|^self-improve$|^skillify$|^skill$|^ask$|^cancel$|^setup$|^release$/, "ECC-meta"],
    [/^document-specialist$/, "Content"],
  ];
  for (const [re, cat] of rules) {
    if (re.test(n)) return { category: cat, categoryReason: `name-rule:${re.source.slice(0, 40)}` };
  }
  if (n.endsWith("-patterns") || n.endsWith("-testing")) return { category: "Patterns", categoryReason: "name-suffix:-patterns/-testing" };
  if (src && sourceDefaults[src]) return { category: sourceDefaults[src], categoryReason: `source-default:${src}` };
  return { category: "Misc", categoryReason: "fallback:no-rule-matched" };
}

// ------------- Source discovery -------------

function discoverSources(opts) {
  const sources = [];

  // Plugins
  for (const marketplace of safeReaddir(PLUGINS_ROOT)) {
    const mDir = join(PLUGINS_ROOT, marketplace);
    if (!isDir(mDir)) continue;
    for (const plugin of safeReaddir(mDir)) {
      const pDir = join(mDir, plugin);
      if (!isDir(pDir)) continue;

      // Two layouts:
      //   a) marketplace/plugin/version/<plugin-root>  (most common)
      //   b) marketplace/plugin/<plugin-root>           (rare)
      // Pick the most recently modified version dir that has a .claude-plugin/plugin.json.
      const versions = safeReaddir(pDir)
        .map((v) => ({ name: v, path: join(pDir, v), m: mtime(join(pDir, v)) }))
        .filter((x) => isDir(x.path))
        .sort((a, b) => b.m - a.m);

      let root = null;
      let manifest = null;
      for (const v of versions) {
        const candidate = join(v.path, ".claude-plugin", "plugin.json");
        if (existsSync(candidate)) {
          try {
            const data = JSON.parse(readFileSync(candidate, "utf8"));
            if (data && data.name) {
              root = v.path;
              manifest = data;
              break;
            }
          } catch { /* try next */ }
        }
      }

      // Fallback: plugin.json lives at pDir level (rare)
      if (!root) {
        const candidate = join(pDir, ".claude-plugin", "plugin.json");
        if (existsSync(candidate)) {
          try {
            const data = JSON.parse(readFileSync(candidate, "utf8"));
            if (data && data.name) {
              root = pDir;
              manifest = data;
            }
          } catch { /* ignore */ }
        }
      }

      if (!root || !manifest) continue;

      sources.push({
        scope: "plugin",
        namespace: manifest.name,
        label: `plugin:${manifest.name}`,
        root,
        version: manifest.version || "",
        marketplace,
      });
    }
  }

  // User
  sources.push({
    scope: "user",
    namespace: null,
    label: "user",
    root: join(HOME, ".claude"),
  });

  // Project
  if (opts.project) {
    const p = opts.project;
    if (isDir(join(p, ".claude"))) {
      sources.push({
        scope: "project",
        namespace: null,
        label: "project",
        root: join(p, ".claude"),
        projectPath: p,
      });
    }
  }

  return sources;
}

// ------------- Item collection -------------

function buildSlug(source, name) {
  return source.namespace ? `/${source.namespace}:${name}` : `/${name}`;
}

function collectSkills(source) {
  const skillsDir = join(source.root, "skills");
  if (!isDir(skillsDir)) return [];
  const items = [];
  for (const entry of safeReaddir(skillsDir)) {
    const skillDir = join(skillsDir, entry);
    if (!isDir(skillDir)) continue;
    const skillFile = join(skillDir, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    const text = readFileSync(skillFile, "utf8");
    const fm = parseFrontmatter(text);
    const name = fm.name || entry;
    const { category: skillCat, categoryReason: skillReason } = deriveCategory(name, source);
    items.push({
      type: "skill",
      name,
      slug: buildSlug(source, name),
      description: fm.description || "",
      origin: fm.origin || "",
      category: skillCat,
      categoryReason: skillReason,
      scope: source.scope,
      source: source.label,
      namespace: source.namespace,
      path: skillFile,
      body: extractBody(text),
    });
  }
  return items;
}

function collectCommands(source) {
  const cmdDir = join(source.root, "commands");
  if (!isDir(cmdDir)) return [];
  const items = [];

  const walk = (dir, subNamespace) => {
    for (const entry of safeReaddir(dir)) {
      const full = join(dir, entry);
      if (isDir(full)) {
        walk(full, entry);
      } else if (isFile(full) && entry.endsWith(".md")) {
        const name = basename(entry, ".md");
        const text = readFileSync(full, "utf8");
        const fm = parseFrontmatter(text);
        // User/project commands in subfolders get subfolder as extra namespace
        // (e.g., ~/.claude/commands/gsd/add-phase.md → /gsd:add-phase)
        let effectiveName = name;
        let effectiveSource = source;
        if (subNamespace && source.scope !== "plugin") {
          effectiveSource = { ...source, namespace: subNamespace };
        }
        const { category: cmdCat, categoryReason: cmdReason } = deriveCategory(effectiveName, effectiveSource);
        items.push({
          type: "command",
          name: effectiveName,
          slug: buildSlug(effectiveSource, effectiveName),
          description: fm.description || "",
          argumentHint: fm["argument-hint"] || "",
          category: cmdCat,
          categoryReason: cmdReason,
          scope: source.scope,
          source: subNamespace && source.scope !== "plugin" ? `${source.label}:${subNamespace}` : source.label,
          namespace: effectiveSource.namespace,
          path: full,
          body: extractBody(text),
        });
      }
    }
  };
  walk(cmdDir, null);
  return items;
}

function collectAgents(source) {
  const agentsDir = join(source.root, "agents");
  if (!isDir(agentsDir)) return [];
  const items = [];
  for (const entry of safeReaddir(agentsDir)) {
    const full = join(agentsDir, entry);
    if (!isFile(full) || !entry.endsWith(".md")) continue;
    const name = basename(entry, ".md");
    const text = readFileSync(full, "utf8");
    const fm = parseFrontmatter(text);
    const { category: agentCat, categoryReason: agentReason } = deriveCategory(fm.name || name, source);
    items.push({
      type: "agent",
      name: fm.name || name,
      slug: buildSlug(source, fm.name || name),
      description: fm.description || "",
      category: agentCat,
      categoryReason: agentReason,
      scope: source.scope,
      source: source.label,
      namespace: source.namespace,
      path: full,
      body: extractBody(text),
    });
  }
  return items;
}

const RULE_LANG_CATEGORY = {
  common: "ECC-meta",
  typescript: "Node/TS",
  python: "Python",
  golang: "Go",
  rust: "Rust",
  swift: "Swift/iOS",
  kotlin: "Kotlin/Android",
  cpp: "C++",
  csharp: ".NET",
  dart: "Flutter/Dart",
  java: "Java/Spring",
  perl: "Perl",
  php: "PHP",
  web: "Frontend/UI",
  zh: "ECC-meta",
};

function collectRules(source) {
  const rulesDir = join(source.root, "rules");
  if (!isDir(rulesDir)) return [];
  const items = [];

  const walk = (dir, langDir) => {
    for (const entry of safeReaddir(dir)) {
      const full = join(dir, entry);
      if (isDir(full)) {
        walk(full, entry);
      } else if (isFile(full) && entry.endsWith(".md") && entry !== "README.md") {
        const name = basename(entry, ".md");
        const text = readFileSync(full, "utf8");
        const fm = parseFrontmatter(text);
        const body = extractBody(text);
        const displayName = langDir ? `${langDir}/${name}` : name;
        let ruleCat, ruleReason;
        if (RULE_LANG_CATEGORY[langDir]) {
          ruleCat = RULE_LANG_CATEGORY[langDir];
          ruleReason = `rule-lang-dir:${langDir}`;
        } else {
          ({ category: ruleCat, categoryReason: ruleReason } = deriveCategory(name, source));
        }
        items.push({
          type: "rule",
          name: fm.name || displayName,
          slug: `rule:${source.namespace ? source.namespace + "/" : ""}${displayName}`,
          description: fm.description || firstLine(body),
          category: ruleCat,
          categoryReason: ruleReason,
          scope: source.scope,
          source: source.label,
          namespace: source.namespace,
          path: full,
          body,
          rulePaths: fm.paths || null,
        });
      }
    }
  };
  walk(rulesDir, null);
  return items;
}

// ------------- Workflows (.archon/workflows/*.yaml) -------------

function parseWorkflowYaml(text) {
  const nameMatch = text.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "";

  // Description: block scalar (|) or inline string
  let description = "";
  const blockDesc = text.match(/^description:\s*\|\s*\n((?:[ \t]+[^\n]*\n?)+)/m);
  if (blockDesc) {
    description = blockDesc[1].replace(/^[ \t]+/gm, "").trim().split(/\n/)[0];
  } else {
    const inlineDesc = text.match(/^description:\s*"?(.+?)"?\s*$/m);
    if (inlineDesc) description = inlineDesc[1].trim();
  }

  // Node ids — lines matching "  - id: <value>"
  const nodeIds = [...text.matchAll(/^\s+-\s+id:\s*(.+)$/gm)].map((m) => m[1].trim());

  return { name, description, nodeIds };
}

function collectWorkflows(source) {
  const archonDir = join(source.root, ".archon", "workflows");
  if (!isDir(archonDir)) return [];
  const items = [];
  for (const entry of safeReaddir(archonDir)) {
    if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
    const full = join(archonDir, entry);
    if (!isFile(full)) continue;
    const text = readFileSync(full, "utf8");
    const { name, description, nodeIds } = parseWorkflowYaml(text);
    if (!name) continue;
    const { category, categoryReason } = deriveCategory(name, source);
    items.push({
      type: "workflow",
      name,
      slug: `workflow:${source.namespace ? source.namespace + "/" : ""}${name}`,
      description: description || (nodeIds.length ? `${nodeIds.length}-step: ${nodeIds.join(" → ")}` : "Archon workflow"),
      category,
      categoryReason,
      scope: source.scope,
      source: source.label,
      namespace: source.namespace,
      path: full,
      body: text,
      workflowNodes: nodeIds,
    });
  }
  return items;
}

function collectSource(source) {
  return [...collectAgents(source), ...collectSkills(source), ...collectCommands(source), ...collectRules(source), ...collectWorkflows(source)];
}

// ------------- Main -------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sources = discoverSources(opts);
  if (opts.verbose) {
    for (const s of sources) console.error(`  source: ${s.label} @ ${s.root}`);
  }

  const all = [];
  for (const src of sources) {
    const items = collectSource(src);
    all.push(...items);
  }

  // De-duplicate by slug (keep first occurrence; sources discovered earlier win;
  // plugin listing comes before user, so user-overrides surface as extras if names clash —
  // but typically slugs are unique because of namespacing).
  const seen = new Set();
  const items = [];
  for (const it of all) {
    const key = `${it.type}|${it.slug}|${it.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
  }

  items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  const categories = {};
  const scopes = {};
  const sourcesCount = {};
  const bundleMap = new Map();
  for (const it of items) {
    categories[it.category] = (categories[it.category] ?? 0) + 1;
    scopes[it.scope] = (scopes[it.scope] ?? 0) + 1;
    sourcesCount[it.source] = (sourcesCount[it.source] ?? 0) + 1;
    const bkey = `${it.source}||${it.category}`;
    if (!bundleMap.has(bkey)) bundleMap.set(bkey, { source: it.source, category: it.category, agent: 0, skill: 0, command: 0, rule: 0, workflow: 0 });
    bundleMap.get(bkey)[it.type] = (bundleMap.get(bkey)[it.type] ?? 0) + 1;
  }
  const bundles = [...bundleMap.values()]
    .map((b) => ({ ...b, total: b.agent + b.skill + b.command + b.rule + b.workflow }))
    .filter((b) => b.total >= 3)
    .sort((a, b) => b.total - a.total);

  const data = {
    generatedAt: new Date().toISOString(),
    sources: sources.map((s) => ({
      scope: s.scope,
      namespace: s.namespace,
      label: s.label,
      root: s.root,
      version: s.version ?? null,
    })),
    counts: {
      total: items.length,
      agents: items.filter((i) => i.type === "agent").length,
      skills: items.filter((i) => i.type === "skill").length,
      commands: items.filter((i) => i.type === "command").length,
      rules: items.filter((i) => i.type === "rule").length,
      workflows: items.filter((i) => i.type === "workflow").length,
    },
    categories,
    scopes,
    sourcesCount,
    bundles,
    items,
  };

  const outPath = join(__dirname, "data.json");
  writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  const jsPath = join(__dirname, "data.js");
  writeFileSync(jsPath, `window.__ECC_DATA__ = ${JSON.stringify(data)};\n`, "utf8");

  // Also emit recipes.js from recipes.json for file:// compat
  const recipesJsonPath = join(__dirname, "recipes.json");
  if (existsSync(recipesJsonPath)) {
    try {
      const recipes = JSON.parse(readFileSync(recipesJsonPath, "utf8"));
      writeFileSync(
        join(__dirname, "recipes.js"),
        `window.__ECC_RECIPES__ = ${JSON.stringify(recipes)};\n`,
        "utf8"
      );
    } catch (e) {
      console.warn("Warning: failed to emit recipes.js:", e.message);
    }
  }

  console.log(
    `Wrote ${items.length} items (${data.counts.agents} agents + ${data.counts.skills} skills + ${data.counts.commands} commands + ${data.counts.rules} rules + ${data.counts.workflows} workflows) from ${sources.length} sources`
  );
  if (opts.verbose) {
    console.error("scopes:", scopes);
    console.error("sources:", sourcesCount);
  }
}

main();
