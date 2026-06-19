# AGENTS.md

This file is the shared operating guide for AI agents working on the ZA RAMKI
Handbook project. Keep it concise. Put long explanations, examples, and process
details in `AI_WORK_SYSTEM.md` or `PROJECT_MAP.md`.

## Project

ZA RAMKI Handbook is a Russian-language internal web app for studio work:
project planning, task tracking, knowledge base articles, templates,
checklists, comments, links, files, push notifications, and admin tools.

The app is a mostly static client-side JavaScript application backed by
Supabase.

## Current Stack

- Entry point: `index.html`
- Client code: plain browser JavaScript under `js/`
- Routing: hash routes in `js/router.js`
- Backend API wrapper: `js/services/zr_backend.js`
- Supabase client setup: `js/utils/supabase_client.js`
- Database and policies: `sql/`, `supabase/schema_public.sql`
- Supabase Edge Function: `supabase/functions/test-push/`
- Styling: `styles.rebuild.css`, `styles.editorial.css`, `colors.css`,
  `theme.css`
- Local static server: `tools/local-static-server.js`

## Core Product Areas

- `planner`: main task board and task detail workflow.
- `projects`: project containers with tasks, links, and comments.
- `articles`: knowledge base instructions.
- `templates`: reusable operational templates.
- `checklists`: admin-visible checklist area.
- `admin`: admin tools for employees, projects, templates, checklists, articles.
- `push`: browser notifications and Supabase push subscription sync.

Use `PROJECT_MAP.md` for the detailed file map.

## Working Rules

- Read the relevant files before editing. Follow the existing plain JavaScript
  style unless the user asks for a broader refactor.
- Keep changes small and tied to the user's goal.
- Do not rewrite unrelated code or reformat large files just because they are
  nearby.
- Treat user changes as intentional. Do not revert unknown work.
- For UI changes, preserve the current Russian interface language and existing
  visual system.
- For database work, inspect existing schema, policies, RPCs, and migrations
  before proposing SQL.
- Never put service-role keys or private secrets in client code.
- The public Supabase anon key in `index.html` is client-facing by design; do
  not replace it with private credentials.
- Prefer structured, reusable helpers already present in `js/planner/` and
  `js/services/zr_backend.js`.
- When adding new files, use clear names and keep docs short enough to stay
  useful as agent context.

## Context Discipline

- `AGENTS.md` is for facts and rules needed in almost every session.
- `PROJECT_MAP.md` is for navigation and architecture.
- `AI_WORK_SYSTEM.md` is for process, examples, roles, skills, and checklists.
- `skills/*/SKILL.md` holds narrow reusable workflows; load only the skill that
  matches the current task. Ignore `.codex/skills` in this repository if it
  exists; project-maintained skills live in `skills/`.
- Do not move long tutorials or one-off research notes into `AGENTS.md`.
- If a rule applies only to one area, put it near that area or in the work
  system file instead of bloating global instructions.

## Suggested Work Modes

- `research`: inspect and explain; do not edit.
- `plan`: inspect and propose steps; do not edit until asked.
- `bugfix`: reproduce/locate, patch narrowly, verify.
- `feature`: clarify acceptance criteria, implement, verify, summarize.
- `review`: findings first, with file/line references and severity.
- `release`: check changed files, versioning, smoke tests, and deployment risk.

When the user does not specify a mode and asks to "do" something, proceed with
implementation using the smallest safe scope.

## Verification

Use the best available verification for the change:

- Static HTML/client changes: inspect affected files and, when practical, run a
  local static server and test in a browser.
- Supabase/database changes: inspect generated SQL and existing policies/RPCs.
- UI changes: check desktop and mobile layouts when visual risk is meaningful.
- Documentation changes: check that file names and references are correct.

If no automated test exists for the touched area, say that clearly in the final
summary and describe the manual check performed.

## Communication

- Answer the user in Russian unless they ask otherwise.
- Keep progress updates short and concrete.
- Final summaries should say what changed, where, and how it was checked.
- Ask questions only when a reasonable assumption would be risky.
