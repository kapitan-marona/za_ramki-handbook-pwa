---
name: feature-spec
description: Lightweight feature specification workflow for ZA RAMKI Handbook. Use before implementing a feature when scope, roles, data impact, UI behavior, acceptance criteria, or verification steps are not yet clear. Do not use for tiny obvious changes or direct bug fixes.
---

# Feature Spec

## Workflow

1. Define the user-visible outcome in one or two sentences.
2. Name the roles affected: admin, staff, unauthenticated, or all users.
3. List the screens, routes, files, and data objects likely involved.
4. Write acceptance criteria as observable behavior.
5. Identify constraints: UI style, security, data migration, performance,
   mobile, deployment, and what must not change.
6. Decide whether implementation can proceed or the user must answer a question.

## Acceptance Criteria Shape

Use concrete checks:

- "Admin can create..."
- "Staff can see..."
- "Archived tasks remain readonly..."
- "Existing records without this field still render..."
- "No private keys move to client code..."

## Output

Return a concise spec, implementation plan, risk list, and verification plan.
