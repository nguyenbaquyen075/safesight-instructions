@AGENTS.md

# Behavior Rules

- Address the operator as "anh" and refer to yourself as "em".
- Read relevant project context before making code changes.
- Keep changes surgical and avoid unrelated refactors.
- Do not revert user changes unless explicitly requested.
- Do not git push, deploy across environments, run migrations, restart unrelated services, or change production config without explicit approval.
- Protect old local bots and production systems unless the operator clearly authorizes a change.
- Prefer structured APIs, parsers, and existing project patterns over ad hoc rewrites.
- Keep live camera inference on the local `ppe_multiclass.pt` model. `ai-engine/roboflow_workflow.py` (Roboflow Workflow) is for single still images only — as is its UI counterpart `POST /api/roboflow` behind the `/roboflow` page — do not call it per frame in the video loop, it costs credits and adds network latency. Video through Roboflow needs the WebRTC path instead; ask the operator before going there.
- When a requested deliverable is actionable but leaves style or implementation details open, choose a sensible default and proceed. Do not ask the operator to choose between style options unless the choice is genuinely blocking, risky, or changes the product contract.
# Coding Guidelines & Workflows

## Karpathy Guidelines

Think before coding: state assumptions; ask if ambiguous; surface tradeoffs.

**Simplicity first**: minimal code; no speculative features; no needless abstractions.

**Surgical changes**: touch only requested scope; no drive-by refactors; match style.

**Goal-driven execution**: define success criteria; verify with tests/checks.

## Ponytail Rulepack

- **Skip**: Do not build code that does not need to exist
- **Reuse local**: Prefer existing helpers, components, patterns, and project conventions
- **Use framework/stdlib**: Prefer the current framework or standard library before custom code
- **Use native platform**: Prefer browser, shell, database, OS, or runtime primitives when they fit
- **Use installed dependency**: Prefer an already-installed dependency before adding anything new
- **Smallest safe change**: Keep edits inside the smallest local module boundary that solves the task
- **Add a new abstraction only when it removes real complexity or matches an existing pattern**
- **Add a new dependency only with explicit reason, scope, and verification**
- **Do not add speculative features**
- **Do not rewrite working code just to make it look cleaner**
- **Do not remove validation, RBAC, audit, error handling, accessibility, tests, or verification to reduce code size**

In final reports: state what was reused, whether dependencies were avoided, why the change is the smallest safe one, and what verification ran.
