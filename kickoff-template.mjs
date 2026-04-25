function uniqueNodes(nodes = []) {
  const seen = new Set();
  return nodes.filter((node) => {
    const key = node?.slug || node?.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slugifyLabel(text = "", maxLen = 80) {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "workspace-package";
  // Truncate at word boundary to keep filenames cross-platform (Windows 260-char path limit).
  if (slug.length <= maxLen) return slug;
  const cut = slug.slice(0, maxLen);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > maxLen / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, "");
}

function detectProfile(goal = "", description = "", nodes = []) {
  const hay = `${goal} ${description} ${nodes.map((node) => `${node.name} ${node.description || ""}`).join(" ")}`.toLowerCase();
  if (/\b(cli|command|terminal|shell|release)\b/.test(hay)) return "cli";
  if (/\b(data pipeline|pipeline|etl|warehouse|report|reporting|analytics|stripe|postgres)\b/.test(hay)) return "data";
  if (/\b(saas|billing|auth|onboarding|dashboard|web app|hosted)\b/.test(hay)) return "saas";
  return "general";
}

function inferDeliverables(profile, goal, description) {
  const generic = [
    "A working implementation plan that can be executed without extra clarification.",
    "Code, docs, and tests aligned with the stated goal.",
    "A final handoff that is ready for handoff to Robin or the next agent.",
  ];
  if (profile === "saas") {
    return [
      "A production-shaped application shell with auth, core flows, and clear module boundaries.",
      "Data model, billing or account assumptions, and onboarding UX documented in the implementation.",
      "Verification notes covering critical user journeys, failure states, and release readiness.",
      ...generic,
    ];
  }
  if (profile === "cli") {
    return [
      "A command interface with stable verbs, flags, and example usage.",
      "Test coverage for the main command flows and failure paths.",
      "Packaging and release notes so the tool can be installed and operated safely.",
      ...generic,
    ];
  }
  if (profile === "data") {
    return [
      "Documented ingestion, transformation, and output stages for the pipeline.",
      "Validation rules for source quality, data integrity, and report correctness.",
      "Operations notes for schedules, reruns, alerts, and troubleshooting.",
      ...generic,
    ];
  }
  return [
    `A coherent implementation of: ${goal || description || "the requested package"}.`,
    "Clear tests, verification notes, and documented follow-up risks.",
    ...generic,
  ];
}

function inferSuccessCriteria(profile) {
  const shared = [
    "The selected skills are followed in order with explicit progress updates.",
    "The result is production-grade, offline-first where possible, and documented.",
    "All critical checks pass and the package is ready for handoff.",
  ];
  if (profile === "cli") {
    return [
      "Primary commands run end-to-end with expected output and guardrails.",
      "Tests or validation scripts cover core command behavior.",
      ...shared,
    ];
  }
  if (profile === "data") {
    return [
      "Pipeline stages, inputs, and outputs are explicit and reproducible.",
      "Validation covers schema drift, bad input, and reporting correctness.",
      ...shared,
    ];
  }
  if (profile === "saas") {
    return [
      "Core product flows are implemented and verified against the user goal.",
      "Architecture, UX, and delivery scope are aligned before heavy implementation.",
      ...shared,
    ];
  }
  return shared;
}

function inferFirstMoves(profile) {
  if (profile === "cli") {
    return [
      "Confirm the command surface, inputs, outputs, and safety constraints.",
      "Lock test cases before implementation and keep packaging in scope from day one.",
    ];
  }
  if (profile === "data") {
    return [
      "Map each data source, required transformation, and final report contract before coding.",
      "Define validation and rerun strategy early so the pipeline is operable.",
    ];
  }
  if (profile === "saas") {
    return [
      "Clarify the product slice, users, and acceptance criteria before building.",
      "Sequence architecture, UI, and verification so the first shipped flow is coherent.",
    ];
  }
  return [
    "Clarify the scope and acceptance criteria before implementation.",
    "Use the selected skills to plan, execute, verify, and document in sequence.",
  ];
}

function buildExecutionPlan(nodes) {
  return nodes.map((node, index) => {
    const summary = node.description ? node.description.replace(/\s+/g, " ").trim() : "Apply this capability to move the package forward.";
    const skillLine = node.slug ? `Use \`${node.slug}\` and follow its contract.` : "Use this step as written.";
    return `### Step ${index + 1}: ${node.name}

${summary}

${skillLine}
${node.content?.trim() ? `\n\nWorking note:\n${node.content.trim()}` : ""}`;
  }).join("\n\n");
}

export function buildClaudeMd({ nodes = [] } = {}) {
  const selected = uniqueNodes(nodes).filter((node) => node.slug);
  const lines = [
    "## Skills",
    "",
    "Load these skills into the session before execution:",
    "",
  ];
  selected.forEach((node) => {
    lines.push(`- \`${node.slug}\` - ${node.description || node.name}`);
  });
  return lines.join("\n").trim() + "\n";
}

export function buildReadme({ goal = "", description = "", packageName = "", nodes = [] } = {}) {
  const selected = uniqueNodes(nodes);
  const lines = [
    `# ${packageName || slugifyLabel(goal || description)}`,
    "",
    "## What this package is for",
    "",
    goal || description || "This package was assembled to execute a focused build plan.",
    "",
  ];
  if (description && description !== goal) {
    lines.push(description, "");
  }
  lines.push(
    "## Included files",
    "",
    "- `KICKOFF.md` - the first file the agent should read.",
    "- `CLAUDE.md` - the skill list to load into the session.",
    "- `workflows/` - workflow exports for selected chains.",
    "- `README.md` - this summary for humans.",
    "",
    "## Selected skills",
    ""
  );
  selected.forEach((node) => {
    lines.push(`- ${node.name}${node.slug ? ` (\`${node.slug}\`)` : ""}`);
  });
  return lines.join("\n").trim() + "\n";
}

export function buildKickoff({ goal = "", description = "", packageName = "", nodes = [] } = {}) {
  const selected = uniqueNodes(nodes);
  const effectiveName = packageName || slugifyLabel(goal || description);
  const profile = detectProfile(goal, description, selected);
  const deliverables = inferDeliverables(profile, goal, description);
  const successCriteria = inferSuccessCriteria(profile);
  const firstMoves = inferFirstMoves(profile);

  const lines = [
    `# KICKOFF: ${effectiveName}`,
    "",
    "Read this file fully before taking action. Treat it as the source of truth for the package.",
    "",
    "## Goal",
    "",
    goal || "Goal not provided.",
    "",
  ];

  if (description) {
    lines.push("## Product Context", "", description, "");
  }

  lines.push(
    "## First Moves",
    ""
  );
  firstMoves.forEach((item) => lines.push(`- ${item}`));
  lines.push("");

  lines.push("## Included Skills", "");
  selected.forEach((node) => {
    const suffix = node.description ? ` - ${node.description.replace(/\s+/g, " ").trim()}` : "";
    lines.push(`- \`${node.slug || node.name}\`${suffix}`);
  });
  lines.push("");

  lines.push("## Execution Plan", "", buildExecutionPlan(selected), "");

  lines.push("## Deliverables", "");
  deliverables.forEach((item) => lines.push(`- ${item}`));
  lines.push("");

  lines.push("## Success Criteria", "");
  successCriteria.forEach((item) => lines.push(`- ${item}`));
  lines.push("");

  lines.push(
    "## Working Rules",
    "",
    "- Stay production-grade throughout the package; do not defer obvious quality work.",
    "- Keep execution offline-first unless an external dependency is explicitly required.",
    "- Verify meaningful changes with tests, checks, or direct inspection before claiming completion.",
    "- Leave the workspace in a state that is ready for handoff.",
    ""
  );

  return lines.join("\n").trim() + "\n";
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 0 — Preflight Contract (per frameworks/COMPOUND.md + QUALITY_GATE.md)
// ─────────────────────────────────────────────────────────────────────────

const TIER_DEFS = {
  mvp: {
    label: "MVP",
    qualityGateThreshold: "Working end-to-end. Edge cases documented as known. No production polish required.",
    cuttingEdgeRequired: false,
  },
  production: {
    label: "Production",
    qualityGateThreshold: "Production-grade. Edge cases handled. Tests cover happy path + critical failures. Maintainable in 3 months.",
    cuttingEdgeRequired: false,
  },
  "cutting-edge": {
    label: "Cutting-edge",
    qualityGateThreshold: "Above intermediate. Each file motivates its existence. Cross-model reviewer would call it cutting-edge.",
    cuttingEdgeRequired: true,
  },
};

export function buildPhase0Block({
  goal = "",
  tier = "production",
  chunkPlan = null,
  prefill = null,
} = {}) {
  const tierDef = TIER_DEFS[tier] || TIER_DEFS.production;
  const p = prefill || {};

  // Pre-fill skill-scan checkbox by classification
  const scanCls = (p.skillScan || "").toLowerCase();
  const fitMark = scanCls === "perfect-fit" ? "x" : " ";
  const partialMark = scanCls === "partial" ? "x" : " ";
  const missMark = scanCls === "miss" ? "x" : " ";

  const restatementLine = p.restatement
    ? `Your restatement: **${p.restatement}**`
    : "Your restatement: _<fill in before starting>_";

  const lines = [
    "## Phase 0 — Preflight Contract (MANDATORY)",
    "",
    "Before starting work, complete every block below. Do not edit/write code until 0.6 is signed.",
    "Source: `frameworks/COMPOUND.md` (Gap Scan) + `frameworks/QUALITY_GATE.md`.",
    "",
    prefill ? "> **PRE-FILLED by operator** — review and re-sign 0.6 with your own agent id if you accept." : "",
    "",
    "### 0.1 Goal restate (your own words, one sentence)",
    "",
    `> Original: ${goal || "(no goal provided)"}`,
    "",
    restatementLine,
    "",
    "### 0.2 Skill-scan (against the loaded catalog)",
    "",
    "Match the goal against the included skills (see `CLAUDE.md`). Classify the loadout:",
    "",
    `- [${fitMark}] **Perfect-fit:** every needed capability is covered by an included skill — proceed to 0.4.`,
    `- [${partialMark}] **Partial:** some gaps exist — list them in 0.3, do not skip.`,
    `- [${missMark}] **Miss:** no included skill covers a critical capability — **mandatory** 0.3.`,
    "",
    "### 0.3 Skill-first fallback (when 0.2 is partial or miss)",
    "",
    "**The only sanctioned route out of a gap is to create the missing piece via the skill-development flow.**",
    "Use `/plugin-dev:skill-development` (or the equivalent in your environment) and choose at least one of:",
    "",
    "| Type | Create when… |",
    "|---|---|",
    "| Skill | A reusable capability is missing |",
    "| Rule | A constraint must hold across many tasks |",
    "| Agent | A specialized role with its own context is needed |",
    "| Constraint | A hard limit on actions or outputs must be enforced |",
    "",
    "Ad-hoc improvisation is **not** acceptable. Either an included skill covers the work, or a new artifact is created and registered before proceeding.",
    "",
    ...(scanCls === "miss" || scanCls === "partial"
      ? [
          "**Auto-triggered for this package** (operator marked 0.2 as " +
            `\`${scanCls}\`). Run this before any code:`,
          "",
          "```bash",
          "# Open the skill-first fallback procedure",
          "claude /plugin-dev:skill-development",
          "",
          "# Or, if you prefer the in-repo invocable form:",
          "claude /agent-onboarding   # then jump to Gate 5 → skill-development",
          "```",
          "",
          "Do **not** proceed past 0.6 until at least one new Skill / Rule / Agent /",
          "Constraint is registered to cover the gap. Ad-hoc improvisation in this",
          "package would violate the operator's pre-fill contract.",
          "",
        ]
      : []),
    "### 0.4 Definition of Done (write before building)",
    "",
    `**Tier:** ${tierDef.label} — ${tierDef.qualityGateThreshold}`,
    "",
    "Required:",
    "",
    "- Acceptance criteria (observable behavior, not implementation):",
    ...(p.dod?.acceptanceCriteria?.length
      ? p.dod.acceptanceCriteria.map((c) => `  - **${c}**`)
      : ["  - _<criterion 1>_", "  - _<criterion 2>_"]),
    "- Verification method (test / smoke / demo / canary):",
    p.dod?.verification ? `  - **${p.dod.verification}**` : "  - _<method>_",
    "- \"Directly usable\" check: when a user runs the result, what command or action confirms success?",
    p.dod?.directlyUsable ? `  - **${p.dod.directlyUsable}**` : "  - _<command or action>_",
    "",
    "### 0.5 Hard gates (what you may NOT do without escalating to operator)",
    "",
    "- No destructive ops without explicit confirmation (delete, force-push, drop tables, rm -rf)",
    "- No new external runtime dependencies without flagging (project rule: zero runtime-deps)",
    "- No silent skipping of a chunk's verification step",
    "- No marking phase-complete unless DoD (0.4) is provably met",
    "- No commits without tests green (where tests exist)",
    "",
    "### 0.6 Contract signed",
    "",
    "By writing your name/agent-id below, you certify 0.1–0.5 are filled in:",
    "",
    p.signedBy ? `_Signed by: **${p.signedBy}**_` : "_Signed by: <agent or operator>_",
    p.timestamp ? `_Timestamp: **${p.timestamp}**_` : "_Timestamp: <ISO-8601>_",
    ...(prefill ? ["", "> If you are the executing agent and accept this pre-fill, append your own signature below as well."] : []),
    "",
    "---",
    "",
  ];

  if (chunkPlan && Array.isArray(chunkPlan) && chunkPlan.length > 0) {
    lines.push("## Chunk Plan (logical-order DAG)", "");
    lines.push(
      "Plan describes what — not how every detail. Each chunk has its own preflight (re-run 0.1–0.6) before starting.",
      ""
    );
    chunkPlan.forEach((chunk, i) => {
      lines.push(`### C${i + 1} — ${chunk.name || "Unnamed chunk"}`);
      if (chunk.dependsOn?.length) {
        lines.push(`**Depends on:** ${chunk.dependsOn.map((d) => `C${d}`).join(", ")}`);
      }
      if (chunk.skills?.length) {
        lines.push(`**Skills used:** ${chunk.skills.map((s) => `\`${s}\``).join(", ")}`);
      }
      if (chunk.done) {
        lines.push(`**Done when:** ${chunk.done}`);
      }
      lines.push("");
    });
    lines.push("---", "");
  }

  return lines.join("\n");
}

export function buildCompoundBlock() {
  return [
    "## Compound Mechanisms (run at every chunk boundary)",
    "",
    "Source: `frameworks/COMPOUND.md`. These produce visible output — silent execution does not count.",
    "",
    "### Before each chunk: GAP SCAN",
    "",
    "```",
    "[GAP SCAN]",
    "INTENT REGROUND: <quote the original goal verbatim>",
    "COMPLETE VERSION: <what a finished, usable result looks like>",
    "PLAN COVERS: <what is planned>",
    "PLAN MISSES: <what a complete version needs that isn't planned>",
    "SHELL CHECK: working component or skeleton/placeholder? If skeleton — STOP, escalate.",
    "DECISION: critical gaps → surface; important → propose; nice-to-have → defer.",
    "```",
    "",
    "### After each chunk: COMPOUND REGISTER",
    "",
    "```",
    "[COMPOUND]",
    "BUILT:    <what was completed — concrete>",
    "GAINED:   <new capability/pattern/infra>",
    "ENABLES:  <specific upcoming work this enables — must reference real future chunks>",
    "REUSABLE: <functions/patterns/fixtures to carry forward>",
    "LEARNED:  <project-specific insight — not generic>",
    "```",
    "",
    "### Every 3rd chunk OR at complexity spike: CONTEXT REFRESH",
    "",
    "```",
    "[CONTEXT REFRESH]",
    "PROJECT STATE: <restate primary goal verbatim from above; current chunk; completed+verified; remaining>",
    "DRIFT CHECK: <has direction shifted? am I solving the stated problem?>",
    "COMPOUND STATUS: <which built capabilities am I actively using? underutilized?>",
    "EFFICIENCY OBSERVATION: <given what I now know, is there a better approach for next chunk?>",
    "```",
    "",
  ].join("\n");
}

export function buildScenarioGateBlock({
  gatePath = null,
  runnerCmd = null,
} = {}) {
  if (!gatePath) return "";
  const cmd = runnerCmd || `bash ${gatePath}/scenarios/runner.sh --json --timeout 15`;
  return [
    "## Scenario Gate (blind-eval, runs between every chunk)",
    "",
    `**Gate enabled at:** \`${gatePath}\``,
    "",
    "Source: `frameworks/FACTORY_OPERATING_MANUAL.md` — build/eval separation.",
    "The gate runs **after** every chunk's `[EVAL LOOP]` and **before**",
    "`[COMPOUND]` register. The chunk does not close until the gate passes.",
    "",
    "**Required command at chunk end:**",
    "",
    "```bash",
    cmd,
    "```",
    "",
    "**Pass policy:**",
    "",
    "- All scenarios `PASS` or `SKIP` → chunk allowed to close, proceed to `[COMPOUND]`",
    "- Any `FAIL` or `TIMEOUT` → chunk blocked. Read only the `builder_feedback.json`",
    "  artifacts for failing scenarios. Do **not** open `human_debug.txt` or",
    "  `twin_call_log.jsonl` — those are operator-only per the threat model.",
    "- After fixing, re-run the gate. Iterate up to 3 times. If still failing,",
    "  set `[EVAL LOOP] DECISION = escalate` and surface to operator.",
    "",
    "**Hard rules (per `frameworks/THREAT_MODEL_TEACHING_TO_THE_TEST.md`):**",
    "",
    `- Do NOT read scenarios under \`${gatePath}/scenarios/\` directly. The gate is a blind eval.`,
    `- Do NOT modify files under \`${gatePath}/\` — it is the eval reference, not your build target.`,
    "- Do NOT include any artifact paths or scenario IDs in your code or commit messages.",
    "",
  ].join("\n");
}

export function buildEvalLoopBlock({ tier = "production" } = {}) {
  const minPraise = tier === "cutting-edge" ? 3 : 2;
  const minCritique = tier === "cutting-edge" ? 3 : 2;
  return [
    "## Eval Loop (run BEFORE Compound Register at every chunk boundary)",
    "",
    "Pure adversarial review (find weaknesses) without structured praise causes",
    "agents to drift away from approaches that actually worked. The Eval Loop",
    "captures both — what to fix AND what to keep doing — so the chunk produces",
    "a forward-pointing decision, not just a critique.",
    "",
    "Source: validated principle from operator's own memory system",
    "(\"Record from failure AND success\") + extension of",
    "`frameworks/QUALITY_GATE.md`.",
    "",
    "**Run this block visibly at chunk end, BEFORE `[COMPOUND]` register.**",
    "",
    "```",
    "[EVAL LOOP — chunk <N>]",
    `CRITIQUE (≥${minCritique}):   what is weak / could fail / would surprise a reviewer`,
    `PRAISE   (≥${minPraise}):   what works genuinely well / should be kept doing`,
    "PRESERVE:        which patterns from PRAISE must propagate to next chunks",
    "FIX:             which CRITIQUE items must be fixed before this chunk closes",
    "DEFER:           CRITIQUE items accepted as conscious trade-offs (logged)",
    "DECISION:        proceed | rework | escalate",
    "```",
    "",
    "**Rules:**",
    "",
    `- CRITIQUE and PRAISE both require ≥${minCritique} concrete entries each. Neither side may be empty.`,
    "- PRAISE entries must be specific (not \"the code is good\" — instead",
    "  \"the runner.sh `--json` flag emits a parseable result-per-scenario object",
    "  that the integration layer can consume directly\").",
    "- PRESERVE binds the next chunk: it carries the named patterns forward.",
    "- DECISION = `rework` blocks `[COMPOUND]` register and re-runs this chunk.",
    "- DECISION = `escalate` surfaces to operator and pauses the chain.",
    "",
    "**Live debate substrate (preferred):** `factory/v2-personas/` is bundled in",
    "this package. Run a 3-persona Critic/Appreciator/Decider debate instead of",
    "self-evaluating:",
    "",
    "```bash",
    "# 1. Write a chunk-result proposal JSON (signals keyed by criterion id):",
    "cat > /tmp/chunk-eval.proposal.json <<'JSON'",
    "{",
    "  \"title\": \"Chunk N result review\",",
    "  \"signals\": {",
    "    \"acceptance_met\": \"pass\",",
    "    \"tests_green\": \"pass\",",
    "    \"open_risks\": \"unknown\"",
    "  }",
    "}",
    "JSON",
    "",
    "# 2. Run the debate (uses the operator-ask config by default):",
    "node factory/v2-personas/debate.mjs \\",
    "  --config factory/v2-personas/examples/operator-ask.config.json \\",
    "  --proposal /tmp/chunk-eval.proposal.json --json",
    "",
    "# 3. Map the artifact: recommendations → DECISION, criteria comments →",
    "#    CRITIQUE/PRAISE, escalations → escalate to operator.",
    "```",
    "",
    "If the debate returns `status: \"escalated\"` or `\"no_consensus\"`, the",
    "DECISION is automatically `escalate` — no agent override.",
    "",
    "**Why this is mandatory, not optional:**",
    "",
    "Without PRAISE, agents over-correct on every cycle and lose validated",
    "approaches. Without DECISION, eval becomes a status report instead of a",
    "gate. Without PRESERVE, compound effect leaks: each chunk re-discovers",
    "what the previous chunk already proved.",
    "",
  ].join("\n");
}

export function buildQualityGateBlock({ tier = "production" } = {}) {
  const tierDef = TIER_DEFS[tier] || TIER_DEFS.production;
  return [
    "## Quality Gate (run internally before declaring chunk done)",
    "",
    `Source: \`frameworks/QUALITY_GATE.md\`. **Tier:** ${tierDef.label} — ${tierDef.qualityGateThreshold}`,
    "",
    "**Process (90% build, 10% review — never invert):**",
    "",
    "1. Simulate the strongest competing model as reviewer (Claude → simulate GPT-5; GPT → simulate Opus).",
    "2. Score along the 5 dimensions:",
    "   - **Correctness** — does it match the spec? edge cases?",
    "   - **Architecture** — motivated structure? unnecessary layers?",
    "   - **Cost-efficiency** — same result, cheaper?",
    "   - **Maintainability** — readable in 3 months?",
    "   - **Originality** — genuine fit or copy-paste?",
    "3. Find the 2–3 weakest points.",
    "4. Fix what's fixable; document the rest as conscious trade-offs.",
    `5. Decide: would the simulated reviewer call this **${tierDef.label}**-tier?`,
    "",
    "**Append at end of chunk delivery:**",
    "",
    "```",
    "## Quality Gate",
    "Delivery: <one sentence>",
    "Reviewed against: <Opus 4.7 / GPT-5 / o3> (simulated)",
    "Weaknesses I fixed: <- what → fix → dimension>",
    "Remaining weaknesses (honest): <- specific trade-offs>",
    `${tierDef.label} grade? <Yes/No/Almost — one sentence why>`,
    "```",
    "",
  ].join("\n");
}

export function buildDebateBlock({ topic = "" } = {}) {
  if (!topic || typeof topic !== "string" || !topic.trim()) return "";
  const t = topic.trim();
  return [
    "## Pre-decision Debate (factory/v2-personas)",
    "",
    `**Topic:** ${t}`,
    "",
    "Before committing to a controversial design or risky trade-off in this",
    "package, run a structured N-persona debate so the decision is recorded",
    "with rationale and dissent — not just a unilateral agent call.",
    "",
    "```bash",
    "cat > /tmp/debate-topic.proposal.json <<'JSON'",
    "{",
    `  "title": ${JSON.stringify(t)},`,
    `  "question": ${JSON.stringify(t)},`,
    "  \"signals\": {",
    "    \"reversibility\": \"unknown\",",
    "    \"blast_radius\": \"unknown\",",
    "    \"stakeholder_impact\": \"unknown\"",
    "  }",
    "}",
    "JSON",
    "",
    "node factory/v2-personas/debate.mjs \\",
    "  --config factory/v2-personas/examples/operator-ask.config.json \\",
    "  --proposal /tmp/debate-topic.proposal.json --json",
    "```",
    "",
    "Attach the resulting `v2-personas.decision.v1` artifact to the chunk's",
    "`[COMPOUND]` register. If the debate escalates, surface to the operator",
    "with the artifact instead of pushing the decision through.",
    "",
  ].join("\n");
}

export function buildKickoffWithPhase0({
  goal = "",
  description = "",
  packageName = "",
  nodes = [],
  tier = "production",
  chunkPlan = null,
  gatePath = null,
  prefill = null,
  autoOnboard = false,
  debateTopic = "",
} = {}) {
  const baseKickoff = buildKickoff({ goal, description, packageName, nodes });
  const phase0 = buildPhase0Block({ goal, tier, chunkPlan, prefill });
  const compound = buildCompoundBlock();
  const evalLoop = buildEvalLoopBlock({ tier });
  const scenarioGate = buildScenarioGateBlock({ gatePath });
  const qualityGate = buildQualityGateBlock({ tier });
  const debate = buildDebateBlock({ topic: debateTopic });

  // Optional pre-onboarding banner — operator certifies onboarding occurred upstream
  const onboardingBlock = autoOnboard
    ? [
        "## Pre-onboarding (operator-confirmed)",
        "",
        "> The operator has confirmed that the executing agent has read",
        "> `AGENT_ONBOARDING.md` and verified all 8 onboarding gates upstream of",
        "> this package. The executing agent should still append its own",
        "> `ONBOARDED:` signature line in its first user-facing message,",
        "> certifying that it personally completed the gates.",
        "",
      ].join("\n")
    : "";

  // Order at end: Debate (pre-decision, optional) → Compound (per-chunk rituals) → Eval Loop (critique+praise) → Scenario Gate (blind eval if enabled) → Quality Gate (final).
  const tailBlocks = [debate, compound, evalLoop, scenarioGate, qualityGate].filter(Boolean).join("\n");

  const headerEnd = baseKickoff.indexOf("\n## Goal");
  if (headerEnd === -1) {
    return `${onboardingBlock}\n${phase0}\n${baseKickoff}\n${tailBlocks}`.trim() + "\n";
  }
  const head = baseKickoff.slice(0, headerEnd);
  const tail = baseKickoff.slice(headerEnd);
  return `${head}\n\n${onboardingBlock}${onboardingBlock ? "\n" : ""}${phase0}${tail}\n\n${tailBlocks}`.trim() + "\n";
}

export const TIERS = Object.keys(TIER_DEFS);

const browserApi = {
  slugifyLabel,
  buildClaudeMd,
  buildReadme,
  buildKickoff,
  buildKickoffWithPhase0,
  buildPhase0Block,
  buildCompoundBlock,
  buildEvalLoopBlock,
  buildScenarioGateBlock,
  buildQualityGateBlock,
  buildDebateBlock,
  TIERS,
};

if (typeof globalThis !== "undefined" && typeof globalThis.window !== "undefined") {
  globalThis.KickoffTemplate = browserApi;
}
