# AI_WORK_SYSTEM.md

This file describes how the user and AI agent should work together on this
project without bloating context, duplicating rules, or turning every task into
process theater.

## Purpose

The goal is to make project management and development faster, clearer, and
more reliable. The system should help the user give the agent enough context
upfront, and help the agent choose the right level of research, planning,
implementation, and verification.

## The Three-Layer Context System

Use three stable files:

1. `AGENTS.md`
   - Short global rules for AI agents.
   - Loaded often, so it must stay compact.
   - Use it for facts needed in almost every task.

2. `PROJECT_MAP.md`
   - Codebase map and navigation guide.
   - Use it to find the right files quickly.

3. `AI_WORK_SYSTEM.md`
   - Detailed work process, task templates, skills, agent roles, and context
     checklists.
   - Use it when planning how to work, onboarding a new agent, or improving the
     system.

Rule of thumb: if the model needs it every session, put it in `AGENTS.md`; if
it helps find code, put it in `PROJECT_MAP.md`; if it explains how to work, put
it here.

## Context Budget Rules

- Prefer short, specific rules over long philosophical instructions.
- Do not repeat the same rule in many files.
- Do not add a rule after one mistake; add it after the same mistake repeats or
  after it prevents a real risk.
- Put area-specific rules close to that area instead of global context.
- Turn long procedures into skills/checklists, not global instructions.
- Keep examples short and realistic.
- Review these files periodically and delete stale rules.

## What "Skill Leakage" Means

Skill leakage happens when instructions or behavior meant for one narrow skill
spill into unrelated tasks.

Examples:

- A "security review" skill makes the agent over-focus on vulnerabilities while
  doing a small UI copy change.
- A "frontend polish" skill makes the agent redesign a page during a bugfix.
- A "performance" skill causes premature optimization in code that is not slow.
- A skill includes too much project policy and starts contradicting `AGENTS.md`.

How to avoid it:

- Each skill must have a narrow trigger.
- Each skill must say when not to use it.
- Skills should return to normal project rules after the task.
- Skills should reference shared rules instead of duplicating them.
- Do not load all skills by default. Use only the one that matches the task.

## Good Task Brief Template

Use this when the task matters or has several moving parts:

```text
Mode: feature | bugfix | review | research | plan | release

Goal:
What should change from the user's point of view?

Current state:
What happens now? Include links, screenshots, error text, or affected route.

Expected result:
What should happen instead?

Scope:
Files/areas likely involved. Say what should not be changed.

Constraints:
Design rules, deadlines, permissions, browser/device, data rules, language,
performance, security, compatibility.

Examples:
One or two examples of desired behavior or similar existing UI.

Tools/checks:
How to verify: local server, browser flow, SQL check, manual scenario, test
command, deployment command.

Relevant docs/RAG:
Links or files the agent should read before editing.

History:
Previous attempts, decisions, known pitfalls, related bugs.
```

## Example Of Giving The Whole Environment

```text
Mode: feature

Goal:
In Planner, let admin add a "start date" while creating a task. Staff should see
the date in task detail and board cards.

Current state:
Task detail already shows start dates when they exist. The quick-create dialog
does not expose the field.

Expected result:
Admin opens Planner -> New task -> sees "Дата старта" field -> saves -> task
appears with start date on board and detail. Existing tasks must keep working.

Scope:
Likely files: js/planner/planner_actions.js, js/planner/planner_api.js,
js/planner/planner_presenters.js, js/views/planner.js, maybe CSS.
Do not change auth, project comments, or admin sections.

Constraints:
Use existing Russian UI tone. Keep plain JS. Escape dynamic HTML. Do not add a
new date library. Do not change database schema unless the field is missing.

Examples:
Use existing due date field style as the model for the new start date field.

Tools/checks:
Run local static server if needed. Manually verify #/planner as admin and a
staff user if possible. Inspect Supabase field usage before editing.

Relevant docs/RAG:
Read AGENTS.md and PROJECT_MAP.md. Inspect existing start_date usages.

History:
Planner detail has had race issues when switching tasks quickly, so avoid
adding async behavior that updates stale task DOM.
```

## All Context Components A Project Should Have

### Business Context

Human explanation:
What the project exists to accomplish, what business process it supports, what
success looks like, and what failure costs.

Model-friendly version:
"This product helps [team] do [workflow] so that [business outcome]. Optimize
for [speed/accuracy/clarity/reliability]. Avoid changes that break [critical
process]."

### Users And Roles

Human explanation:
Who uses the product, what each role is allowed to do, what they care about,
and where they usually make mistakes.

Model-friendly version:
"Roles: admin can [...], staff can [...], guest cannot [...]. Important user
paths: [...]. Role boundaries must be enforced in backend policies, not only UI."

### Core Workflows

Human explanation:
The 5-10 flows that matter most: create task, assign person, update status,
open project, add comment, export data, publish content, receive notification.

Model-friendly version:
"Critical flows to preserve: 1. ... 2. ... 3. ... Any change touching these
must include a manual verification scenario."

### Domain Vocabulary

Human explanation:
Words that mean something specific in your business: project, task, template,
checklist, article, staff, admin, archive, problem, done.

Model-friendly version:
"Use these terms exactly: [...]. Do not rename UI labels unless requested."

### Product Requirements

Human explanation:
What the product must do now and what is planned later.

Model-friendly version:
"Current requirements: [...]. Future ideas: [...]. Do not implement future
ideas unless asked."

### Architecture Map

Human explanation:
How the app is split into frontend, backend, database, storage, edge functions,
deployment, and external services.

Model-friendly version:
"Architecture: static browser JS -> Supabase auth/db/storage/functions. Main
entry files: [...]. Data access belongs in [...]. UI rendering belongs in [...]."

### Data Model

Human explanation:
Tables, relationships, ownership, allowed statuses, required fields, storage
buckets, and lifecycle rules.

Model-friendly version:
"Important tables: tasks(...), projects(...), comments(...). Relationships:
task.project_id -> projects.id. Status values: [...]. Do not invent new values
without SQL migration and UI mapping."

### Security And Permissions

Human explanation:
What data is private, who can read/write it, where real enforcement lives.

Model-friendly version:
"Security boundary is Supabase RLS/RPC, not hidden buttons. Never expose private
keys. Check policies when changing role behavior."

### UI And Design Rules

Human explanation:
Visual style, tone, density, mobile behavior, typography, components, and
accessibility expectations.

Model-friendly version:
"Preserve existing Russian UI style. Reuse existing classes. Do not introduce a
new design system. Check desktop and mobile if layout changes."

### Technical Standards

Human explanation:
Preferred coding style, dependencies, browser support, file organization, and
testing expectations.

Model-friendly version:
"Use plain browser JS and existing globals. Avoid new dependencies unless they
remove meaningful complexity. Put data calls in backend wrappers."

### Operations And Deployment

Human explanation:
How to run locally, publish, migrate database, recover from mistakes, and check
versioning.

Model-friendly version:
"Local run: [...]. Deploy: [...]. Before release check: changed files,
migrations, version, smoke scenario."

### Known Problems And Risks

Human explanation:
Things that have broken before, slow areas, race conditions, fragile code, or
manual business constraints.

Model-friendly version:
"Known risks: [...]. If touching these areas, inspect surrounding code and
verify scenario [...]."

### Examples And References

Human explanation:
Screenshots, URLs, designs, similar existing screens, SQL snippets, old tickets,
good/bad examples.

Model-friendly version:
"Use [file/screen] as the style example. Match its structure unless there is a
specific reason not to."

### Decision Log

Human explanation:
Short notes explaining why the project chose a path.

Model-friendly version:
"Accepted decisions: [...]. Do not reverse these without asking."

### Task History

Human explanation:
What was tried, what failed, what the user already rejected.

Model-friendly version:
"Previous attempts: [...]. Avoid repeating [...]."

## Skills

Skills are reusable task procedures. They are not extra personality. They are
small checklists that tell the agent how to handle recurring work.

Recommended local skills for this project:

### `bugfix`

Use when something is broken.

Steps:
1. Identify expected behavior.
2. Locate the smallest relevant code path.
3. Find likely cause.
4. Patch narrowly.
5. Verify the failing scenario.
6. Report cause, fix, and residual risk.

Do not use for broad refactors or product redesign.

### `feature-spec`

Use before building a feature with uncertain scope.

Steps:
1. Restate user outcome.
2. List affected roles and flows.
3. Define acceptance criteria.
4. Name likely files and data impact.
5. Identify risks and checks.

Do not use for one-line fixes.

### `frontend-change`

Use for UI behavior or layout.

Steps:
1. Inspect existing component/style pattern.
2. Reuse classes and layout conventions.
3. Check responsive behavior.
4. Keep Russian UI text consistent.
5. Verify no overlap or broken text.

Do not use to redesign unrelated screens.

### `supabase-change`

Use for database, auth, policy, storage, RPC, or Edge Function changes.

Steps:
1. Inspect schema and current policies/RPCs.
2. Define data migration path.
3. Preserve role boundaries.
4. Add dated migration when needed.
5. Verify client code and SQL agree.

Do not use for purely visual changes.

### `code-review`

Use when the user asks for review.

Steps:
1. Findings first.
2. Order by severity.
3. Include file/line references.
4. Focus on bugs, regressions, security, missing tests.
5. Keep summary brief.

Do not rewrite the code during review unless asked.

### `release-check`

Use before publishing.

Steps:
1. Review changed files.
2. Check migrations and config.
3. Run available checks.
4. Smoke-test critical flows.
5. Summarize release risk.

Do not add new features during release check.

## Agents And Subagents

An agent is an AI worker with instructions, tools, and context. A subagent is a
specialized worker used for a separate task, usually to protect the main
conversation from too much search output or noisy logs.

Use the main agent when:

- The task needs dialogue with the user.
- The same context must flow from planning to implementation.
- The change is small and direct.
- The user is making product/design decisions interactively.

Use a subagent when:

- Research can be done independently.
- The output would be long and noisy.
- Several areas can be inspected in parallel.
- A specialized review is useful: security, performance, database, UI.
- The subagent can return a short summary instead of all raw details.

Good subagent design:

- One narrow purpose.
- Clear trigger: when to use it.
- Clear non-trigger: when not to use it.
- Minimal tool access.
- Short output format.
- No duplicated global rules.

Example subagents:

- `codebase-researcher`: read-only exploration and summary.
- `ui-reviewer`: layout, responsive, text overflow, visual consistency.
- `db-reviewer`: schema, RLS, RPC, migration risk.
- `release-verifier`: changed files, smoke checks, deployment readiness.

How to "train" agents effectively:

- Correct repeated mistakes by turning them into short rules.
- Give examples of good output and bad output.
- Keep instructions concrete and testable.
- Remove stale instructions when the project changes.
- Keep role-specific knowledge in the relevant skill/subagent, not everywhere.
- Prefer "when X, do Y" over vague preferences.

## Default Workflow With The User

1. For a small request, act directly and verify.
2. For a risky request, inspect first and state a short plan.
3. For a large request, create or update a checklist before editing.
4. After editing, verify with the most relevant available check.
5. Final answer: changed files, what changed, checks performed, next risk.

## Minimal Prompt Patterns

### Fast Fix

```text
Исправь баг: [что происходит]. Ожидаю: [что должно быть].
Ограничения: не трогай [область]. Проверь [сценарий].
```

### Feature

```text
Сделай фичу: [результат для пользователя].
Кто использует: [роль].
Где: [экран/маршрут].
Похоже на: [существующий пример].
Не менять: [ограничения].
```

### Review

```text
Сделай ревью изменений. Ищи баги, регрессии, безопасность, пропущенные проверки.
Не исправляй, только findings.
```

### Research

```text
Исследуй [тема/часть проекта]. Ничего не меняй.
В конце дай выводы, риски и план действий.
```

## Maintenance

Review these files after major changes:

- `AGENTS.md`: keep under about 200 lines.
- `PROJECT_MAP.md`: update when files, modules, or architecture change.
- `AI_WORK_SYSTEM.md`: update when the collaboration process changes.

If the system starts slowing work down, simplify it.
