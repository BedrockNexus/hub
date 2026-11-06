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

- [ ] Create the shared Amblydia OpenPanel resource in Coolify and configure the
  BedrockNexus browser and server clients. See
  [analytics and downloads](./docs/ANALYTICS_AND_DOWNLOADS.md).
- [ ] Verify live public browsing, search and download events after activation.
  Official download totals, deduplication and rate limits remain in Convex.
- [ ] Design creator-facing analytics and publication/signup funnels separately;
  the current integration covers public discovery and download events.

## Product follow-up

- [ ] Review the remaining creator and player improvements in
  [the content roadmap](./docs/CONTENT_TYPES_ROADMAP.md).
- [ ] Complete authenticated desktop/mobile acceptance and representative
  Minecraft import/play testing before claiming full publishing acceptance.

## Deferred

- Blog publishing, schema, RSS and public posts.
- Mods remain paused. Do not restore the old mixed backup over the active code.
