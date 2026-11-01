# TODO

Current work as of 2026-11-01. Keep product priorities here, regression checks in
[TESTING.md](./TESTING.md), and operator commands in
[SCHEMA_MAINTENANCE.md](./docs/SCHEMA_MAINTENANCE.md).

## Cleanup

- [ ] Backfill server address keys and inspect conflicts. On 2026-11-01, three
  of four production servers had no `addressKey`; dev was complete. Use
  `functions/servers/migrations:backfillAddressKeys` and check its result.
- [ ] Decide whether to correct historical false offline checks. Use a confirmed
  NetherNet-fix deployment timestamp and review the dry-run report first; a real
  outage ending at that time can also match. This is not a routine backfill.

## Analytics

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
