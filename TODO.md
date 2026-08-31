# TODO

## Active Priorities (Updated July 20, 2026)

Keep this list limited to active product and engineering work. Completed work
lives in Git history; automated checks and manual QA live in `TESTING.md`.

## P1 - Type-Specific Project Experience

- [x] Refine the release experience by project type while keeping one shared,
  validated release backend for every downloadable project:
  - Require every project to have at least one valid release artifact before it
    can be submitted or published.
  - Require creators to enter release versions for add-ons and resource packs,
    along with supported game versions and an optional changelog.
	- Use **Releases** in creator and public interfaces while retaining the
    existing `projectVersions` storage name unless a schema rename becomes
    worthwhile.
  - Remove maps/worlds from active project types until they have a purpose-built
    publishing and update model. Keep only the legacy schema discriminator so
    old rows fail closed instead of blocking deployment.

## P2 - Public Catalog API

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

## P3 - Nice Later

- [x] Migrate remaining Lucide icons to Hugeicons using the
  [Hugeicons migration tool](https://hugeicons.com/docs/migration-tool).

## Explicitly Deferred

- [ ] Blog publishing, schema, RSS, and public post routes remain deferred.
