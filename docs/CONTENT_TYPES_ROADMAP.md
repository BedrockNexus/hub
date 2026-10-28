# Addons, resource packs, and maps

## Objective

Make each content type a first-class part of BedrockNexus. Improve the complete
creator and player experience: submission, review, discovery, download, and updates.

## Implementation order

1. **Separate existing content experiences.** Dedicated addon/resource-pack
   catalogs, submission forms, dashboard lists and editors; old-link redirects;
   navigation, creator/organization pages, canonical URLs, and sitemap entries.
2. **Complete addon publishing.** Resumable drafts, submission checklist, preview,
   clear validation and moderation feedback, corrections and resubmission, and
   updates that keep the current approved release available during review.
3. **Complete resource-pack publishing.** Adapt the proven flow to pack-specific
   metadata, previews, requirements, filters, and validation.
4. **Add maps end to end.** Define map metadata, categories and file policies;
   extend the hub and artifact validator; support uploading, review, publication,
   downloads, updates, and deletion. Test representative world sizes before
   choosing storage and processing limits.
5. **Improve discovery and download decisions.** Useful type-specific filters,
   release compatibility and requirements, installation instructions, version
   history, screenshots, creator identity, credits, licensing, support, and reports.
6. **Improve moderation.** One queue with type filters, change previews, validation
   results and review history; clear edit-review rules; actionable creator feedback.
7. **Trustworthy statistics and creator tools.** Consistent download measurement,
   repeat-request and abuse handling, documented historical totals, creator
   analytics, follows and release notifications. Rankings are never sold.
8. **Verify and launch with creators.** Complete desktop/mobile lifecycle checks
   with individual and organization accounts. Observe real publishing friction;
   measure completion, download success, review time, and repeat publishing.

## Content requirements to refine during publishing work

| Type | Specific information |
| --- | --- |
| Addon | Included behavior/resource packs, dependencies, experiments, installation |
| Resource pack | Content changed, resolution where relevant, rendering requirements, installation |
| Map | Category, player count, gameplay, required/bundled packs, installation |

Requirements and compatibility that can change between updates should be stored
per release. Bundled packs must not require duplicate public listings. Structured
validation, moderator review, creator claims, and actual in-game testing are
different checks and should be described accurately.

## First slice: route and dashboard separation (2026-10-23)

- Public catalogs: `/addons`, `/resource-packs`.
- Public detail sections: `/<type>/<slug>`, `/gallery`, `/releases`,
  `/releases/<version>`, `/reviews`.
- Creator lists and add forms: `/dashboard/addons`,
  `/dashboard/resource-packs`, and `/add` below each.
- Creator settings: `/dashboard/<type>/<existing-id>` and settings subpaths.
- Organization lists: `/dashboard/organizations/<slug>/addons` and
  `/resource-packs`.
- New forms and editors fix the content type. Public and creator detail routes
  check the stored type; creator routes use the existing ownership check.
- Existing storage tables, IDs, slugs, releases, reviews, gallery references,
  upload/download endpoints, and permissions are retained.
- Historical `texture_pack` entries resolve to resource packs.
- `/projects?type=resource_pack` redirects to `/resource-packs`, preserving
  other query parameters. An untyped `/projects` goes to `/addons`.
- Old project detail/settings links resolve their stored type and redirect,
  preserving IDs, detail sections, and query parameters. Public `/versions` and
  `/changelog` aliases resolve to `/releases`.
- `/dashboard/projects/add` remains a compatibility destination offering both
  new submission forms; normal navigation links directly to each form.

The shared internal `projects` implementation remains an implementation detail.
Maps are not exposed yet; their schema and artifact validator are separate work.

The [Maps publishing contract proposal](./MAPS_PUBLISHING_CONTRACT.md)
(2026-10-27) records the existing flow, proposed listing/release metadata,
self-contained `.mcworld` validation, and the representative-world measurements
needed before selecting production limits. It does not enable Maps or resume Mods.

## Rollout and verification

Deploy the hub's Convex functions **before** publishing the matching Next app:
`functions/projects/listing:sitemapEntries` now returns the normalized type used
to construct canonical sitemap URLs. No data migration is needed for this slice.
The function was deployed to the configured development deployment, not production.

Focused regression checks cover redirects and query preservation, canonical URLs,
type mismatch rejection, missing/private content, creator access resolution,
sitemap types, existing listing filters, and public visibility.

Browser checks cover both live development catalogs, filtering and reset,
legacy links, addon detail tabs, wrong-type URLs, anonymous publishing access,
and mobile layout. The reusable signed-in smoke check requires
`E2E_AUTH_STORAGE`. Subsequent development acceptance is recorded below and in
[the content acceptance report](./DEV_CONTENT_ACCEPTANCE.md); production remains
separate.

Validation completed for this slice: production build, app and Convex type checks,
lint on changed application/test files, whitespace checks, 19 Vitest tests,
3 Bun helper tests, and 5 Playwright browser tests. One authenticated Playwright
test was skipped because no signed-in storage fixture was configured.

Starting Next development also refreshed its generated Next.js guidance in
`AGENTS.md`.

Re-run focused browser checks against a running development server with:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3100'
$env:E2E_BROWSER_CHANNEL = 'msedge' # Optional; otherwise Playwright Chromium.
$env:E2E_ADDON_SLUG = '<published-development-addon>'
bun x playwright test e2e/content-routes.spec.ts --workers=1
```

Keep work on `main`. Push and production deployment require the user's instruction.

## Publishing review slice (2026-10-26)

Implemented locally for both addons and resource packs:

- `/dashboard/<type>/<id>/review` shows a private preview of saved content,
  type-specific details, gallery, license, releases, validation results and
  moderator feedback. The existing ownership/type checks protect the route.
- A checklist links to unfinished settings. Core details, description, categories
  and a validated release eligible for review are required; icons, screenshots,
  license and content details are recommendations. Drafts already saved to the
  backend remain available from the dashboard; unsaved form text is not autosaved.
- The sidebar's submission action opens the checklist instead of submitting
  immediately. The server revalidates saved fields and release eligibility.
- Moderators can **Request changes** on a submission awaiting review. This
  returns it to draft with a required reason, preserving its ID, files and
  settings. The creator can correct and resubmit it. The decision is audited;
  the previous feedback clears on resubmission but remains in the audit log.
- **Reject** remains a final decision. Request changes cannot reopen rejected
  listings or bypass the independent-moderator requirement.
- Rejected releases do not qualify a draft for submission/approval. Approving
  a listing approves only validated pending releases. A release that finishes
  validation later still needs review; the existing approved release stays public.
- Failed moderation saves preserve the dialog and feedback for retry.

The new admin-only public mutation is
`functions/projects/projects:requestChanges`; the public API inventory includes
it. No schema migration or artifact-validator deployment is required. Deploy
the matching Convex backend before the Next app, including on development if
the new flow is to be exercised there. The backend was subsequently deployed
to development for the live addon check below; production remains unchanged.

Local checks passed: app/Convex type checks, a production build, changed
application-file lint, whitespace checks, 191 Vitest tests and 87 Bun tests.
Authenticated Convex test scenarios cover personal and
organization ownership, correction/resubmission, final rejection, release
eligibility and public visibility. Isolated Edge browser checks use the real
preview/moderation components with mocked Convex responses: desktop/mobile
layout (including long filenames), checklist gating, failed and successful
submission, required feedback, and failed moderation retry. These are component
interaction checks, not a live authenticated upload/download acceptance test.

The [live development addon check](./DEV_ADDON_ACCEPTANCE.md) passed the actual
upload, external validation, correction/resubmission, CDN delivery, download,
update rejection and unpublishing flow for an addon containing an unpacked
behavior-pack directory. It also found a release blocker: a conventional bundle
containing an inner `.mcpack` was rejected with `MISSING_MANIFEST`. The API fix
now passes 52 tests and the complete live development lifecycle for the same
636-byte bundle through a temporary fixed-validator endpoint. Permanent
deployment of the updated validator worker is still required; the development
endpoint was restored after testing. Subsequent real organization/resource-pack
lifecycle checks passed; see [content acceptance](./DEV_CONTENT_ACCEPTANCE.md)
for their scope, signed-in browser verification, and settings fixes. Interactive
password sign-in, production and in-game acceptance remain separate.
Maps remain the next new content type after publishing acceptance; further
published-metadata review rules and discovery/analytics work remain in the plan.

### Mods are paused

The unfinished Mods additions were removed from the active Hub and API changes.
There are no Mods routes or runtime/schema/validator additions in this slice.
The previous working files, manifests and tracked diffs are preserved locally at
workspace-root `.handoff-backups/20261026-133428-mods-pause/`. That snapshot also
contains completed pre-existing work: recover Mods changes selectively rather
than restoring the whole snapshot over later work. Runtime scope and real
representative artifacts must be settled before implementation resumes.

## Maps UI slice (2026-10-28)

Maps now has local backend support and gated creator, organization, public and
moderation interfaces. Release requirements are immutable snapshots; structural
observations and creator claims are displayed separately. Navigation, catalogs,
canonicals and sitemap handling include Maps behind a default-off UI switch.
Backend creation and remote validation have separate default-off switches.

The production build, application/Convex type checks, changed-file lint,
112 Bun tests, 214 Vitest tests and isolated browser component checks passed.
See [the Maps implementation record](./MAPS_PUBLISHING_CONTRACT.md) for the exact
switches and evidence boundary. No push or deployment occurred. Real packed-world,
hosted capacity, signed-in lifecycle and Minecraft import/play acceptance remain
pending. Mods remain paused.
