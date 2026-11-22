# Add-on, Resource-Pack and Plugin Publishing

This document covers how add-ons and resource packs are published, updated and
moderated, and how plugins differ. Internally add-ons and resource packs share
the `projects` tables and functions; public catalogs and download URLs use
their own sections (`/addons`, `/resource-packs`). Plugins live in the
`plugins` tables and are built from GitHub.

Servers follow the same review model; see [SERVER_FLOW.md](./SERVER_FLOW.md).

## The Model

Every listing has two layers:

- **The live listing** is what the public sees. It changes only when a
  moderator approves a submission.
- **The owner's saved edits** stay private until they are submitted and
  approved. Saving never changes the public page.

Nothing becomes public, and no public listing changes, without a moderator's
approval. Moderators cannot approve content they created, own, or that belongs
to an organization they are a member of; another moderator must decide.

## Fields

Three fields describe a listing. Keep them separate.

| Field | Question it answers | Values |
| --- | --- | --- |
| `status` | Is the listing visible? | `draft`, `under_review`, `published` (plugins use `review` for `under_review`) |
| `moderationStatus` | What did moderation decide about the listing? | `pending`, `approved`, `flagged`, `rejected` |
| `submissionStatus` | Where is the latest submission? | `pending`, `approved`, `changes_requested`, `rejected` |

Public surfaces require `status === 'published'` and
`moderationStatus === 'approved'`.

Supporting fields:

- `submissionRevision` increases on every submission and decision. Moderators
  decide on the revision they loaded (`expectedRevision`); a stale decision is
  refused.
- `draftChangesJson` holds the submitted details of an update to a public
  listing, applied when it is approved (`lib/submissions.ts`).
- `publishedGalleryJson` holds the live gallery while gallery edits wait for
  approval (`lib/submissionGallery.ts`).
- `publishedAt` is set the first time the listing is approved.

## First Publication

```text
create -> draft -> submit for review -> under_review (pending) -> published
```

- New listings start as `draft`, hidden and outside the moderation queue.
- Owners edit freely and see a checklist of required and recommended details.
- Submitting needs valid details and at least one release. It sets
  `under_review`, `moderationStatus: pending`, `submissionStatus: pending`, and
  locks the listing's details.
- The submission appears in the moderation queue (`/moderation`).
- Releases uploaded before the first approval are approved together with the
  listing.

Moderator decisions on a first submission:

| Decision | Result |
| --- | --- |
| Approve | `published` + `approved`; `publishedAt` is set. |
| Request changes | Back to `draft` with the note. The owner fixes it and resubmits. |
| Reject | `under_review` + `rejected`. Final: the owner cannot resubmit. |

## Updating a Public Listing

```text
published -> edit and save -> Submit updates -> pending -> approved
```

- Editing a published listing stores the changes in `draftChangesJson`; the
  live listing does not change.
- The dashboard shows "Unsubmitted changes" with a **Submit updates** button.
- While the update is pending the details are locked and the update appears in
  the queue as a listing update.
- **Approve** applies the submitted details and gallery.
- **Request changes** and **Reject** leave the live listing as it is; the owner
  sees the note on their dashboard. A rejected update does not hide the
  listing.

## Releases

Every downloadable file is checked and reviewed before anyone can download it.

1. The owner uploads a file. It is stored privately with
   `validationStatus: pending`.
2. The validator worker in the `api` service inspects the archive and marks it
   `valid` or invalid. Owners can retry a failed validation.
3. A release of a listing that is not public yet is reviewed with the listing.
   A release of a public listing is reviewed on its own
   (`standaloneReviewPending`) and appears in the queue with its version.
4. A moderator approves or rejects it (`versions.reviewRelease`). A rejection
   is final for that release; the owner sees the reason.

Only approved, validated releases are listed, counted, copied to the CDN, or
downloadable. Releases created before release review existed have no
`reviewStatus` and count as approved.

## Moderation After Publication

Moderators can act on any listing at any time:

| Action | Result |
| --- | --- |
| Flag | Hidden with `flagged` until resolved. |
| Unpublish | Back to `draft`; the owner sees the reason. |
| Reject | Hidden with `rejected`. Final for the owner. |
| Restore | Approve again to make it public. |

Every submission and decision is recorded in `moderationEvents` and shown in
the History tab of the review page, with a before/after comparison of the
submitted fields (`lib/moderationHistory.ts`).

Owners can delete their listing (`projects.remove`); admins can remove any
listing (`projects.adminRemove`). Deletion is separate from lifecycle status,
and there is no `archived` status.

## Plugins

Plugins follow the same model with these differences:

- **Setup.** The owner connects a GitHub repository, picks the server software,
  and installs the BedrockNexus build workflow. Every push builds the plugin
  in GitHub Actions and the builds are synced to the dashboard.
- **Submitting.** A first submission, and every new version, is a build
  chosen on the Versions page with a version number and changelog
  (`publishing/model.submitRelease`). The listing's saved details are
  submitted with it.
- **Updating details.** Saved details of a public plugin (icon, name, summary,
  description, license, categories, links, gallery) can also be sent on their
  own with **Submit updates** (`publishing/model.submitListingChanges`). They
  are approved in the same listing review as add-ons (`plugins.moderation`).
- **Edits.** Plugin edits are saved on the publishing draft
  (`pluginPublishingDrafts`), not on the plugin, and are locked while any
  submission is pending.
- **Software.** A published plugin cannot move to different server software.
- **Releases.** An approved build is copied to the CDN and a GitHub release is
  created. See [PLUGIN_CUSTOM_WORKFLOWS.md](./docs/PLUGIN_CUSTOM_WORKFLOWS.md)
  and [PLUGIN_WORKFLOW_CATALOG.md](./docs/PLUGIN_WORKFLOW_CATALOG.md).

## Downloads

Validated and approved releases use `/<section>/<ref>/download/<version>` on
the website and `/v1/<section>/<ref>/releases/<version>/download` in the API.
Old version-ID links redirect through the compatibility route. Downloads are
limited and counted in Convex; optional OpenPanel delivery cannot block them.
See [the download contract](./docs/ANALYTICS_AND_DOWNLOADS.md).

## Source of Truth

- `convex/functions/projects/projects.ts`: create, update and submit,
  moderation (`adminUpdate`, `requestChanges`), delete
- `convex/functions/projects/versions.ts`: uploads, validation, release review
- `convex/functions/plugins/publishing/model.ts` and
  `convex/functions/plugins/moderation.ts`: plugin submissions and decisions
- `convex/lib/submissions.ts`: snapshots, revisions and decision fields
- `convex/functions/moderation/work.ts`: the moderation queue and claims
- `lib/creator-listing-state.ts`: the state owners see on their dashboard
