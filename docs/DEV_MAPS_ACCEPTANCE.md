# Development Maps publishing acceptance

Tested 2026-10-28 against development Convex `original-crocodile-504`, real R2
storage and public CDN delivery. The current backend was deployed to development
with Convex type checking enabled. Hub ran locally with the Maps UI enabled;
the API worker ran behind a temporary authenticated HTTPS endpoint. No Git
push or production deployment/configuration change occurred. Mods remain paused.

## Fixture and capacity boundary

The 577,562-byte source-built fixture combines the unchanged file payloads of
Microsoft's saved Parkour world with its released Chill Dreams behavior,
resource and JavaScript packs. The two activation files were added using the
pack header identities. SHA-256:
`4967b466a0db7862107aa520db5ccce9bc4596ea6ea9fe327500611bf64ed406`.
It passes with 60 entries, 629,808 expanded bytes, two packs and no warnings.
The API repository includes the fixture, provenance, Microsoft MIT notice, a
hash-checking rebuild script and a pinned regression test.

This is an official-source integration fixture, not a game-exported packed world.
The user confirmed no such export is available. The two supplied creator exports
contain no packs and remain untouched. A Mojang tooling `.mcworld` with scripts
was also checked: it contains no database and correctly fails the complete-world
contract. No world was imported or played in Minecraft for this work.

Local capacity probes accepted a 511 MiB archive and an archive expanding to
4,095 MiB; an input one byte over 512 MiB failed before snapshot creation.
Peak RSS was 252.4 MiB and 279.8 MiB for those accepted cases. An additional
64-manifest probe peaked at 659.7 MiB, exposing retained JSON heap pressure.
See API `docs/MAPS_CAPACITY.md` for timings, inputs and reproducible commands.
These Windows measurements do not qualify hosted/container capacity. In
particular, a 512 MiB worker budget is not qualified by the manifest probe.

## Protected backend lifecycle

Both cases passed using temporary creator, member, outsider, independent
moderator and organization-affiliated administrator accounts:

| Case | Update decision | Result |
| --- | --- | --- |
| Personal Map | Rejected | Previous approved release and requirements stayed available |
| Organization Map | Approved | New release became latest; both approved versions stayed downloadable |

Each exercised draft creation/editing, private R2 upload, metadata sync, sealing,
an actual Convex-to-API validation request, stored report reconciliation,
submission, moderator corrections, resubmission, independent approval and public
CDN promotion. Downloads matched the upload bytes and hash; repeat downloads
counted once. Unpublishing demoted delivery and returned HTTP 404 from the Next
download route. Pending metadata did not replace the approved release snapshot.

Outsiders could not read private drafts, edit or reserve uploads. Organization
members could edit but could not delete the listing or take personal ownership.
An affiliated site administrator could not approve the organization's listing or
its update. Public attribution used the organization identity.

## Signed-in browser acceptance and fix

The final browser run passed at 18:33–18:35 UTC in headless Microsoft Edge. It
used a real short-lived Better Auth session through the normal session/Convex
authentication paths. Password entry, signup and verification emails were not
tested; no invitation/verification messages were sent.

- Uploaded the actual packed fixture through the Maps release form and entered
  player counts, gameplay and both pack identities/credits.
- Selected a catalog version, saved the release, and obtained valid external
  validation with saved requirements and a separate structural-check summary.
- Submitted through the creator preview, approved in an independent moderator
  browser session, viewed the public Map requirements, and downloaded exact bytes.

The first browser attempt exposed an existing shared upload race: the library's
client metadata-sync mutation schedules external work but returns immediately.
The form could report upload completion before metadata was available to release
creation. `artifactDelivery.completeUpload` now authorizes the caller's pending
reservation, awaits actual R2 metadata persistence and checks stored size before
the uploader calls its completion callback. Expired, consumed or foreign
reservations are refused. Three regressions cover Maps, addons and resource
packs; the public API inventory includes this narrow action.

The first rerun successfully created/validated the release but stopped on a
test locator expecting a bare pack name where the UI renders name/type/version.
Correcting that locator required no product change. The final browser run reused
the two successful backend cases from the earlier attempts; they were not
counted as newly repeated browser results.

## Cleanup and remaining gates

All temporary listings, releases, reservations, Map categories, memberships,
organizations, users and sessions were removed; moderation audit history remains.
Follow-up checks restored the ten-user baseline and found zero R2 objects or
component metadata across all five test project namespaces, including failed
browser attempts. Original development validator URL/key state and Maps switch
state were restored and verified. The temporary validator, tunnel, Hub and browser
processes stopped; private restore/configuration files were removed.

The current Convex backend code remains deployed to development. Maps publishing
is default-off again; the shared production API and production Hub were not
deployed. All repository work remains uncommitted on `main`.

Game-exported packed-world coverage, actual worker/container capacity (including
the metadata heap issue), and clean-client Minecraft import/play remain open.
Production rollout requires separate authorization. Local raw reports/runners
are under ignored `test-results/maps-acceptance/`; large synthetic inputs and
owned temporary snapshots were removed after measurement.
