```markdown
# SkiLLBuilDr Development Patterns

> Auto-generated skill from repository analysis

## Overview

SkiLLBuilDr is a TypeScript monorepo focused on agent-based prototypes and workspaces for skill-building automation. The repository emphasizes modular workspace structure, clear commit conventions, and reproducible agent workflows. This skill teaches best practices for organizing TypeScript projects without a framework, maintaining code consistency, and managing monorepo workflows for adding new workspaces and releasing versions.

## Coding Conventions

**File Naming**
- Use **PascalCase** for filenames.
  - Example: `AgentLogic.ts`, `SkillRanker.ts`

**Import Style**
- Use **absolute imports** for modules.
  - Example:
    ```typescript
    import { SkillRanker } from 'workspaces/SkillAgent/agent/SkillRanker'
    ```

**Export Style**
- Use **named exports**.
  - Example:
    ```typescript
    // In SkillRanker.ts
    export function rankSkills(skills: string[]): string[] {
      // ...
    }
    ```

**Commit Messages**
- Follow **conventional commit** style.
- Prefixes: `chore:`, `test:`, `feat:`
- Example:
  ```
  feat: add initial agent logic for workspace SkillAgent
  chore: bump version to 1.2.0
  test: add test cases for skill ranking
  ```

## Workflows

### Add New Workspace or Prototype
**Trigger:** When introducing a new experimental workspace or agent-based prototype  
**Command:** `/new-workspace`

1. Create a new directory under `workspaces/` with your workspace name.
2. Add agent logic files (e.g., `agent/bdi.mjs`, `agent/llm.mjs`, `agent/assembler.mjs`, `agent/ranker.mjs`).
3. Add prompt files (e.g., `prompts/rank-skills.md`).
4. Add test cases (e.g., `test-cases/*.json`).
5. Add outputs for sample runs:
   - `outputs/<project>/CLAUDE.md`
   - `outputs/<project>/KICKOFF.md`
   - `outputs/<project>/REASONING.md`
   - `outputs/<project>/workflows/main.yaml`
6. Add or update `package.json` for the workspace.
7. Include documentation files (e.g., `CLAUDE.md`, `KICKOFF.md`).

**Example Directory Structure:**
```
workspaces/
  MyWorkspace/
    agent/
      bdi.mjs
      llm.mjs
      assembler.mjs
      ranker.mjs
    prompts/
      rank-skills.md
    test-cases/
      sample-test.json
    outputs/
      sample-run/
        CLAUDE.md
        KICKOFF.md
        REASONING.md
        workflows/
          main.yaml
    package.json
    CLAUDE.md
    KICKOFF.md
```

### Release Version Bump and Changelog
**Trigger:** When preparing and publishing a new release  
**Command:** `/release`

1. Update `CHANGELOG.md` with all notable changes since the previous release.
2. Update the version number in `package.json`.
3. Commit both files with a `chore:` message indicating the new version.

**Example Commit Message:**
```
chore: release v1.3.0
```

## Testing Patterns

- Test files follow the pattern `*.test.*` (e.g., `SkillRanker.test.ts`).
- Testing framework is not specified; ensure test files are colocated with the code or in a dedicated `test-cases/` directory.
- Example test file:
  ```typescript
  // SkillRanker.test.ts
  import { rankSkills } from './SkillRanker'

  test('ranks skills by relevance', () => {
    const result = rankSkills(['TypeScript', 'JavaScript', 'Python'])
    expect(result[0]).toBe('TypeScript')
  })
  ```

## Commands

| Command         | Purpose                                                      |
|-----------------|--------------------------------------------------------------|
| /new-workspace  | Scaffold a new workspace or prototype in the monorepo        |
| /release        | Prepare and publish a new release with changelog and version |
```
