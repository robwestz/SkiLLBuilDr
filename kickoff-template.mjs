function uniqueNodes(nodes = []) {
  const seen = new Set();
  return nodes.filter((node) => {
    const key = node?.slug || node?.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slugifyLabel(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "workspace-package";
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

const browserApi = {
  slugifyLabel,
  buildClaudeMd,
  buildReadme,
  buildKickoff,
};

if (typeof globalThis !== "undefined" && typeof globalThis.window !== "undefined") {
  globalThis.KickoffTemplate = browserApi;
}
