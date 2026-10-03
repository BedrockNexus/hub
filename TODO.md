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

## P1 - Public Catalog API

- [ ] Expand the API service into a versioned, read-only public catalog API for
  launchers, bots, websites, and community integrations:
  - Add `/v1` endpoints for searching and retrieving published servers,
    projects, project releases, categories, project types, and supported game
    versions by stable ID or slug.
  - Return only the same public, published data exposed by Hub. Keep drafts,
    moderation data, private R2 upload keys, ownership proofs, admin data, and
    write operations out of the public API.
  - Keep downloads routed through Hub's tracked download endpoint instead of
    exposing storage URLs that bypass analytics and release availability rules.
  - Define consistent pagination, filtering, sorting, field names, timestamps,
    error responses, and cache headers before publishing the API contract.
  - Publish an OpenAPI specification and human-readable API documentation with
    request and response examples.
  - Add public API rate limits, CORS, request validation, observability, and
    contract tests without weakening the existing internal API-key boundaries.

## Explicitly Deferred

- [ ] Blog publishing, schema, RSS, and public post routes remain deferred.
- [ ] Analytics. Hub's own tracking and dashboards were removed; hub and
  plugins will both use the central Amblydia analytics platform once it exists.
- [ ] After `functions/site/migrations:purgeAnalyticsEvents` has emptied the
  retired `analyticsEvents` table in every deployment, delete its definition
  from `convex/schemas/site.ts`.
