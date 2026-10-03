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

## Rejections and Self-Approval

- Rejecting a server sets `under_review` + `rejected`, so it stays hidden.
  Owners cannot change the visibility of an `under_review` server, and a
  rejected server can never be republished by its owner.
- Unpublishing (`draft` with `approved`) is not a rejection; the owner may
  publish again.
- Admins cannot approve or publish servers they registered, own, or whose
  owning organization they belong to.

## Ownership Verification

Ownership verification is what allows a server to publish without admin
approval, so it must be bound to the account that performs it:

- `verification.generateCode` issues one code per account, stored in
  `serverVerificationChallenges` and valid for 24 hours. "Generate New Code"
  rotates it.
- `verification.verifyOwnership` only accepts the caller's own active code.
  A `bedrocknexus-verify=` token copied from another server's public DNS
  record or MOTD is rejected because it was issued to a different account.
- A successful check stores a 30-minute proof for that exact normalized
  `host:port`. Creating a server, or changing a server's address, consumes it.
- Hostnames are normalized (trimmed, lowercased, trailing dot removed) and
  each `host:port` (`servers.addressKey`) can be listed only once.
- Owners cannot change a server's IP address or port without a fresh proof
  for the new address. Admin address changes are recorded as `manual`
  verification by that admin.
- Expired codes and proofs are removed daily by a cron job.

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
