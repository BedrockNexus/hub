# TODO

Current work as of 2026-11-01. Keep product priorities here, regression checks in
[TESTING.md](./TESTING.md), and operator commands in
[SCHEMA_MAINTENANCE.md](./docs/SCHEMA_MAINTENANCE.md).

## Cleanup

- [ ] Validate and deploy the local schema cleanup: 16 empty, unused fields and
  four unused indexes removed. The audit and deployment stages are documented
  in [schema maintenance](./docs/SCHEMA_MAINTENANCE.md).
- [ ] Retire populated legacy data before removing its validators: old local
  analytics events, retired server software guesses, and server featured flags.
  Inspect the count-only report, apply the intended cleanup, verify every page,
  then remove the remaining schema definitions. Do not reset official counters.
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

The catalog API, stable listing references, section download URLs, optional
OpenPanel integration, public response privacy fixes and current server status
changes shipped on 2026-11-01. Completed rollout steps belong in Git history,
not in a permanent deploy checklist. Older one-off backfills are maintenance
options; their execution is not inferred from old TODO notes.
