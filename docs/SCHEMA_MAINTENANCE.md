# Schema maintenance

The 2026-11-01 cleanup checked readers, writers, indexes and stored data on both
Jean's dev deployment and production. Empty definitions were narrowed first;
populated legacy data was migrated before its definitions were removed.

## Removed definitions

Nineteen obsolete application fields are removed:

| Table | Removed fields |
| --- | --- |
| `userProfiles` | `pronouns`, `isVerified`, `verifiedAt`, `isCreator`, `badges`, `showEmail`, `showOnlineStatus`, `followerCount`, `followingCount`, `projectCount`, `serverCount` |
| `projects` | `isFeatured`, `scheduledFor` |
| `projectVersions` | `versionNumeric` |
| `serverSoftware` | `pluginFileExtension` |
| `serverReviews` | `ownerReply` |
| `servers` | `isFeatured` |
| `serverStatus` | `softwareClassification`, `softwareReasons` |

The retired `analyticsEvents` table definition and its indexes are also removed.
Other removed indexes are `userProfiles.by_verified`, `userProfiles.by_creator`,
`projects.by_featured`, and `servers.by_featured`.

Publishing workflows determine software plugin support. Real profile counts
come from active listing/statistics data, editorial choices come from `picks`,
and new optional analytics go to OpenPanel.

## Completed data retirement

| Data removed before narrowing | Dev | Production |
| --- | --- | --- |
| Retired local analytics events | 19 | 74 |
| Status rows containing software guesses | 1 | 4 |
| Old server featured flags | 4 | 0 |

After the migration, all affected-field/event counts were zero in both
deployments. The comparison against the pre-cleanup snapshots verified stable
content across 15 application tables, official download/server counters, and
server-status identities and uptime counters. Live pings and derived directory
visibility continue updating normally during these comparisons.

The full snapshots include authentication and counter components and are kept
privately in ignored `test-results/schema-cleanup-2026-11-01/backups/`. They are
not source artifacts and must not be committed.

Temporary audit/cleanup functions and their migration tests are preserved in
[transition commit 9a9dbbe](https://github.com/BedrockNexus/hub/commit/9a9dbbe5e5b12f635d433fd1922db04dba5d9b8f).
They and the completed `purgeAnalyticsEvents`, `clearSoftwareClassification`,
and `clearPluginFileTypes` migrations are removed from active code.

## Future schema retirement

1. Check all readers, writers, indexes, public projections and installed
   components. A missing UI control does not establish that data is unused.
2. Inspect each intended deployment with bounded, read-only queries that return
   counts. Paginate if a scan is capped; do not infer completion from one sample.
3. Export the target deployment, including component data, before destructive
   cleanup. Record content/counter preservation checks appropriate to the change.
4. Keep compatible validators while temporary internal migrations clear or
   transform old values. Preview first where supported, then verify all batches.
5. Require zero old values before narrowing validators. Remove completed
   migration functions, temporary tests and stale instructions afterward, while
   retaining their source in Git history.
6. Run typechecks, tests and a deployment preview; deploy dev and production,
   then verify the live flow and preservation checks.

Restored backups or other developers' deployments may still contain retired
fields. Use a compatible transition schema and the historical migration source
before deploying the final stricter schema to those environments.

## Definitions deliberately kept

- `pluginDownloads`: 50 historical production rows and no dev rows at the audit.
  New official counts use sharded counters, but deletion cleanup still references
  this history. Its retention was preserved by this cleanup.
- Official download counters, owner counters, review totals, status history,
  daily statistics, creator listings and publication/moderation fields remain.
- Review `helpfulCount` and project `authorReply` remain in current public
  projections. Removing public response fields needs its own contract decision.
- The `texture_pack` discriminator remains for historical compatibility across
  projects, categories and uploads; it is not a dormant product feature.
- Better Auth and installed Convex component schemas are owned by their
  components and are outside this application-schema cleanup.

## Other maintenance, not a standing deployment checklist

On the audit date, production had address keys for one of four servers; dev had
all four. `functions/servers/migrations:backfillAddressKeys` is still relevant.
It normalizes addresses, leaves conflicts for an administrator, and reports them.

Other existing backfills are repair/import tools rather than commands to run
on every release:

| Function | Use when |
| --- | --- |
| `site/migrations:backfillActivity` | Older public records lack activity entries |
| `site/migrations:backfillDiscovery` | Imported listings lack search/discovery fields |
| `site/migrations:backfillCreatorListings` | Public owners lack their derived creator listing |
| `site/migrations:backfillInlinePictures` | Auth avatars or organization logos still use data URLs |
| `servers/migrations:seedDefaultServerSoftware` | A deployment lacks the default software catalog |
| `servers/migrations:rebuildServerDailyStats` | Daily summaries need rebuilding from retained history |
| `projects/artifactValidation:backfillChecksums` | Older validated releases lack recorded checksums |
| `projects/migrations:migrateTexturePacks` | Historical stored type values need normalization |

These abbreviated module paths live below `functions/`. Inspect the target
deployment and preserve existing data before running a repair. An old TODO
checkbox is not a migration ledger.

`servers/migrations:forgiveFalseOfflineChecks` is a separate historical correction.
Its preview needs the confirmed fix deployment timestamp, and a real outage
ending at that moment can match. Do not infer a timestamp from a commit date or
apply it as routine schema cleanup.
