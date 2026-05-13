// lib/routine.mjs — minimal routine.v1 loader + validator.
// Zero npm deps (project rule). Not a full JSON-Schema validator — checks the
// fields we actually depend on so the Fas 3 runner has stable inputs.
//
// Schema source of truth: schemas/routine.v1.json.

import { readFileSync } from "node:fs";

export const ROUTINE_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const CADENCES = new Set(["manual", "cron", "trigger"]);
const STEP_KINDS = new Set(["skill", "command", "shell", "handoff", "assemble", "kb_query"]);
const VERIFY_KINDS = new Set(["command", "exit_zero", "artifact", "manual"]);
const FAILURE_MODES = new Set(["escalate", "retry", "continue"]);
const TIERS_ALLOWED = new Set(["mvp", "production", "cutting-edge"]);

/**
 * Validate a parsed routine object against the v1 contract.
 * @returns {{ok: true, errors: []} | {ok: false, errors: string[]}}
 */
export function validateRoutine(routine) {
  const errors = [];
  if (!routine || typeof routine !== "object") {
    return { ok: false, errors: ["routine must be an object"] };
  }
  if (routine.version !== ROUTINE_VERSION) {
    errors.push(`version must equal ${ROUTINE_VERSION}, got ${routine.version}`);
  }
  if (typeof routine.id !== "string" || !ID_PATTERN.test(routine.id)) {
    errors.push("id must be a kebab-case string matching ^[a-z0-9][a-z0-9._-]{1,79}$");
  }
  if (typeof routine.title !== "string" || routine.title.length === 0) {
    errors.push("title must be a non-empty string");
  }
  if (!CADENCES.has(routine.cadence)) {
    errors.push(`cadence must be one of ${[...CADENCES].join(", ")}`);
  }
  if (!Array.isArray(routine.steps) || routine.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    routine.steps.forEach((step, i) => {
      const ctx = `steps[${i}]`;
      if (!step || typeof step !== "object") {
        errors.push(`${ctx} must be an object`);
        return;
      }
      if (!STEP_KINDS.has(step.kind)) {
        errors.push(`${ctx}.kind must be one of ${[...STEP_KINDS].join(", ")}`);
      }
      if (typeof step.ref !== "string" || step.ref.length === 0) {
        errors.push(`${ctx}.ref must be a non-empty string`);
      }
      if (step.args !== undefined && (typeof step.args !== "object" || step.args === null || Array.isArray(step.args))) {
        errors.push(`${ctx}.args must be a plain object when present`);
      }
      if (step.verify !== undefined) {
        if (typeof step.verify !== "object" || step.verify === null) {
          errors.push(`${ctx}.verify must be an object`);
        } else if (!VERIFY_KINDS.has(step.verify.kind)) {
          errors.push(`${ctx}.verify.kind must be one of ${[...VERIFY_KINDS].join(", ")}`);
        } else if (step.verify.kind === "command" && typeof step.verify.command !== "string") {
          errors.push(`${ctx}.verify.command required when verify.kind=command`);
        } else if (step.verify.kind === "artifact" && typeof step.verify.path !== "string") {
          errors.push(`${ctx}.verify.path required when verify.kind=artifact`);
        }
      }
      if (step.on_failure !== undefined && !FAILURE_MODES.has(step.on_failure)) {
        errors.push(`${ctx}.on_failure must be one of ${[...FAILURE_MODES].join(", ")}`);
      }
    });
  }
  if (routine.triggers !== undefined && !Array.isArray(routine.triggers)) {
    errors.push("triggers must be an array when present");
  }
  if (routine.metadata && routine.metadata.tier && !TIERS_ALLOWED.has(routine.metadata.tier)) {
    errors.push(`metadata.tier must be one of ${[...TIERS_ALLOWED].join(", ")}`);
  }
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

/**
 * Load + parse + validate a routine from disk.
 * Throws on parse failure or validation failure with a readable message.
 */
export function loadRoutine(absPath) {
  const raw = readFileSync(absPath, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`routine: failed to parse JSON at ${absPath}: ${err.message}`);
  }
  const result = validateRoutine(parsed);
  if (!result.ok) {
    throw new Error(`routine: invalid v1 document at ${absPath}:\n  - ${result.errors.join("\n  - ")}`);
  }
  return parsed;
}

/**
 * Build a routine document from a recipe entry (recipes.json format).
 * Pure transformation — proves recipes can be expressed as routines without
 * touching skill bodies. Used by Fas 2 example routines and Fas 3 runner.
 */
export function recipeToRoutine(recipe, { cadence = "manual" } = {}) {
  if (!recipe || typeof recipe !== "object" || typeof recipe.id !== "string") {
    throw new Error("recipeToRoutine: recipe must have an id");
  }
  const steps = (recipe.slugs || []).map((slug) => ({
    kind: "skill",
    ref: slug,
  }));
  return {
    version: ROUTINE_VERSION,
    id: recipe.id,
    title: recipe.title || recipe.id,
    description: recipe.description || "",
    intent: recipe.intent || recipe.title || "",
    cadence,
    steps,
    metadata: {
      source_recipe_id: recipe.id,
    },
  };
}
