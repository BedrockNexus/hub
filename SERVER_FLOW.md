# Server Flow

This document records the server publishing and post-publication moderation policy.

Servers intentionally use a different launch flow from downloadable projects.
Ownership verification gives a server owner permission to publish their listing
without waiting for admin approval. Admin moderation happens after publication
when a listing is reported or otherwise needs attention.

## Current Server Lifecycle

The server lifecycle controls whether a server listing is visible in the product.

Source of truth:

- `convex/schemas/servers.ts`: `serverLifecycleStatus`
- `convex/functions/servers/servers.ts`: create/update/admin update behavior
- `components/admin-dashboard/admin-servers-table.tsx`: admin visibility controls
- `components/user-dashboard/servers/server-edit-sidebar.tsx`: owner visibility controls
- `components/user-dashboard/servers/user-server-list-table.tsx`: owner listing actions

Current server lifecycle states:

| Status | Meaning | Public visibility |
| --- | --- | --- |
| `draft` | The server has been created but the owner has not published it yet. | Hidden |
| `published` | The server is live and can appear in public listings, user profiles, search, and public pages. | Visible |
| `under_review` | The server is hidden while an admin reviews it or while a future report/moderation workflow is pending. | Hidden |

Servers do not use `archived`. If a server needs to be hidden, use `under_review`. If a server needs to be permanently removed later, that should be handled as a separate delete/removal workflow instead of another lifecycle status.

## Current Flow

Server creation currently saves a draft:

```text
create server -> draft -> publish
```

The owner publishing flow is:

```text
draft -> published -> draft
```

Admin review controls use this flow after a server has been published:

```text
published -> under_review -> published
```

Expected behavior:

- New server listings are inserted as `draft`.
- Owners publish their server when they are ready for it to appear publicly.
- Owners can move a published server back to `draft` when they want to hide it themselves.
- `publishedAt` is set the first time a server moves to `published`.
- Public surfaces should only show servers with `status === 'published'`.
- Admins can move a published server to `under_review` when it should be hidden and investigated.
- Admins can move a reviewed server back to `published` when it is okay again.
- Owners cannot move an `under_review` server back to `draft` or `published`; admin review must finish first.
- A rejected server remains `under_review` and hidden until an admin resolves it.

## Why Projects Are Different

Projects distribute downloadable files, so they must pass admin review before
their first publication:

```text
project: draft -> under_review -> published
server:  draft -> published
```

This is intentional. Server ownership verification establishes control of the
listed address, while project review protects users before Bedrock Nexus
distributes a file. Both content types can still be moved to `under_review`
after publication when moderation is needed.

## Moderation Status

`moderationStatus` is separate from lifecycle status.

Lifecycle answers: should this server be visible?

Moderation answers: what did the review process decide?

Current moderation states:

| Status | Meaning |
| --- | --- |
| `pending` | Waiting for review. |
| `approved` | Reviewed and accepted. |
| `flagged` | Needs attention because of reports, automated checks, or admin concern. |
| `rejected` | Reviewed and not accepted. |

Moderation status is optional for ordinary draft and published servers. It is
used when an admin moves a listing into the post-publication review flow.

## Future Report Flow

When reports or moderation queues are added, lifecycle and moderation should work together like this:

```text
published
  -> report received
  -> under_review + pending/flagged
  -> admin reviews
  -> published + approved
```

Or, if the server fails review:

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
- Do not show `under_review` servers on public surfaces.
- Do not require admin approval for a server's first publication.
- Keep project pre-publication review separate from server moderation.
