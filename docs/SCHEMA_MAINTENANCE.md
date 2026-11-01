# Schema maintenance

Schema fields are removed only after checking readers, writers, indexes and
stored data. An unused UI control alone does not make a field safe to remove.
Counts below were checked with bounded read-only queries on 2026-11-01 against
Jean's dev deployment and production. No cleanup mutation was run in that audit.

## Empty definitions removed locally

These 16 fields had no active product use or writer and no stored values in either
checked deployment:

| Table | Removed fields |
| --- | --- |
| `userProfiles` | `pronouns`, `isVerified`, `verifiedAt`, `isCreator`, `badges`, `showEmail`, `showOnlineStatus`, `followerCount`, `followingCount`, `projectCount`, `serverCount` |
| `projects` | `isFeatured`, `scheduledFor` |
| `projectVersions` | `versionNumeric` |
| `serverSoftware` | `pluginFileExtension` |
| `serverReviews` | `ownerReply` |

Removed unused indexes: `userProfiles.by_verified`, `userProfiles.by_creator`,
`projects.by_featured`, and `servers.by_featured`. The completed
`clearPluginFileTypes` migration is removed with its empty target field.
`serverSoftware` plugin support is determined by publishing workflows. Actual
profile counters come from active listing/statistics data, and editorial choices
come from `picks`.

Recheck other deployments or restored backups before deploying these stricter
validators. Table names, IDs, ownership, authentication component schemas, active
review fields, official totals and historical/active statistics are unchanged.

## Populated legacy data retained for migration

| Definition | Dev | Production | Retirement path |
| --- | --- | --- | --- |
| `analyticsEvents` | 19 events | 74 events | Purge retired local events, verify empty, then remove the table and purge function |
| `serverStatus.softwareClassification` / `softwareReasons` | 1 affected status row | 4 affected status rows | Clear the retired guesses, verify both absent, then remove the validators and migration |
| `servers.isFeatured` | 4 values | 0 values | Clear the old flags in dev, verify every deployment, then remove the field and public projection |

The schema still accepts these populated legacy definitions. New analytics go
to OpenPanel and editorial choices use `picks`; no active code writes these
legacy fields. A schema push does not erase fields or table data automatically.
The follow-up narrowing must happen after the cleanup has completed.

## Inspect and apply

Run from the Hub repository. Commands below default to dev; append `--prod`
only when production cleanup is intended.

The new audit query returns counts and a continuation cursor, never row contents:

```sh
bunx convex run functions/site/schemaCleanup:auditRetiredData '{"table":"analyticsEvents"}'
bunx convex run functions/site/schemaCleanup:auditRetiredData '{"table":"serverStatus"}'
bunx convex run functions/site/schemaCleanup:auditRetiredData '{"table":"servers"}'
```

If `done` is false, pass the returned `cursor` with the same table and total all
pages. Deploy the cleanup functions before calling them remotely. Take an export
of the intended deployment before applying a destructive retirement.

Server featured flags preview by default. Applying removes only that old field;
it does not delete listings, picks or statistics:

```sh
bunx convex run functions/site/schemaCleanup:clearServerFeaturedFlags '{}'
bunx convex run functions/site/schemaCleanup:clearServerFeaturedFlags '{"apply":true}'
```

Existing internal migrations handle the other two populated definitions:

```sh
bunx convex run functions/servers/migrations:clearSoftwareClassification '{}'
bunx convex run functions/site/migrations:purgeAnalyticsEvents '{}'
```

Those two commands apply immediately; use the audit first. They page/schedule
their work. Wait until scheduled batches finish, rerun the count-only audit over
all pages, and require zero affected records before removing schema definitions.
Keep the migrations available until every intended deployment has been checked.
Do not purge official counters or authentication data as part of this cleanup.

## Definitions deliberately kept

- `pluginDownloads`: 50 historical production rows and no dev rows. New official
  counts use sharded counters, but deletion cleanup still references this history.
  Retention or retirement is a separate decision; do not silently discard it.
- Plugin/project download counters, owner counters, review totals, status
  history, daily statistics, creator listings, publication and moderation fields
  are active data even when a particular page does not show every value.
- Review `helpfulCount` and project `authorReply` remain in current public
  projections. Removing public response fields needs its own contract decision.
- The `texture_pack` discriminator remains for historical compatibility across
  projects, categories and uploads. It is not a dormant product feature.
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
