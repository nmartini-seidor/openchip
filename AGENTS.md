# AGENTS.md

This repository follows a long-running agent harness pattern inspired by Anthropic's guidance:
https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

## Purpose
Use short, repeatable coding sessions coordinated by persistent tracking artifacts so work can continue safely across long tasks, restarts, or model context resets.

## Operating Model
There are two agent roles:

1. Initializer agent
2. Coding agent

### 1) Initializer Agent Responsibilities
- Read `supplier-onboarding-implementation-plan.md`.
- Create or refresh `feature_list.json` with the full feature backlog.
- Create or refresh `claude-progress.md` with current execution snapshot.
- Ensure each feature has:
  - stable `id`
  - clear `title`
  - `status` (`pending`, `in_progress`, `completed`, `blocked`)
  - `dependencies` (array of feature ids)
  - `acceptance_criteria`
  - `verification_steps`

### 2) Coding Agent Responsibilities (Per Session)
- Read, in order:
  - `AGENTS.md`
  - `feature_list.json`
  - `claude-progress.md`
- Pick only features that are unblocked by dependencies.
- Keep each session bounded and coherent (one feature or one small feature batch).
- Implement changes, then run relevant verification commands.
- Update tracking artifacts before ending session.

## Required Artifacts

### `feature_list.json`
Machine-readable source of truth for progress.

Suggested shape:

```json
{
  "version": 1,
  "last_updated": "2026-03-05T00:00:00Z",
  "features": [
    {
      "id": "F-001",
      "title": "Example feature",
      "status": "pending",
      "dependencies": [],
      "acceptance_criteria": ["..."],
      "verification_steps": ["..."],
      "notes": ""
    }
  ]
}
```

### `claude-progress.md`
Human-readable running log.

Must include:
- current objective
- active feature id(s)
- latest completed work
- blockers/risks
- exact next step

## Session Protocol
For every coding run:

1. Sync context from `feature_list.json` and `claude-progress.md`.
2. Move selected feature(s) to `in_progress`.
3. Implement with minimal unrelated edits.
4. Run verification for touched scope.
5. Update feature status:
   - `completed` only if acceptance criteria + checks pass
   - `blocked` with concrete blocker details otherwise
6. Append a concise progress entry to `claude-progress.md`.

## Verification Rules
Always run the smallest sufficient checks for changed scope:
- unit tests for affected modules
- typecheck/lint for affected packages
- integration/e2e checks when workflow-critical paths change
- rebuild and restart containers with `docker compose up -d --build --force-recreate` after every repository change

Never mark a feature `completed` without recording which checks ran and whether they passed.

## Git and Change Hygiene
- Make focused commits aligned to one feature or one coherent batch.
- Do not mix refactors with unrelated behavior changes.
- If unexpected unrelated repository changes are detected, stop and ask for direction.

## Completion Criteria
A task stream is complete when:
- all planned features are `completed`
- no unresolved `blocked` items remain
- verification steps are recorded for each feature
- `claude-progress.md` ends with a final summary and handoff notes
