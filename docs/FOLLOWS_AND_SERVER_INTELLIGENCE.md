# Follows, notifications and server intelligence

Roadmap Phases 2, 3 and 5 (built 2026-11-13). Product decisions are in
[TODO.md](../TODO.md).

## Follows, library and collections

| What | Where | Visible to |
| --- | --- | --- |
| Follow (users, organizations, listings, collections) | `functions/social/follows.ts`, `lib/follows.ts` | Count public; who follows whom is never shown |
| Library (saved listings) | `functions/social/library.ts` (`favourites` table) | Only the owner |
| Collections | `functions/social/collections.ts` | Public, unlisted (link only) or private |

`followerCounts` is the source of truth. Copies on `projectStats`,
`serverStats`, `plugins`, `creatorListings` and `collections` exist only so
listings can sort in index order. Trending counts net new follows per day
(`projectDailyStats.follows`); library saves count toward nothing.

## Notifications

`lib/notifications.ts` raises each event once by key
(`notificationEvents`), then `functions/social/notifications.ts fanOut`
delivers one row per person, skipping kinds they switched off. Events:

| Kind | Raised by | Audience |
| --- | --- | --- |
| `release` | project release reaches the CDN; plugin release published | followers of the listing and its owner |
| `listing` | first publication within 14 days of `publishedAt` | followers of the owner |
| `dependency_breaking` | a release flagged as breaking goes public | owners of listings whose current release depends on it |
| `server_offline` / `server_online` | `lib/serverEvents.ts` | the server's owner, or an organization's owners and admins |

Digests (`functions/social/digest.ts`) are opt-in, daily or weekly at 15:00
UTC, and carry RFC 8058 one-click unsubscribe. Server alerts are also emailed
right away unless the owner turned that off. Rows are kept 90 days.

## Releases (Phase 3)

The validator reports each manifest's header UUID, version, kind and
`min_engine_version`, and the pack UUIDs the manifests depend on. Hub stores
them in `releasePacks` and `releaseDependencies` (`lib/releaseDependencies.ts`).
A pack UUID belongs to the listing that published it first. Publishers can
also declare dependencies and a breaking-changes flag. Every accepted download
redirect is logged in `downloadEvents` (400 days).

## Server intelligence (Phase 5)

Each status check updates the hourly rollup and runs incident detection. An
incident opens after `OFFLINE_AFTER_FAILURES` (3) failed checks in a row and
closes on the next success. The daily `recompute-server-health` cron writes
`serverHealthSnapshots` and `serverStats.healthScore` from the formula in
`lib/serverHealth.ts`, which must never read payment or featured status.
