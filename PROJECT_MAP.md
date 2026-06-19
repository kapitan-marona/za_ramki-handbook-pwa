# PROJECT_MAP.md

This is the quick navigation map for the ZA RAMKI Handbook codebase.

## One-Screen Summary

The app is a static browser application with lazy-loaded JavaScript views and
Supabase as the backend. `index.html` defines the shell, global Supabase config,
tabs, search, list panel, and viewer panel. `js/app.js` initializes auth, loads
view scripts by section, gates routes by role, and renders the current section.

Main user flow:

1. Browser opens `index.html`.
2. Supabase client initializes from `js/utils/supabase_client.js`.
3. `js/services/zr_backend.js` exposes data operations.
4. `js/app.js` checks auth and role.
5. `js/router.js` parses `#/section/param`.
6. The matching view under `js/views/` renders into `#list` and `#viewer`.

## Entry And Shell

- `index.html`
  - App shell, tabs, search input, left list panel, right viewer panel.
  - Loads CSS, runtime config, Supabase vendor bundle, backend wrapper, router,
    utilities, and `js/app.js`.
  - Contains app version.

- `js/config.js`
  - Runtime client configuration: current backend mode, public Supabase URL,
    anon key, VAPID public key, push function name, and future push endpoint.
  - Public client values only; never place private service-role keys here.

- `manifest.json`, `assets/favicon/`, `sw.js`
  - PWA metadata, icons, and service worker behavior.

- `CNAME`
  - Custom domain configuration for deployment.

## App Boot And Routing

- `js/app.js`
  - Global session state: `window.App.session`.
  - Auth initialization and role fetch via `get_role`.
  - Role-gated tabs: admin and checklists are admin-only.
  - Push toggle UI.
  - Lazy script loading per section.
  - Section rendering and search behavior.

- `js/router.js`
  - Hash route parser and route writer.
  - Routes look like `#/planner`, `#/planner/<taskId>`,
    `#/projects/<projectId>`, `#/articles/<id>`.

- `js/api.js`
  - Tiny fetch helper for static JSON/text assets.

## Backend Layer

- `js/utils/supabase_client.js`
  - Creates/exports the Supabase browser client.

- `js/services/zr_backend.js`
  - Main data access layer for auth, roles, projects, tasks, comments, files,
    links, knowledge base, admin areas, and push subscriptions.
  - Prefer adding Supabase calls here instead of scattering direct queries
    across views.

- `js/services/zr_backend_provider.js`
  - Backend provider boundary. Currently returns the Supabase browser client;
    later this is the place to switch the facade toward a Russian API provider.

- `js/services/zr_backend_core.js`
  - Shared auth/db wrappers used by `zr_backend.js`; keeps session and raw
    table/RPC access behavior isolated from feature-specific data methods.

- `js/services/zr_backend_projects.js`
  - Projects, project links, and project comments data methods exposed through
    `ZRBackend.projects`, `ZRBackend.projectLinks`, and
    `ZRBackend.projectComments`.

- `js/services/zr_backend_people.js`
  - Allowlist and profile methods exposed through `ZRBackend.allowlist` and
    `ZRBackend.profiles`.

- `js/services/zr_backend_kb.js`
  - Knowledge base articles, templates, checklists, and link-search methods
    exposed through `ZRBackend.kb`.

- `js/services/zr_backend_push.js`
  - Push subscription storage methods exposed through
    `ZRBackend.pushSubscriptions`.

- `js/services/zr_backend_task_meta.js`
  - Task activity and task assignee methods exposed through
    `ZRBackend.taskActivity` and `ZRBackend.taskAssignees`.

- `js/services/zr_backend_task_checklists.js`
  - Task-scoped checklist instance and runtime checklist item methods exposed
    through `ZRBackend.checklistInstances` and `ZRBackend.taskChecklistItems`.

- `js/services/zr_backend_task_content.js`
  - Task comments, files, and links methods exposed through
    `ZRBackend.taskComments`, `ZRBackend.taskFiles`, and `ZRBackend.taskLinks`.

- `js/services/zr_backend_tasks.js`
  - Core task list, create/update, status, snapshots, and archive methods
    exposed through `ZRBackend.tasks`.

## Views

- `js/views/login.js`
  - Login/auth screen.

- `js/views/planner.js`
  - Main planner view. Uses modules from `js/planner/` for data, board,
    detail page, actions, comments, docs, checklist runtime, people labels, and
    readonly states.

- `js/views/projects.js`
  - Project list and project detail page.
  - Shows project links, project comments, and related tasks.
  - Reuses planner comments rendering for project comments.

- `js/views/articles.js`
  - Knowledge base article list/detail view.
  - Uses `marked` from CDN for markdown rendering.

- `js/views/templates.js`
  - Template list/detail view.
  - Uses template runtime and XLSX link helpers.

- `js/views/checklists.js`
  - Checklist section; currently admin-only via app shell.

- `js/views/admin.js`
  - Admin shell.

- `js/views/admin.employees.js`
  - Employee management.

- `js/views/admin.projects.js`
  - Project administration.

- `js/views/admin.templates.js`
  - Template administration.

- `js/views/admin.checklists.js`
  - Checklist administration.

- `js/views/admin.articles.js`
  - Article administration.

- `js/views/_future/planner_v1_tabs_proto.js`
  - Future/prototype code. Do not treat as active production code unless the
    user explicitly asks.

## Planner Modules

- `js/planner/planner_api.js`
  - Planner-specific data operations and RPC calls.

- `js/planner/planner_data.js`
  - Fetching planner task lists and task details.

- `js/planner/planner_state.js`
  - Shared planner state helpers such as overdue checks.

- `js/planner/planner_board.js`
  - Board rendering.

- `js/planner/planner_left.js`
  - Left task list rendering and filters.

- `js/planner/planner_actions.js`
  - Task creation/edit/action flows.

- `js/planner/planner_presenters.js`
  - Human-readable labels and formatting.

- `js/planner/planner_people.js`
  - Assignees, user labels, visibility logic.

- `js/planner/planner_docs.js`
  - Task documents/files UI and operations.

- `js/planner/planner_comments.js`
  - Comment rendering and comment interactions.

- `js/planner/planner_activity.js`
  - Task activity timeline rendering.

- `js/planner/planner_checklist_runtime.js`
  - Runtime for checklist items inside task detail.

- `js/planner/planner_detail_helpers.js`
  - Task detail layout, actions HTML, post-load interactions.

- `js/planner/planner_detail_sections.js`
  - Loading detail sections: checklist, docs, comments, activity, links.

- `js/planner/planner_readonly.js`
  - Readonly/locked task behavior.

- `js/planner/planner_ux.js`
  - Planner UI helper behavior such as sorting.

## Utilities

- `js/utils/viewer_nav.js`
  - Viewer navigation helpers.

- `js/utils/viewer_focus.js`
  - Viewer focus helpers.

- `js/utils/favorites.js`
  - Favorites behavior.

- `js/utils/push.js`
  - Browser push subscription and permission flow.

- `js/utils/planner_push_sender.js`
  - Push sending helper for planner events.

- `js/utils/update_checker.js`
  - Version/update checks.

- `js/utils/template_runtime.js`
  - Template rendering/runtime helpers.

- `js/utils/links_xlsx.js`, `js/utils/xlsx_exporter.js`, `js/utils/exporters.js`
  - XLSX/export utilities.

- `js/utils/kb_newmarks.js`
  - Knowledge base "new" markers.

## Vendor Files

- `js/vendor/supabase-js-2.js`
  - Supabase browser library bundle.

- `js/vendor/xlsx.bundle.js`
  - XLSX library bundle.

Do not edit vendor files unless the user explicitly asks for a vendor update.

## Styles And Assets

- `styles.rebuild.css`
  - Main rebuilt visual system. Owns shell, layout, shared controls, and most
    feature UI.

- `styles.editorial.css`
  - Editorial/content styling for markdown and article content only.

- `colors.css`
  - Design tokens: colors, common radii, spacing, focus ring, panel shadow, and
    table color tokens.

- `theme.css`
  - Small final brand/theme layer. Keep overrides intentional because this file
    loads last.

- `STYLE_SYSTEM.md`
  - CSS ownership rules, cleanup rules, and known CSS risks.

- `PRE_PRODUCTION_CHECKLIST.md`
  - Manual release checklist for static checks, visual smoke-tests, roles,
    Supabase/RLS, and Russia access risks.

- `PRODUCTION_READINESS_SUMMARY.md`
  - Current readiness summary: completed production work, checks, remaining
    risks, and next stage.

- `RF_ACCESS_PLAN.md`
  - Practical plan for stable access from РФ: options, recommended migration
    path, and near-term backend adapter tasks.

- `BACKEND_API_CONTRACT.md`
  - Minimal future backend contract for replacing Supabase gradually while
    keeping the current PWA frontend behavior.

- `SUPABASE_TO_RF_MIGRATION_MAP.md`
  - Inventory of Supabase tables, RPC functions, and app modules that must be
    replaced or emulated by a future Russian backend.

- `SUPABASE_DIRECT_DEPENDENCIES_AUDIT.md`
  - Current direct Supabase dependency audit after the backend facade split;
    tracks intentionally deferred direct Supabase Functions push usage.

- `STORAGE_IMAGE_OPTIMIZATION.md`
  - Notes and workflow for compressing heavy Supabase Storage images used in
    knowledge base articles.

- `SUPABASE_RLS_AUDIT.md`
  - RLS policy audit based on exported Supabase structure files.

- `RLS_MIGRATION_TEST_PLAN.md`
  - Manual admin/staff/no-role checks for the draft RLS hardening migration.

- `assets/img/`
  - Logo and measurement guide images.

- `assets/bg/`
  - Background imagery.

- `assets/fonts/`
  - Local fonts.

- `assets/icons/`
  - App icons.

## Database And Supabase

- `supabase/schema_public.sql`
  - Public schema snapshot.

- `supabase/config.toml`
  - Supabase local/project function config.

- `supabase/functions/test-push/index.ts`
  - Edge Function for push testing.

- `sql/Migration/`
  - Exported schema pieces: extensions, functions, foreign keys, policies,
    storage buckets, storage objects, tables, triggers.

- `sql/checks/`
  - Read-only SQL checks for Supabase preflight/postflight validation.

- `sql/migrations/`
  - Dated SQL migrations. Current examples:
    - `2026-03-07_set_task_status_add_activity.sql`
    - `2026-03-07_task_activity_v1.sql`
    - `2026-06-18_perf_indexes.sql`
    - `2026-06-18_rls_hardening_draft.sql`
    - `2026-06-18_rls_admin_role_hotfix.sql`
    - `2026-06-18_fix_profile_role_typo.sql`
    - `2026-06-18_task_admin_rpc.sql`

For database changes, inspect both current schema and migrations before writing
new SQL.

## Tools

- `tools/local-static-server.js`
  - Local static file server for browser testing.
  - Accepts an optional port argument, for example
    `node tools/local-static-server.js 8097`.

- `tools/publish-data.ps1`
  - Publishing helper script.

## Common Change Paths

- Add or fix planner task behavior:
  - Start with `js/views/planner.js`.
  - Then inspect the relevant `js/planner/` module.
  - Data calls usually belong in `js/planner/planner_api.js`,
    `js/planner/planner_data.js`, or `js/services/zr_backend.js`.

- Add project detail behavior:
  - Start with `js/views/projects.js`.
  - Data calls should go through `ZRBackend.projects`, `projectLinks`, or
    `projectComments`.

- Change auth/roles:
  - Start with `js/app.js`, `js/utils/supabase_client.js`,
    `js/services/zr_backend.js`, and SQL policies/RPCs.

- Change admin behavior:
  - Start with `js/views/admin.js` and the matching `admin.*.js` file.

- Change visual layout:
  - Inspect HTML emitted by the view and the relevant CSS in
    `styles.rebuild.css`, then theme/color layers.

- Change push behavior:
  - Inspect `js/utils/push.js`, `js/utils/planner_push_sender.js`,
    `js/app.js`, `sw.js`, and `supabase/functions/test-push/index.ts`.

## Known Constraints

- The app uses global browser objects (`window.Views`, `window.ZRBackend`,
  `window.App`, etc.). New code should fit this pattern unless a larger
  migration is requested.
- Many sections render HTML strings. Escape user-facing dynamic content with
  existing `esc` helpers.
- Admin-only UI visibility is not security by itself. Keep authorization in
  Supabase policies/RPCs as the real boundary.
- Search is global in the top bar but section-specific in behavior.
- Planner detail pages load multiple async sections; avoid race conditions when
  switching tasks quickly.
