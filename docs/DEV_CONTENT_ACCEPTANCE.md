# Development content publishing acceptance

Tested 2026-10-26 America/La_Paz (2026-10-27 UTC).

This extends [the addon acceptance checks](./DEV_ADDON_ACCEPTANCE.md) to resource
packs, organization ownership, and signed-in browser interactions. The Hub ran
locally against the verified development Convex deployment and real R2 storage.
The updated API validator ran behind a temporary authenticated HTTPS endpoint;
only development's validator configuration was temporarily changed.

## Backend lifecycle results

All three cases passed using temporary creator, organization-member, outsider,
independent moderator, and organization-affiliated site-admin accounts:

| Case | Artifact | Update decision |
| --- | --- | --- |
| Personal resource pack | 619-byte `.mcpack` | Rejected; previous release stayed available |
| Organization addon | 636-byte bundled `.mcaddon` | Rejected; previous release stayed available |
| Organization resource pack | 619-byte `.mcpack` | Approved; both versions remained downloadable |

Each case exercised real draft creation and editing, private R2 upload,
metadata synchronization, external validation, submission, moderator corrections,
resubmission, independent approval, public CDN promotion, and the Next download
route. Downloads matched the uploaded bytes and SHA-256; repeating a download
did not increment its count again. Unpublishing demoted files and returned
HTTP 404 from the download route.

Outsiders could not read private drafts, edit them, or reserve uploads.
Organization members could edit and submit content but could not delete the
listing or take ownership. An affiliated site admin could not approve the
organization's listing or review its updates. Public attribution used the
organization identity. Resource-pack upload reservations rejected `.mcaddon`
files.

The resource fixture contains a format-version-2 resources manifest and a
16-by-16 stone texture. Its validation report contains two entries, one manifest,
and 608 uncompressed bytes. SHA-256:
`651a822c7dea43c492b5e9fae70ceb339a9289264399ae2212727ddb3b10d332`.

The addon contains an embedded behavior `.mcpack`; its report contains three
entries including the embedded container, one manifest, and 1191 processed
uncompressed bytes. SHA-256:
`03890f8cb6869f8660907458cc941b78527d390701558f4afec60c9b9ee5cde9`.

## Settings fixes discovered during browser acceptance

- Valid edits could leave **Save Changes** disabled. The affected project/server
  settings forms now subscribe to React Hook Form's dirty and validity state
  before loading returns or conditional save-button evaluation.
- Selecting personal ownership omitted `organizationId`, so the backend retained
  the organization. The general settings forms now send an explicit empty
  selection, and shared backend normalization resolves it to the authenticated
  user's ID. Current-owner management and destination membership checks remain.
- Eight regression tests cover organization owner/admin transfers in both
  directions, omitted-owner updates, and member transfer denial for projects
  and servers. These and the six publishing regression tests passed.

The ownership fix was subsequently deployed to development with Convex type
checking enabled. The three backend lifecycle cases above ran before that fix;
the signed-in browser rerun uses the updated backend.

## Signed-in browser results

The rerun passed at 21:28–21:31 America/La_Paz in headless Microsoft Edge against the real development
backend, using short-lived Better Auth sessions for the temporary accounts.
The session cookie was signed with the development auth configuration; the
application accepted it through its normal session and Convex authentication
paths. Password entry, signup, and verification email delivery were not tested.

- Created a personal resource pack and an organization addon through their
  dedicated forms. Stored type and owner matched each form; the forms exposed
  their respective content-specific fields.
- Saved general settings and selected MIT through the license combobox;
  reloading retained the license. Resumed saved drafts, verified incomplete
  submission was disabled, and checked the preview at a 390-pixel viewport.
- Uploaded the real 619-byte `.mcpack` through the browser, selected a compatible
  game version, created the release, and received a real valid external result.
  The private R2 browser PUT succeeded from `http://localhost:3000`.
- Submitted the resource pack through its preview page. A separate moderator
  browser session requested changes with a reason; the creator saw the feedback
  and resubmitted; the moderator approved it. CDN promotion completed and the
  actual download route returned the original bytes.
- Opened the organization's addon dashboard and found its new listing.
  An outsider's browser received the not-found page for creator settings.
- On the updated backend, an ordinary member's attempted transfer failed with
  the expected permission error and left organization ownership intact. The
  organization owner then selected personal ownership in the browser and saved
  it; the stored owner became that user's actual ID.

An earlier browser attempt clicked the organization selector before it opened.
The test now checks the real organization-list response and waits for the
selector's open state. That timing adjustment required no product change.

## Verification and cleanup

The production build, application/Convex type checks, affected settings-form
lint, whitespace checks, eight ownership regressions, and six publishing
regressions passed. The browser report contains eleven completed checks.

Temporary listings, releases, upload reservations, private/public files,
memberships, organizations, sessions and users were removed. Follow-up queries
found zero acceptance listings, users or organizations, and the development
user count returned to ten. Moderation audit history was retained. The original
development validator URL and API-key state were restored and verified. The
temporary validator, tunnel and local Next server stopped; private restore/test
configuration files were removed.

No repository was pushed, and no production or shared API deployment changed.

## Scope

The shared validator deployment, production, interactive password sign-in and
email verification, container deployment, large-file behavior, and importing or
running the fixtures in Minecraft require separate acceptance. Mods remain
paused. Permanent deployment of the updated API validator is still required;
normal development validation uses the original shared endpoint after cleanup.

Local evidence and fixture files are under the ignored
`test-results/content-acceptance/` directory. The report records reused backend
results separately from each subsequent browser attempt.
