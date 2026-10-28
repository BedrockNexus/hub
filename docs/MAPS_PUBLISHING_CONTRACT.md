# Maps publishing contract and local implementation

Started: 2026-10-27. Updated: 2026-10-28. Status: Maps backend and UI implemented
locally behind default-off switches. Creator, organization, public and moderation
interfaces are present; hosted publishing and Minecraft acceptance remain pending.
Work stays on `main`; no push or deployment is
authorized. Mods remain paused, including their preserved handoff snapshot.

This follows [the content roadmap](./CONTENT_TYPES_ROADMAP.md) and the workspace
handoff `docs/handoffs/2026-10-26-content-publishing-deployment.md`.

## Existing flow and reuse boundary

Source inspection on 2026-10-27 found:

| Stage | Current implementation | Maps extension |
| --- | --- | --- |
| Listing | `lib/project-artifacts.ts`, `lib/project-metadata.ts`, `lib/schemas/projects.ts`, `convex/schemas/projects.ts` | Add explicit `map` discriminants; retain shared projects, ownership, categories, gallery, license and IDs. |
| Routes | `lib/content-routes.ts` | Replace the addon/otherwise-resource-pack branch with exhaustive type routing before exposing `/maps`, typed detail/settings and organization lists. |
| Upload | `components/uploads/version-file-upload.tsx`, `convex/functions/projects/versions.ts` | Retain owner checks, version-bound upload reservation, private PUT, storage metadata synchronization, actual-size comparison and one-time reservation consumption. Add a Maps policy in both Hub and API. |
| Release | `versions:create` | Currently stores version, changelog and game versions, sets validation/review pending and schedules validation. Add a release-specific Maps metadata snapshot. |
| Validation | `convex/functions/projects/artifactValidation.ts`, API `src/routes/artifact-validate.ts`, `src/lib/artifact-validator.ts` | Retain API-key authentication, allowlisted HTTPS source URL and retry handling. Introduce a world validator and a bounded, versioned report. |
| Review | `lib/project-submission.ts`, `projects.ts`, `versions:reviewRelease` | Retain preview, independent moderation, request changes/resubmit and separate update approval. Maps requirements must become required checklist/server checks. |
| Delivery | `artifactDelivery.ts`, `versions:createDownloadUrl`, `convex/lib/projectReleases.ts` | Retain private-to-CDN promotion, download visibility/counting, demotion and deletion. Bind validation to the exact promoted bytes. |

Current policies accept `.mcaddon`/`.mcpack` up to 256 MiB (UI says MB). API ZIP
budgets are 10,000 entries, 4 GiB expanded and 200:1 expansion; JSON manifests
are limited to 1 MiB. Addons allow 64 inner packs, each up to 256 MiB, one layer
deep. These are existing pack limits, not measured Maps capacity.

The validator reads ZIP entry metadata and pack manifests, and extracts inner
packs to bounded temporary files. It does not parse world metadata or a world
database, read every ordinary payload to verify its CRC, or return a SHA-256.
Its report currently holds type, declared file size and archive/manifest counts.
Convex uses a 120-second request timeout, a 15-minute source URL, and up to three
attempts with scheduled backoff. Infrastructure exhaustion returns 503; after
retries Convex records `VALIDATOR_UNAVAILABLE` without deleting the upload.

`isValidatedRelease` and `isApprovedRelease` deliberately accept absent statuses
for legacy releases. Maps must require explicit `valid` and `approved` states,
a supported Maps report version, and complete release metadata at submission,
approval, public queries and download/promotion gates. Do not inherit that legacy
fallback. No change to existing addon/resource-pack compatibility is proposed.

## Proposed content and metadata model

Use internal type `map` and public label **Map / Maps**. A map is a playable
Bedrock world save, delivered as one `.mcworld` per release. Templates, Java
worlds, schematic/structure-only files, raw folders, generic `.zip` uploads and
multi-world bundles are outside the first slice.

### Listing information

Reuse the shared name, slug, summary, rich description, media, license, credits,
links and personal/organization ownership. Existing length rules still apply.
Drafts may be incomplete; submission must enforce saved values on the server.

Require 1-3 active map categories from `projectCategories`, with proposed seed
slugs `adventure`, `survival`, `parkour`, `puzzle`, `minigame`, `pvp`, `horror`,
`creation`, and `survival-spawn`. These describe gameplay rather than new content
types. Validate category ownership/type server-side; use existing tags for finer
detail. Keep gallery/icon/license recommendations consistent with the current
flow; bundled third-party content still needs redistribution review.

### Release information

Add a discriminated `releaseMetadata` object on `projectVersions`, with
`type: 'map'` and `schemaVersion: 1`. Reuse the release's existing `version`,
`changelog` and `gameVersions`. Proposed fields and bounds:

| Field | Contract |
| --- | --- |
| `players` | Required `{ min, max }`; safe integers, `1 <= min <= max <= 1000`. This is the creator's recommended group size, not a measured server capacity. Solo support follows from `min === 1`. The upper bound is a metadata guardrail. |
| `gameplay` | Required plain-text overview, trimmed 20-2000 characters: objective, starting point and how play works. |
| `installation` | Required plain text, trimmed 20-4000 characters: import/open steps and map-specific setup. Offer a prefilled Bedrock import guide that the creator can edit. Do not promise universal device import support. |
| `gameVersions` (existing release field) | Required 1-50 unique supported stable Bedrock versions, checked against the site's version catalog. Creator-declared compatibility; no automatic claim that later versions work. Preview/Education-only worlds are outside this slice. |
| `experiments` | Required `{ required: boolean, names: string[] }`; at most 32 unique names, each 1-100 characters. Empty names when false; at least one when true. |
| `requirements` | Required `{ commandBlocksRequired: boolean, cheatsRequired: boolean, notes?: string }`; notes at most 2000 characters. Creator claims, checked against observable world settings where possible. |
| `bundledPacks` | Required array, empty for vanilla worlds, at most 64 items. Each has `kind: 'behavior' | 'resource'`, display name (1-80 characters), header UUID, exact version and optional credit (up to 500 characters). Supported version representation must match the validator's explicitly supported manifest formats. |

There is no separate category enum or editable `hasPacks` boolean in release
metadata. Categories live on the listing; pack presence comes from the inventory.
For v1 all required non-engine packs must be bundled. Missing packs or external
download-only requirements block submission; optional recommendations can appear
in notes but cannot satisfy a pack reference. Bundled packs need no duplicate
public addon/resource-pack listing. Standard Bedrock script modules inside a
behavior pack do not enable a separate Mods content type or runtime.

Store this snapshot with its artifact, not in mutable `projects.metadata`.
Draft UI may copy the previous release as defaults but must save a fresh snapshot.
After release creation, requirement or file changes require a replacement/new
release and validation/review; no mutation of an approved snapshot in place.
Return requirements from the selected public release on release/detail/download
views; a pending update must not overwrite the current public requirements.
Any listing summary of these fields must derive from the latest public release.

Keep three distinct records: creator claims (`releaseMetadata`), machine
observations (`validationReport`), and moderator decisions (existing review
fields/audit). In-game test evidence, if collected, needs its own version,
platform, result and date; do not imply it exists from structural validation.

## Proposed world-file validation

### Accepted structure

Only a ZIP-format `.mcworld` with one world at the archive root:

```text
level.dat                         required, nonempty, parseable world metadata
db/<files>                        required, at least one nonempty regular file
levelname.txt                     optional
world_icon.jpeg                   optional; not automatically a listing image
world_behavior_packs.json         optional; checked if present
world_resource_packs.json         optional; checked if present
behavior_packs/<pack>/manifest.json  optional bundled behavior packs
resource_packs/<pack>/manifest.json  optional bundled resource packs
```

The root rule follows Microsoft's export/repack guidance: zip world contents,
not their containing folder. Ordinary exported worlds need no root pack
manifest. Optional backup/history/text files may be retained, without treating
them as the current configuration. [Microsoft world export guidance](https://learn.microsoft.com/en-us/minecraft/creator/documents/createaworldtemplate).

Do not silently repair paths, unwrap a folder, remove files, rewrite world IDs,
repackage, or change settings. Report a fix and ask for a new creator export.
Reject additional world roots, Java layouts, and template-only/root
`world_template` modules with a specific unsupported-format message. A nonempty
`db/` is a completeness check only; do not require particular numbered filenames
or treat the presence of an `.ldb` file as database integrity proof.

### Validation stages

1. **Source and bytes.** Authenticate the API call; validate Maps type, extension,
   finite positive integer size and Maps limits independently of Hub. Use only
   the allowlisted private source, forbid redirects to untrusted hosts, and pin
   reads to one object identity. Compare actual fetched byte count with expected
   size and compute SHA-256. Seal the consumed upload into a server-controlled
   object before validation so a still-live presigned PUT cannot replace it.
   Promotion must copy that sealed object conditionally on the recorded identity;
   a mismatch fails closed and requires revalidation. Do not use ETag as SHA-256.
2. **Archive safety.** Reuse bounded ZIP traversal, duplicate/encryption checks
   and shared expansion accounting. Add rejection of links/special files,
   file/directory collisions and ambiguous normalized paths (case, dot segments,
   Unicode and platform path aliases). Reject absolute paths, backslashes,
   traversal and control characters. Do not extract arbitrary paths to disk.
   Stream every regular entry through byte limits and CRC verification; central
   directory sizes alone are insufficient. Support only tested ZIP compression
   methods; reject split archives and unsupported ZIP features with clear codes.
3. **World metadata.** Parse `level.dat` with a bounded Bedrock-specific parser,
   checking the supported header/version, declared payload length and root
   compound. Bound bytes, nesting, list/string lengths and total tags; never
   execute content. Record only allowlisted observations such as save version,
   experiments and command/cheat settings when present. Unknown format versions
   return unsupported-format, not a fabricated compatibility result. Parser
   choice, exact supported save versions and numeric parsing budgets must be
   settled with real exported fixtures before implementation is considered ready.
4. **World data.** Check the required root and nonempty `db/`; stream/CRC-check
   its entries within the common budgets. Do not open, repair or mutate LevelDB
   in this slice. Structurally present but semantically damaged databases can
   still pass this check; only import/play testing establishes usability.
5. **Pack inventory.** Parse present activation JSON as bounded arrays of UUID /
   version references. Each unpacked pack directory must have its own supported
   manifest; validate header UUID/version, module UUIDs/types and dependencies.
   Resource directories require resources modules; behavior directories require
   supported behavior/script modules. Reject duplicate/conflicting identities,
   unresolved active references and unresolved UUID dependencies, including
   version/type mismatches. Recognize built-in script `module_name` dependencies
   separately; report them as engine requirements, not missing downloadable packs.
   Compare inventory against creator declarations server-side. No nested
   `.mcpack`/`.mcaddon`/world archives in v1; request a normal world export with
   unpacked packs. Report inactive bundled packs as a review warning.
6. **Reconcile and review.** Reject omitted bundled-pack declarations or
   contradictory detectable requirements with field-specific feedback. Preserve
   unknown/unobservable settings as unknown, rather than false. Surface observed
   experiments and engine requirements to the moderator; neither saved settings
   nor manifest minimum versions prove gameplay requirements or compatibility.

Manifest identity, module types and UUID dependencies follow the
[official manifest reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/addonsreference/packmanifest?view=minecraft-bedrock-stable).
The stricter self-contained inventory and no-nesting rules above are proposed
BedrockNexus policies. Build a tested manifest-format allowlist; do not assume
that the current pack validator's minimal header/module checks implement it.

### Result contract

Retain the existing valid/invalid response shape, adding a Maps report variant:
`type: 'map'`, `schemaVersion: 1`, `validatorVersion`, `policyVersion`, actual
`fileSize`, `sha256`, object identity, `entryCount`, `totalUncompressedSize`,
world observations, bounded pack/reference inventory and structured warnings.
Warnings contain stable codes and bounded safe paths/field names, never source
URLs, player records, seeds, arbitrary NBT dumps or raw file contents. Cap all
arrays and serialized report bytes; a truncated inventory cannot qualify as
complete validation. Show user-facing text: **World structure checked**.

Proposed world-specific failure codes: `MISSING_WORLD_METADATA`,
`INVALID_WORLD_METADATA`, `UNSUPPORTED_WORLD_FORMAT`, `MISSING_WORLD_DATA`,
`AMBIGUOUS_WORLD_ROOT`, `INVALID_WORLD_PACK_REFERENCES`,
`UNRESOLVED_PACK_DEPENDENCY`, `MAP_METADATA_MISMATCH`, `UNSUPPORTED_NESTED_ARCHIVE`,
and `ARTIFACT_IDENTITY_MISMATCH`. Reuse existing extension/archive/path/expansion
codes where their meaning matches. Every permanent error includes an actionable
creator fix; unsupported formats are not labeled corrupt.

Malformed/unsafe artifacts cannot be promoted. Network/service/temp-storage
failures remain retryable, private and retained under existing cleanup policy;
keep them distinct from permanent content failures. Thread the report validator
through API response, Convex action/result arguments, schema, owner/moderator
queries and UI. Validate response shape and type/identity before applying it.
Never claim malware-free, database integrity, successful import or playability
from these checks.

## Limits and acceptance before enabling Maps

Do not pick a larger production upload cap from pack limits or ZIP metadata.
The initial local evaluation ceiling may reuse 256 MiB compressed / 4 GiB
expanded / 10,000 entries / 200:1 with explicit rejection above any bound. This
is a measurement harness configuration, not a promised Maps publishing limit.
Keep addon/resource-pack limits unchanged. Report MiB/GiB accurately in new UI.

Collect permission-cleared, real stable Bedrock exports: small vanilla survival,
creation/large terrain, multiplayer minigame, experiment-enabled world, and
worlds with behavior/resource/script packs. Include log-heavy/small fresh saves
and exports from supported desktop/mobile versions. Record provenance, compressed
and expanded sizes, entries, ratios, largest files, validation wall time, peak
memory, temporary disk, promotion/demotion time and download time/hash. Large
representative worlds must be measured, even if they exceed the initial ceiling.

Choose independent compressed, expanded, entry, ratio, metadata, pack-count,
report, runtime, temporary-disk and concurrency limits from those measurements.
Check the 120-second Convex request, source URL expiry, full-entry scan cost and
single-object PUT/copy path. If representative worlds cannot fit safely, decide
on queued validation/multipart uploads before raising limits or exposing forms.
No production capacity or Minecraft acceptance has been tested in this slice.

Required verification for the implementation:

- Validator fixtures: root vanilla and bundled-pack exports; missing/truncated
  metadata, empty DB, wrapped/multiple roots, Java/template files, malformed
  activation arrays, missing/mismatched packs, unsupported manifests, unsafe
  paths/links/collisions, encrypted/nested/oversized archives, forged size/CRC,
  expansion attacks and bounded parser failures. Synthetic fixtures supplement
  real exports; they do not replace them.
- Hub/backend: type mismatch rejection; personal/organization authorization;
  single-use/expired reservations; consumed-URL overwrite and stale validation
  result protection; required snapshot/checklist checks; Maps rejects missing
  validation/review states; corrections/resubmission and independent moderation;
  rejected/pending updates leave the old public release and requirements intact.
- Lifecycle: private upload -> validation -> review -> promotion -> exact-byte
  download/hash and counting -> rejected update -> unpublish/demotion -> blocked
  download -> release/project deletion and stale-upload cleanup. Test deletion
  and unpublish while validation/promotion is in flight, without orphan objects.
- Browser: typed creator and organization flows, field errors, validation
  feedback, preview, selected-release requirements, public detail/download and
  desktop/mobile layouts. In-game: clean-client import and actual play on stated
  Bedrock versions/platforms, including required packs and multiplayer examples.

## Implementation sequence

1. Review this proposal, collect representative artifacts and settle the parser,
   supported formats and measured limits. No Mods recovery is needed.
2. Implement/test the API Maps validator and byte-identity contract locally.
3. Extend Hub types/schema, release snapshot, strict eligibility, reservations,
   report transport and delivery; test personal and organization lifecycles.
4. Add Maps forms/routes, categories, navigation, public metadata/discovery,
   sitemap and moderation UI using the shared flow; preserve old redirects.
5. Complete local/development acceptance. Only after separate user authorization:
   release validator -> Convex -> Hub, then production lifecycle verification
   and temporary-data cleanup.

## Local foundation implemented (2026-10-27)

- API `src/lib/map-validator.ts` validates stable local bytes with full-entry
  CRC checking, bounded archive/metadata parsing, exact pack identity/reference
  matching and SHA-256. `src/check-map.ts` is a read-only local evaluation runner.
  The CLI streams each source into a temporary snapshot, hashes those exact
  bytes, reads the snapshot and removes it afterward. Its local file-backed
  ceiling is 512 MiB to evaluate supplied worlds larger than the pack cap;
  in-memory evaluation retains 256 MiB. Neither ceiling is a production policy.
  Hosted capacity and streamed remote validation remain separate work.
- The parser initially supports storage header version 9, backed by Microsoft's
  pinned parkour sample, and bundled manifest format 2. Other versions fail with
  an unsupported-format code. NBT limits: 1 MiB, depth 32, 50,000 tags, 16,384
  collection elements and 32,768 bytes per string. Reports expose saved command
  and command-block settings and enabled experiment names; they do not infer
  actual gameplay requirements or dump world/player metadata.
- Hub `lib/map-release-metadata.ts` provides a strict, dormant release contract,
  catalog-backed game-version validation and reconciliation against observed
  packs/settings. It is not registered in the live schema, forms or mutations.
- The unmodified [Microsoft sample](https://github.com/microsoft/minecraft-samples/blob/5e04b6f719c316b0611f569af0cab7d6e9a2fb26/parkour_sample_world/SampleParkourWorld.mcworld)
  is vendored with its MIT notice and SHA-256 in API `tests/fixtures/maps/`.
  It passes structural checks: 53,915 compressed bytes, 63,390 expanded bytes,
  eight entries and no bundled packs. This does not establish a current game
  version or a successful Minecraft import/play test.
- The production artifact-type allowlists remain unchanged: HTTP validation
  rejects Maps and Hub does not allow their creation. Mods remain paused.

Two creator-supplied exports in `C:\dev\worlds` also pass local structural checks
through the file-backed path, at 312,489,649 and 451,457,946 compressed bytes.
Their source files are not vendored. Both use metadata header version 9 and have
no bundled packs. The API `docs/MAPS_EVALUATION.md` records hashes, archive sizes,
entry counts and local timings. These exceed the pack cap, demonstrating why
Maps limits cannot simply reuse it. They do not establish hosted capacity.

## Local backend integration (2026-10-27)

This supersedes the offline-only integration status above; it does not change
production or authorize a deployment.

- The additive schema recognizes `map`, with optional Maps-only fields on
  existing release rows. `releaseMetadata` is validated against the strict
  contract at creation, including active catalog game versions. It has no
  in-place update API. Shared personal/organization permissions and one-use,
  version-bound upload reservations remain in force.
- `PROJECT_TYPES` still lists only addons/resource packs for normal creator
  navigation. The public project mutation explicitly refuses creating or
  changing another project into a Map. Internal fixture rows exercise the
  backend in `convex-test`; there is no new public Maps draft endpoint.
- Validation attempts have unique tokens. Stale results, duplicate completed
  callbacks and callbacks after deletion begins cannot change the release.
  Sealing reserves a distinct server-owned key before copying, uses the original
  upload's ETag as `CopySourceIfMatch`, and records the sealed ETag only for the
  active attempt. Successful sealing removes the writable staging object;
  late PUT replays remain outside the sealed namespace and eligible for cleanup.
- Hub calls the API's opt-in `/artifact-validate/maps` endpoint with that identity.
  The endpoint downloads once with `If-Match`, forbids redirects, verifies actual
  size and ETag, hashes/validates an owned local snapshot, and returns its report.
  Hub bounds response bytes, validates the report schema, checks metadata claims
  and compares identity/size again before accepting it. Infrastructure failures
  remain private and retryable.
- Map eligibility requires explicit validation and approval, a supported complete
  report, the sealed identity and matching requirements. The legacy missing-state
  fallback is retained for existing pack releases. Public release/detail/download
  queries and approval/promotion gates use the selected release's snapshot.
- Promotion checks sealed size/ETag and copies with `CopySourceIfMatch`. Its
  final mutation rechecks publication, review and identity. Maps retain their
  private sealed copy after publication, so unpublish/demotion does not reconstruct
  a trusted source from public bytes. Removal and stale-upload reference checks
  account for sealed and staging keys. No new public Maps moderation UI exists yet.
- R2 conditional-copy support was checked against the current
  [S3 compatibility documentation](https://developers.cloudflare.com/r2/api/s3/api/).
  R2 does not support S3 Object Lock; immutability here comes from a distinct key
  that is never issued a creator PUT URL, plus conditional reads/copies.

Local verification covers HTTP/S3 calls with mocks, real Convex function execution
in `convex-test`, personal/organization access, report/attempt identity, pending
and rejected updates, deletion during sealing and late promotion after unpublish.
These are not hosted R2/Convex lifecycle or Minecraft acceptance results.

Next: obtain real packed exports, settle hosted limits, and build Maps creator,
moderation and public routes/forms around this pipeline. Then perform full local
and development lifecycle acceptance. Further deployment requires user instruction.

## Local UI integration (2026-10-28)

This supersedes the missing-UI status above. No flags were enabled, no backend
was deployed and no hosted resource was changed. All changes remain local on
`main`; Mods remain paused.

- Added `/maps`, typed detail/gallery/release/review sections, `/dashboard/maps`,
  draft creation, settings/review/release forms, and organization Maps lists.
  The shared stored-type, ownership and organization checks remain in place.
  Disabled Maps routes return not found before querying content.
- Maps navigation, create menus, creator/organization tabs, category management
  and sitemap entries follow the UI switch. Existing addon/resource-pack links
  and redirects remain available.
- Map drafts use the shared listing fields and ownership selector, without
  pretending their mutable listing metadata is a resource pack. Player counts,
  gameplay, installation, commands/cheats, experiments and unpacked bundled-pack
  declarations are entered with each new release and sent as its snapshot.
  The creator can select at most three categories; the backend also checks
  unique active Map categories. An administrator must create/activate the Map
  taxonomy in the target environment before creator acceptance.
- Creator previews and moderator views show saved Map requirements and a separate
  structural-check summary. Moderation eligibility comes from the backend's strict
  Map checks. Public requirements and SHA-256 use the selected public release;
  pending updates do not replace its requirements. Pack UUID uniqueness errors
  are visible, and removing a pack row preserves the remaining row's values.
- Maps cannot change into another content type, and existing packs cannot become
  Maps through the generic update API. This keeps Map-specific release and
  delivery rules attached to their original content type.

### Switches

| Location | Switch | Default |
| --- | --- | --- |
| Hub build and navigation | `NEXT_PUBLIC_MAPS_ENABLED=true` | Off; Maps routes return 404 and navigation/sitemap omit Maps |
| Convex project creation | `MAPS_PUBLISHING_ENABLED=true` | Off; public Map draft creation is refused |
| API validator | `ENABLE_MAP_ARTIFACT_VALIDATION=true` | Off; `/artifact-validate/maps` returns 404 |

The UI value is compiled into the Next build. It cannot enable the authoritative
backend or API switches. These names document the future coordinated rollout;
this work did not set them in any environment. Further push/deployment remains
subject to the user's instruction.

### Verification

- Changed application/test files pass Biome; application and Convex type checking
  and the production Next build pass. All 112 Bun and 214 Vitest tests pass.
  Vitest ran with one worker after the build, without changing test timeouts.
- Route tests cover disabled gates before queries, enabled Maps canonicals,
  wrong stored types and unauthorized settings. Convex tests cover default-off
  creation, explicit opt-in draft creation and content-type immutability.
- `node scripts/check-maps-ui.cjs` starts an isolated, temporary localhost
  component harness and closes its headless browser/server afterward. It checks
  minimum/maximum players, experiments, duplicate pack UUID feedback, field-array
  removal, saved requirements, structural observations and mobile overflow with
  an 80-character pack name. It uses synthetic form/report fixtures and does not
  connect to Convex, upload files, sign in, or change R2 objects.
- Build verification caught and corrected a misplaced client directive and a
  missing project-type field in the pending-release response. The final build
  and regression results above include those fixes.

Next: real packed-world exports and hosted capacity measurements, then an
authorized development deployment with the three switches coordinated. Verify
the signed-in personal/organization upload, validation, corrections, independent
review, byte/hash download, update, unpublish and deletion lifecycle, followed by
clean-client Minecraft import/play tests. These acceptance checks remain open.

## Archive review follow-up (2026-10-28)

The API now checks the shared 64-pack inventory limit before reading archive
contents, bounding the number of retained manifest JSON documents before
decompression. It also rejects aliases of reserved pack roots, activation lists
and manifest filenames that the exact-name inventory could miss. Casing inside
creator-chosen pack folder names remains supported. Both changes preserve the
report schema and require no Hub runtime changes.

API lint, type checking and all 119 tests pass, including 13 new regression
cases and the unchanged official world fixture. The previous Hub verification
above was not repeated for this API-only change. No flags were enabled; no
push, deployment, hosted acceptance or in-game acceptance occurred. The open
acceptance gates above and the Mods pause still apply.

## Development acceptance (2026-10-28)

The user subsequently authorized fixture checks, local capacity measurement and
development lifecycle acceptance. The current Convex backend was deployed only
to development, including a shared upload-readiness fix discovered in browser
testing. The local Maps-enabled Hub and temporary authenticated API worker passed
real R2/validation/moderation/download/update/unpublish/delete checks for personal
and organization content, plus signed-in browser release entry and independent
approval. See [the acceptance record](./DEV_MAPS_ACCEPTANCE.md) for exact evidence.

API now includes a pinned official-source BP/RP/script world and provenance.
A game-exported packed world remains unavailable; no Minecraft import/play
acceptance is claimed. Local capacity probes cover near-compressed/expanded
limits and maximum manifest count. The latter peaks at 659.7 MiB RSS, so metadata
retention needs attention or a larger measured worker budget before production.

Final checks: API lint/types and 120 tests; Hub build/types, changed UI lint,
112 Bun tests and all 217 Vitest tests pass. The public API inventory explicitly
includes the authorized, reservation-scoped upload-completion action.

All test data/files were removed and the ten-user development baseline verified.
Original development validator/key and Maps flag states were restored; temporary
services stopped and private restore files were removed. Development backend code
remains deployed. No Git push, production deploy or production configuration
change occurred. Work remains uncommitted on `main`; Mods remain paused.
