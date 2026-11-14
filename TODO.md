# TODO

Current work as of 2026-11-06. Keep product priorities here, regression checks in
[TESTING.md](./TESTING.md), and operator commands in
[SCHEMA_MAINTENANCE.md](./docs/SCHEMA_MAINTENANCE.md).

## Admin navigation and review layout

- [x] Move Awaiting review to its own page, linked from the admin overview and
  sidebar.
- [x] Move review work and the server, addon, resource pack and plugin tables to
  a separate `/moderation` dashboard, open to the new `moderator` role as well
  as admins. Admins grant the role from Users.
- [x] Separate Addons and Resource Packs into their own admin catalog pages.
- [x] Redesign individual submission reviews using the creator editor's sidebar
  shell. Keep submitted content read-only, with sections for overview, submitted
  changes, description, gallery, versions/files, links/licence, and history.
  Keep reviewer assignment, submission revision and decisions accessible while
  moving between sections. Include server-specific information and plugin build
  information where relevant. Preserve direct links to individual versions.

## Cleanup

- [ ] Backfill server address keys and inspect conflicts. On 2026-11-01, three
  of four production servers had no `addressKey`; dev was complete. Use
  `functions/servers/migrations:backfillAddressKeys` and check its result.
- [ ] Decide whether to correct historical false offline checks. Use a confirmed
  NetherNet-fix deployment timestamp and review the dry-run report first; a real
  outage ending at that time can also match. This is not a routine backfill.

## Analytics

- [ ] Use [Bklit UI](https://bklit.com/docs/installation) components for website
  analytics charts. OpenPanel supplies behavioral analytics; Convex owns official
  counters. Add the chart components when building the analytics screens.

- [x] Create the shared Amblydia OpenPanel resource in Coolify and configure the
  BedrockNexus browser and server clients. See
  [analytics and downloads](./docs/ANALYTICS_AND_DOWNLOADS.md).
- [ ] Deploy the creator analytics daily counters (built on dev 2026-11-09) to
  production Convex; a push to `main` deploys only the Next.js image.
- [ ] Verify live public browsing, search and download events after activation.
  Official download totals, deduplication and rate limits remain in Convex.
- [ ] Design creator-facing analytics and publication/signup funnels separately;
  the current integration covers public discovery and download events.

## Product follow-up

- [ ] Review the remaining creator and player improvements in
  [the content roadmap](./docs/CONTENT_TYPES_ROADMAP.md).
- [ ] Complete authenticated desktop/mobile acceptance and representative
  Minecraft import/play testing before claiming full publishing acceptance.
- [ ] Give the BedrockNexus GitHub App the **Pull requests: Read and write**
  repository permission (GitHub → Settings → Developer settings → GitHub Apps
  → Permissions). Installing the publishing workflow on a protected default
  branch opens a pull request from `bedrocknexus/publishing-workflow` instead
  of committing. Each installation must accept the new permission; until then
  those creators see "Accept the app's updated permissions".

## Roadmap Phase 2 — Retention

Decided 2026-11-13; built 2026-11-13 (`convex/functions/social`,
`components/social`). Ranking inputs stay unpurchasable.

- [x] `follows`: users, organizations, add-ons, resource packs, plugins,
  servers and public collections. Counts in `followerCounts`, copied to stats
  documents, plugins, creator listings and collections. "Most followed" sort;
  the `/v1` value `saved` now means the same.
- [x] Trending counts net new follows instead of saves. Library saves are
  private and count toward nothing.
- [x] Library at `/dashboard/library` (add-ons, resource packs, plugins,
  servers). The launcher syncs it later; `/v1` still has no signed-in calls.
- [x] Collections: public, unlisted or private, with notes, at
  `/collections` and `/collections/{c_ref}`, on owner profiles, followable.
- [x] Notifications: fan-out on a project release reaching the CDN, a plugin
  release, and a recent first publication; one per person per event. Bell in
  site and dashboard headers, `/dashboard/notifications`, 90-day retention.
- [x] Preferences per kind and an opt-in daily/weekly Resend digest with
  RFC 8058 one-click unsubscribe (`/api/notifications/unsubscribe`).
- [x] Private Minecraft version on the profile: marks matching releases and
  comes first in the version filter.
- [ ] Deploy: Convex functions and schema (new tables and indexes; the old
  `favouriteCount` sort indexes are dropped), then the Next.js image.
- [ ] Backfill `followerCount` is not needed (no follows exist yet). Watch the
  first digest run's Resend logs.

## Roadmap Phase 3 — Publishing infrastructure

Built 2026-11-13 (`convex/lib/releaseDependencies.ts`, `lib/orgAudit.ts`,
`lib/downloadEvents.ts`; api validator and `/v1`).

- [x] Structured release dependencies (required / works with / incompatible):
  publisher-declared listings or external links, plus pack-manifest UUID
  dependencies resolved to the listing that first published the UUID. Shown
  on release pages, editable from the dashboard release list, in `/v1/updates`.
- [x] Detected minimum game version (`minEngineVersion`, from manifests) next
  to the creator's declared versions; a breaking-changes flag per release.
  No separate maximum: the declared version list already says it.
- [x] Trust indicators: automatic checks, moderator review and SHA-256 on
  release pages; "Owner verified" on server pages.
- [x] Organization audit history at `/dashboard/organizations/{slug}/history`
  (listing and membership changes; member triggers fire only in a real
  deployment, not in convex-test).
- [x] Append-only `downloadEvents` (counted and repeat redirects), purged after
  400 days.
- [x] Owners of listings whose current release depends on a project hear when
  it ships a breaking release (`dependency_breaking`).
- [x] `/v1/packs/lookup` maps installed pack UUIDs to listings for the launcher;
  `stats.followers` added (`favourites` kept as its older name).
- [ ] Deploy order: hub Convex first (new tables, `lookupPacks`), then the api
  image (validator reports `packs`; older hubs ignore the new fields).
- [ ] Existing releases have no `releasePacks` until revalidated. Decide
  whether to re-run validation for public releases so pack lookup covers them.

## Roadmap Phase 5 — Server intelligence

Built 2026-11-13 (`convex/lib/serverEvents.ts`, `lib/serverHealth.ts`,
`functions/servers/intelligence.ts`, `functions/servers/networks.ts`).

- [x] `serverEvents` from pings: offline after 3 failed checks in a row (dated
  from the first), back online with duration, version change, player record
  (one per day; the first check is a baseline).
- [x] Owner alerts as `server_offline` / `server_online` notifications, at most
  one per hour per kind, plus instant email (on by default, off in settings or
  from the email).
- [x] Hourly rollups (35 days); status history on the server page: uptime
  24 h / 7 d / 30 d, players chart, uptime strip, event timeline.
- [x] Health score 0-100 (uptime 70, stability 20, latency 10), daily
  snapshots and `serverStats.healthScore`; none until 3 days / 100 checks.
- [x] Server networks: `/dashboard/networks`, `/networks/{n_ref}`, "Part of"
  link on server pages; same-owner rule.
- [ ] Deploy, then watch the first incidents: if NetherNet false offlines
  return, raise `OFFLINE_AFTER_FAILURES` before owners get noisy alerts.
- [ ] Not yet: health score as a listing sort or `/v1` field, networks and
  collections in the sitemap.

## Deferred

- Blog publishing, schema, RSS and public posts.
- Mods remain paused. Do not restore the old mixed backup over the active code.
