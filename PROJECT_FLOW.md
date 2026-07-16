# Project Flow

This document records the current project publishing flow and how moderation fits into it.

Projects intentionally require pre-publication review because they distribute
downloadable files. This differs from servers, which may publish after ownership
verification and are moderated after publication.

## Current Project Lifecycle

The project lifecycle controls whether a project is visible in the product.

Source of truth:

- `convex/schemas/projects.ts`: `projectStatus`
- `convex/functions/projects/projects.ts`: create/update/admin update/delete behavior
- `components/admin-dashboard/admin-projects-table.tsx`: admin visibility controls
- `components/user-dashboard/projects/project-edit-sidebar.tsx`: owner submit-for-review control
- `components/user-dashboard/projects/user-project-list-table.tsx`: owner project status display

Current project lifecycle states:

| Status | Meaning | Public visibility |
| --- | --- | --- |
| `draft` | The project exists but is not meant to be public yet. | Hidden |
| `published` | The project is live and can appear in public listings, user profiles, search, and public pages. | Visible |
| `under_review` | The project is hidden while an admin reviews it or while a future report/moderation workflow is pending. | Hidden |

Projects do not use `archived`. If a project needs to be hidden, use `under_review`. If a project needs to be removed, use the delete/removal workflow instead of another lifecycle status.

## Current Flow

Project creation starts as an owner draft. The owner edits the draft, then submits it for admin/mod review from the project edit sidebar:

```text
create project -> draft -> submit for review -> under_review -> published
```

Admin review controls use this flow:

```text
under_review -> published
```

Published projects can be sent back to review if needed:

```text
published -> under_review -> published
```

Expected behavior:

- New project listings are inserted as `draft`.
- Draft project listings are hidden from public surfaces.
- Draft project listings do not enter the moderation queue until the owner submits them for review.
- Submitting a draft for review changes it to `under_review`.
- Submitted project listings get `moderationStatus: pending`.
- `publishedAt` is set the first time an admin/mod publishes the project.
- Public surfaces should only show projects with `status === 'published'`.
- Admins/mods publish a reviewed project when it is okay to go public.
- Publishing a project should mark its moderation status as `approved`.
- Admins/mods can move a published project back to `under_review` when it should be hidden or reviewed again.
- Project delete/removal is separate from lifecycle status.
- Old project data with `archived` should be migrated to `under_review`.

## Draft Status

`draft` is the active owner editing state for new projects. Owners can keep editing a draft without sending it to admins/mods yet.

Owner flow:

```text
create project -> draft -> submit for review -> under_review -> published
```

Owner controls before review:

```text
draft -> under_review
```

Owners cannot publish projects directly. Admin/mod approval is required before a project becomes public.

## Moderation Status

`moderationStatus` is separate from lifecycle status.

Lifecycle answers: should this project be visible?

Moderation answers: what did the review process decide?

Current moderation states:

| Status | Meaning |
| --- | --- |
| `pending` | Waiting for review. |
| `approved` | Reviewed and accepted. |
| `flagged` | Needs attention because of reports, automated checks, or admin concern. |
| `rejected` | Reviewed and not accepted. |

## Future Report Flow

When reports or moderation queues are added, lifecycle and moderation should work together like this:

```text
published
  -> report received
  -> under_review + pending/flagged
  -> admin reviews
  -> published + approved
```

Or, if the project fails review:

```text
published
  -> report received
  -> under_review + pending/flagged
  -> admin reviews
  -> under_review + rejected
```

Recommended rules for future implementation:

- Use lifecycle status for public visibility.
- Use moderation status for the admin/review decision.
- Do not show `draft` or `under_review` projects on public surfaces.
- Do not reintroduce `archived` as a project status.
