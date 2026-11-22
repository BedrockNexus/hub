# Server Publishing

This document covers how server listings are created, published, updated and
moderated. Servers follow the same review model as add-ons, resource packs and
plugins ([PROJECT_FLOW.md](./PROJECT_FLOW.md)): nothing becomes public, and no
public listing changes, without a moderator's approval. What is specific to
servers is ownership verification, owner unpublishing, and status checks.

## The Model

Every listing has two layers:

- **The live listing** is what the public sees. It changes only when a
  moderator approves a submission.
- **The owner's saved edits** stay private until they are submitted and
  approved.

Moderators cannot approve servers they registered, own, or whose owning
organization they belong to; another moderator must decide.

## Fields

| Field | Question it answers | Values |
| --- | --- | --- |
| `status` | Is the listing visible? | `draft`, `under_review`, `published` |
| `moderationStatus` | What did moderation decide about the listing? | `pending`, `approved`, `flagged`, `rejected` |
| `submissionStatus` | Where is the latest submission? | `pending`, `approved`, `changes_requested`, `rejected` |

Public surfaces require `status === 'published'` and
`moderationStatus === 'approved'`. `submissionRevision`, `draftChangesJson`,
`publishedGalleryJson` and `publishedAt` work as described in
[PROJECT_FLOW.md](./PROJECT_FLOW.md#fields). A server's description is stored
outside the server document, and its update snapshot carries it
(`lib/serverDescriptions.ts`).

## Ownership Verification

A server can only be created for an address its owner has proven they control:

- `verification.generateCode` issues one code per account, stored in
  `serverVerificationChallenges` and valid for 24 hours. "Generate New Code"
  rotates it.
- The owner publishes the code as a DNS TXT record or in the server's MOTD,
  and `verification.verifyOwnership` checks it through the `api` service. It
  only accepts the caller's own active code: a `bedrocknexus-verify=` token
  copied from another server's public record was issued to a different
  account and is rejected.
- A successful check stores a 30-minute proof for that exact normalized
  `host:port`. Creating a server, or changing its address, consumes it.
- Hostnames are normalized (trimmed, lowercased, trailing dot removed) and
  each `host:port` (`servers.addressKey`) can be listed only once.
- Owners cannot change a server's IP address or port without a fresh proof
  for the new address. Admin address changes are recorded as `manual`
  verification by that admin.
- Expired codes and proofs are removed daily by a cron job.

## First Publication

```text
verify address -> create -> draft -> publish -> under_review (pending) -> published
```

- New servers start as `draft`, hidden and outside the moderation queue.
- When the owner publishes, the server goes to `under_review` with
  `moderationStatus: pending` and `submissionStatus: pending`, its details are
  locked, and it appears in the moderation queue.

Moderator decisions on a first submission:

| Decision | Result |
| --- | --- |
| Approve | `published` + `approved`; `publishedAt` is set. |
| Request changes | Back to `draft` with the note. The owner fixes it and publishes again. |
| Reject | `under_review` + `rejected`. Final: the owner cannot publish it again. |

## Updating a Public Listing

```text
published -> edit and save -> Submit updates -> pending -> approved
```

- Edits to a published server are stored in `draftChangesJson`; the server
  stays listed as it was.
- **Submit updates** sends them to the queue as a listing update and locks the
  details until a moderator decides.
- **Approve** applies them. **Request changes** and **Reject** leave the live
  listing as it is and show the note to the owner.
- Changing the address needs a fresh ownership proof before it can be saved.

## Unpublishing

- Owners can move their published server back to `draft` to hide it. This is
  recorded in the history and is not a rejection.
- Publishing it again goes through review again.
- Owners cannot change the visibility of an `under_review` server; the
  moderator's decision comes first.

## Moderation After Publication

| Action | Result |
| --- | --- |
| Flag | Hidden with `flagged` until resolved. |
| Unpublish | Back to `draft`; the owner sees the reason. |
| Reject | Hidden with `rejected`. Final for the owner. |
| Restore | Approve again to make it public. |

Moderators decide on listings; only admins edit a server's content directly
(`servers.updateAdmin`). Every submission and decision is recorded in
`moderationEvents` and shown in the History tab of the review page.

Owners can delete their server (`servers.remove`). Deletion is separate from
lifecycle status, and there is no `archived` status.

## Status Checks and Directory Visibility

- Published servers are pinged through the `api` service over RakNet or
  NetherNet. A ping also runs when a server is published or its address
  changes.
- Server software is declared by the owner; ping-based software guesses are
  retired.
- A published server offline for 14 days is excluded from the directory,
  search, counts and creator listings (`offlineHiddenAt`). Its own page stays
  available, checks continue, and the next successful check clears the flag.
- Failures of the checking service itself do not count as downtime.

This visibility rule is separate from owner publication and moderation.

## Source of Truth

- `convex/functions/servers/servers.ts`: create, update and submit,
  unpublish, moderation (`updateAdmin`), delete
- `convex/functions/servers/verification.ts`: ownership codes and proofs
- `convex/functions/servers/status.ts`: status checks and offline hiding
- `convex/lib/submissions.ts`: snapshots, revisions and decision fields
- `convex/functions/moderation/work.ts`: the moderation queue and claims
