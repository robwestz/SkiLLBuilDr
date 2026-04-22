import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildClaudeMd,
  buildKickoff,
  buildReadme,
  slugifyLabel,
} from "../kickoff-template.mjs";

function sampleNode(name, slug, description, content = "") {
  return { name, slug, description, content };
}

test("slugifyLabel derives a stable package slug", () => {
  assert.equal(slugifyLabel("Build a SaaS onboarding assistant"), "build-a-saas-onboarding-assistant");
  assert.equal(slugifyLabel("CLI: Ship It Fast!"), "cli-ship-it-fast");
});

test("buildKickoff: SaaS scenario includes goal, skills, deliverables, and execution order", () => {
  const text = buildKickoff({
    goal: "Build a SaaS onboarding assistant",
    description: "A hosted web app with auth, billing, and guided setup.",
    packageName: "saas-onboarding-assistant",
    nodes: [
      sampleNode("200k-blueprint", "/agents:200k-blueprint", "Turn a concept into a technical blueprint."),
      sampleNode("agent-plan-phase", "/agents:agent-plan-phase", "Break roadmap phases into executable plans."),
      sampleNode("build-web-apps:frontend-skill", "/plugins:frontend-skill", "Ship a polished web UI."),
    ],
  });

  assert.match(text, /^# KICKOFF: saas-onboarding-assistant/m);
  assert.match(text, /## Goal[\s\S]*Build a SaaS onboarding assistant/);
  assert.match(text, /## Included Skills[\s\S]*\/agents:200k-blueprint/);
  assert.match(text, /## Execution Plan[\s\S]*Step 1: 200k-blueprint/);
  assert.match(text, /## Deliverables[\s\S]*auth/i);
  assert.match(text, /## Success Criteria[\s\S]*ready for handoff/i);
});

test("buildKickoff: CLI scenario emphasizes commands, tests, and packaging", () => {
  const text = buildKickoff({
    goal: "Build a CLI tool for release automation",
    description: "The tool should publish changelogs, tag releases, and validate the repo first.",
    packageName: "release-cli",
    nodes: [
      sampleNode("agent-framework", "/agents:agent-framework", "Structured execution framework."),
      sampleNode("test-driven-development", "/agents:test-driven-development", "Write tests before implementation."),
      sampleNode("ship-commit-pr", "/recipes:ship-commit-pr", "Ship, commit, and open a PR."),
    ],
  });

  assert.match(text, /release-cli/);
  assert.match(text, /CLI tool for release automation/);
  assert.match(text, /command interface/i);
  assert.match(text, /test coverage/i);
  assert.match(text, /packaging/i);
});

test("buildKickoff: data pipeline scenario calls out ingestion, validation, and operations", () => {
  const text = buildKickoff({
    goal: "Set up a data pipeline for weekly revenue reporting",
    description: "Ingest from Stripe and Postgres, normalize the data, and produce scheduled reports.",
    packageName: "weekly-revenue-pipeline",
    nodes: [
      sampleNode("data-pipeline", "/templates:data-pipeline", "Template for ETL and analytics systems."),
      sampleNode("advanced-evaluation", "/agents:advanced-evaluation", "Evaluate quality and output consistency."),
      sampleNode("agent-execute-plan", "/agents:agent-execute-plan", "Run the next plan from PLAN.md."),
    ],
  });

  assert.match(text, /weekly-revenue-pipeline/);
  assert.match(text, /ingestion/i);
  assert.match(text, /validation/i);
  assert.match(text, /operations/i);
  assert.match(text, /scheduled reports/i);
});

test("buildClaudeMd lists selected slugs only once", () => {
  const text = buildClaudeMd({
    nodes: [
      sampleNode("one", "/a:one", "First"),
      sampleNode("two", "/a:two", "Second"),
      sampleNode("one", "/a:one", "Duplicate"),
      sampleNode("custom", "", "No slug", "Custom instructions"),
    ],
  });

  const lines = text.split("\n").filter((line) => line.startsWith("- `"));
  assert.deepEqual(lines, [
    "- `/a:one` - First",
    "- `/a:two` - Second",
  ]);
});

test("buildReadme summarizes the package and included assets", () => {
  const text = buildReadme({
    goal: "Build a SaaS onboarding assistant",
    packageName: "saas-onboarding-assistant",
    description: "A hosted web app with auth, billing, and guided setup.",
    nodes: [
      sampleNode("200k-blueprint", "/agents:200k-blueprint", "Turn a concept into a technical blueprint."),
      sampleNode("agent-plan-phase", "/agents:agent-plan-phase", "Break roadmap phases into executable plans."),
    ],
  });

  assert.match(text, /^# saas-onboarding-assistant/m);
  assert.match(text, /KICKOFF\.md/);
  assert.match(text, /CLAUDE\.md/);
  assert.match(text, /workflows\//);
});
