# Development addon publishing acceptance

Tested 2026-10-26, 20:16–20:18 America/La_Paz (2026-10-27 UTC).

The current Hub Convex functions were deployed to the explicitly verified
development deployment with TypeScript checking enabled. Production and the
standalone API deployment were not changed.

## Passed: addon with an unpacked behavior-pack directory

The 685-byte `nexus-dev-smoke.mcaddon` contains:

```text
nexus_dev_smoke_bp/manifest.json
nexus_dev_smoke_bp/functions/nexus_test.mcfunction
```

The manifest uses format version 2, unique header/module UUIDs, a data module,
and minimum engine version 1.21.0. The function runs a single `say` command.

SHA-256:
`3b4e99c2371491c6093745e935743614d35448156e49629944293f80e740e837`

Verified against live development services:

- Created temporary Better Auth creator/moderator users and valid sessions;
  invoked protected backend functions using Convex CLI test identities.
- Created a private draft and confirmed the public query did not expose it.
- Reserved the upload, PUT the actual file to private R2 storage, synchronized
  metadata, and created the release using its upload reservation.
- The deployed external validator returned `valid`: 2 entries, 1 manifest,
  582 uncompressed bytes. No validation result was mocked or overridden.
- Submitted the draft, requested moderator corrections, saved the corrected
  description, and resubmitted it.
- Independent moderator approval promoted the file to public CDN storage.
- The real local Next download endpoint returned HTTP 307 with `no-store`.
  Following the CDN redirect returned exactly the uploaded bytes and SHA-256.
- The first download counted once; repeating it did not increase the count.
- A second real upload validated but remained private pending review. Rejecting
  that update left version 1.0.0 as the public latest release.
- Unpublishing demoted the approved file, removed public listing visibility,
  and made the download endpoint return HTTP 404.

## Initial failure: bundled .mcpack inside .mcaddon

The same behavior pack was zipped into an inner `.mcpack` and then placed in a
636-byte `.mcaddon`:

```text
nexus_dev_smoke_bp.mcpack
  manifest.json
  functions/nexus_test.mcfunction
```

The deployed validator rejected this with:

```text
MISSING_MANIFEST: Pack archive does not contain a manifest.json file
```

This is a supported packaging layout in Microsoft's
[Minecraft file extensions documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/minecraftfileextensions?view=minecraft-bedrock-stable).
At the time of the initial test, the API implementation only searched the outer
ZIP's entries for `manifest.json`; it did not inspect embedded `.mcpack` archives.

This exposed a release blocker for bundled addons. The API was not edited or
deployed during the initial test; the subsequent fix and retest are recorded below.

## Cleanup and limits

All three test releases and their private/public storage files were removed.
The test project and upload reservations were removed and checked absent.
Temporary users and sessions were deleted; the development user count returned
to its original value. Moderation audit history was retained. The temporary
local Next server was stopped.

Local evidence and both addon fixtures remain under
`test-results/dev-publishing/` (ignored by Git), including `report.json` and the
test runner. The report's `passed` field describes the primary lifecycle;
`bundledAddonAccepted: false` records the separate packaging failure.

This tested actual storage, validation, moderation and download behavior. It
did not test interactive browser sign-in, organization/resource-pack publishing,
production, or importing/running either fixture in Minecraft.

## Fixed-validator retest

Retested 2026-10-26, 20:41–20:43 America/La_Paz (2026-10-27 UTC).

The API now inspects embedded `.mcpack` archives. Extraction uses bounded
temporary files with CRC checking, one embedded layer, at most 64 packs and
256 MB per pack. The existing 10,000-entry, 4 GB expanded-size and 200:1
expansion limits also apply across the complete bundle. Every embedded pack
must have a valid manifest and matching module. Temporary storage failures
return HTTP 503 so Convex retries rather than deleting a file as malformed.

API type checking, lint, and all 52 tests passed. Regression coverage includes
the exact original 636-byte fixture, mixed behavior/resource bundles, unpacked
packs, unsafe paths, duplicate/encrypted entries, malformed/missing manifests,
unsupported modules, recursive bundles, aggregate entry/expansion limits,
temporary-file cleanup and retryable storage failures.

For the real retest, the fixed validator ran behind a temporary HTTPS endpoint
with a separate generated API key. Only development's
`ARTIFACT_VALIDATOR_URL` and `ARTIFACT_VALIDATOR_API_KEY` were temporarily set.
The shared deployed validator and production configuration were unchanged.

Both version 1.0.0 and version 1.0.1 of the bundled addon passed the actual
external validator: 636 file bytes, 3 entries including the embedded container,
1 manifest, and 1191 expanded bytes including the container's processed bytes.

The full development lifecycle passed again using this bundled fixture:
private upload, validation, moderator correction and creator resubmission,
approval, CDN promotion, the real Next download route, byte-for-byte matching,
deduplicated counting, pending-update visibility, update rejection, and
unpublishing with HTTP 404 download access afterward. The downloaded SHA-256
was `03890f8cb6869f8660907458cc941b78527d390701558f4afec60c9b9ee5cde9`.

The download check used a dedicated local application port to avoid an existing
server on the shared test port. Temporary accounts, sessions, project, releases,
upload reservations and storage files were removed and checked. The original
development validator configuration was restored and verified; temporary
services and test configuration files were removed. Audit history was retained.

Local retest evidence is in `test-results/nested-pack-fix/`, including
`report.json` (`passed: true`, `bundledAddonAccepted: true`) and the fixed
validator's two successful responses in `validator-responses.jsonl`.

**Permanent rollout is pending.** Deploy the updated API validator worker to
make the fix available at the shared validator endpoint. No API push/deployment,
Hub push, or further Convex deployment was performed for this fix. Restoring
development's original endpoint means normal development validation still uses
the previously deployed worker until that worker is updated. Organization,
interactive sign-in, container/production and in-game acceptance remain outside
this test.

The subsequent [content acceptance checks](./DEV_CONTENT_ACCEPTANCE.md) passed
the real personal resource-pack and organization addon/resource-pack lifecycles,
plus signed-in browser creation, settings, upload, moderation and download.
They also found and fixed disabled settings saves and organization-to-personal
ownership changes. The shared validator rollout and production/in-game
acceptance remain pending.
