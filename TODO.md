# TODO

## Active Priorities (Updated September 29, 2026)

Keep this list limited to active product and engineering work. Completed work
lives in Git history; automated checks and manual QA live in `TESTING.md`.

## Deploy Checklist (October 2026 redesign)

- [ ] After deploying Convex, run
  `npx convex run functions/site/migrations:backfillActivity` once per
  deployment so creator profiles show activity for content that predates
  server-side activity recording (dev: done).
- [ ] Run `npx convex run functions/site/migrations:purgeAnalyticsEvents` once
  analytics data is no longer needed.
- [ ] Deployments seeded before October 2026 hold ten `map` project
  categories, a type that no longer exists. The schema push fails on them
  (`projectCategories ... Value: "map"`). Delete those rows in the Convex
  dashboard first (production and Jean's dev deployment: done).
- [ ] Discovery data (listing fields, search text, server software). After
  deploying Convex, run once per deployment, in this order. **Production has
  not run these yet (checked 2026-10-11) and must before the rebuilt
  `/projects` and `/servers` listings go live: they only show content that
  has these fields.**
  - `npx convex run functions/servers/migrations:seedDefaultServerSoftware`
    adds the default server software list (existing entries are left alone).
  - `npx convex run functions/site/migrations:backfillDiscovery` fills the
    listing fields for servers and projects that already exist. Until it has
    run, existing content is missing from the new indexes.
  - `npx convex run functions/servers/migrations:rebuildServerDailyStats`
    builds daily player totals from the status history recorded so far.
  - `npx convex run functions/site/migrations:backfillCreatorListings` makes
    creators and organizations that already have public content findable by
    name (dev: done).
- [ ] Avatars and organization logos are stored in R2. Deploy Convex and the
  site together, then run
  `npx convex run functions/site/migrations:backfillInlinePictures` once per
  deployment to move the pictures that were saved inline as data URLs (dev:
  one avatar and one logo; production: two avatars). Until it has run, those
  accounts keep their inline picture and show none in creator search.

## P1 - Public Catalog API

- [x] The API service has a versioned, read-only catalog for launchers, bots,
  websites, and community integrations. `/v1` follows the site's sections
  (`/addons`, `/resource-packs`, `/plugins`, `/servers`), with an OpenAPI document
  at `/v1/openapi.json` and documentation in the API's README.
- [ ] Once this is deployed, run these once per deployment (dev: not run):
  - `npx convex run functions/servers/migrations:backfillAddressKeys` lowercases
    every stored server address. Its result lists any address it had to leave
    for an admin.
  - `npx convex run functions/projects/artifactValidation:backfillChecksums`
    adds checksums to releases validated before they were recorded.
  - `npx convex run functions/servers/migrations:clearSoftwareClassification`
    clears the old software guesses. After it has run everywhere, delete
    `softwareClassification` and `softwareReasons` from `serverStatus`.
  - `npx convex run functions/servers/migrations:forgiveFalseOfflineChecks`
    takes back the offline checks wrongly recorded while NetherNet-only servers
    were pinged only over RakNet. Pass `fixedAt` as the epoch milliseconds of the
    ping fix's deploy; it only reports until `apply` is true.

## Explicitly Deferred

- [ ] Blog publishing, schema, RSS, and public post routes remain deferred.
- [ ] Activate shared OpenPanel at `analytics.amblydia.com` after deployment and
  configure its browser/server clients. Public browsing and download events are
  wired; official download totals and deduplication remain in Convex. See
  `docs/ANALYTICS_AND_DOWNLOADS.md`. Creator analytics dashboards remain deferred.
- [ ] After `functions/site/migrations:purgeAnalyticsEvents` has emptied the
  retired `analyticsEvents` table in every deployment, delete its definition
  from `convex/schemas/site.ts`.
