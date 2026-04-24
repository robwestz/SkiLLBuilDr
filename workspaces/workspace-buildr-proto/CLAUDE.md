# WorkspaceBuildR — Skill Declarations

This file declares the skills WorkspaceBuildR uses and why each one is causally necessary for workspace assembly. This is not a list of "useful tools" — it is a reasoned set of capabilities where each skill has a traceable causal path to the agent's output quality.

---

## Active Skills

```yaml
skills:
  - slug: /everything-claude-code:planner
    reason: >
      Workspace assembly requires decomposing a natural-language goal into an
      ordered sequence of verifiable phases. The planner skill causes goal
      decomposition to be systematic rather than ad hoc, which is required
      because generated workflows/main.yaml must have a coherent task order
      that another agent can execute without backtracking.

  - slug: /everything-claude-code:code-reviewer
    reason: >
      Generated workspace packages include code-level configurations (YAML
      workflows, package.json, agent scripts). The code-reviewer skill causes
      these artifacts to meet production quality standards — catching structural
      errors, missing error handling, and anti-patterns before the package is
      used. Without this, generated packages may contain code that silently
      fails at runtime.

  - slug: /everything-claude-code:security-reviewer
    reason: >
      Workspace packages configure agent permissions, API access, and
      environment variables. The security-reviewer skill causes security
      properties (secret handling, permission scope, injection risk) to be
      checked at generation time. This is required because workspace packages
      are used as starting contexts for autonomous agents, where security
      defects compound across the agent's full execution.

  - slug: /everything-claude-code:tdd-guide
    reason: >
      The assembler's correctness can only be verified by testing skill
      selection against known-good expectations (the test-cases/ directory).
      The tdd-guide skill causes test-first discipline to be applied to the
      assembler itself, ensuring that new deliberation logic is validated
      before being trusted in production runs. This is the only reliable way
      to prevent regression in causal reasoning quality.

  - slug: bdi-mental-states
    reason: >
      WorkspaceBuildR's core architecture is BDI (Belief-Desire-Intention).
      The bdi-mental-states skill causes the agent to apply formal cognitive
      architecture patterns: beliefs grounded in world state, desires motivated
      by beliefs, intentions justified and ordered as plans. This is required
      because causality-driven skill selection is not achievable with simple
      scoring functions — it requires a deliberation cycle that distinguishes
      "this skill is associated with the goal domain" from "this skill causes
      a desire the goal requires to be fulfilled."
```

---

## Skill Interaction Model

These skills do not operate independently — they form a causal chain:

```
bdi-mental-states
    → structures deliberation (belief/desire/intention cycle)
    → produces raw skill selection with causal chains
         ↓
/everything-claude-code:planner
    → orders intentions into executable workflow phases
    → produces workflows/main.yaml task sequence
         ↓
/everything-claude-code:tdd-guide
    → validates assembler correctness via test-cases/
    → prevents regression in reasoning quality
         ↓
/everything-claude-code:code-reviewer
    → reviews generated YAML + package artifacts
    → ensures production-grade output
         ↓
/everything-claude-code:security-reviewer
    → audits permission scopes + secret handling
    → ensures packages are safe to hand to autonomous agents
```

---

## Rejected Skills (with reasons)

These skills were considered and explicitly excluded:

| Skill | Reason for rejection |
|-------|----------------------|
| `/everything-claude-code:go-review` | No causal path: WorkspaceBuildR produces JS/YAML, not Go. Including this would be pattern matching ("agent" → "Go") not causality. |
| `/everything-claude-code:database-reviewer` | No causal path: workspace packages do not include database schemas. This skill would have no artifact to act on. |
| `/everything-claude-code:python-review` | No causal path: the assembler is a Node.js ESM project. Python review has no causal connection to output quality here. |
| `/everything-claude-code:flutter-review` | No causal path: workspace packages target server/CLI agents, not mobile UI. Zero overlap with desired outcomes. |

---

## Notes for Inheriting Agents

If you are an agent reading this workspace:

1. The skills listed above are the minimum set for maintaining WorkspaceBuildR
2. Do not add skills without writing a causal justification in the same format
3. The bdi-mental-states skill is foundational — do not remove it without replacing the deliberation architecture
4. All skill justifications follow the pattern: "This skill **causes** X, which is **required** because Y"
