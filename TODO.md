# TODO

## Active Priorities (Updated July 18, 2026)

Keep this list limited to active product and engineering work. Completed work
lives in Git history; automated checks and manual QA live in `TESTING.md`.

## P0 - Project Foundation And Launch Polish

- [x] Remove the `model` project type from Hub and API definitions, schema
  validators, seeded categories, artifact validation, forms, filters,
  moderation, SEO, and analytics.
- [ ] Confirm production contains no `model` projects or artifact uploads before
  deploying the four-type schema.
- [x] Repair the Markdown editor styling so MDXEditor matches the website's
  shadcn theme. Fix broken toolbar, dialog, table, checkbox, focus, dark-mode,
  and responsive CSS without changing Markdown as the stored format.

- [ ] Run `functions/projects/migrations:migrateTexturePacks` in production,
  verify its counts, then remove the temporary `texture_pack` schema value and
  compatibility normalization.
- [ ] Run `functions/projects/migrations:seedDefaultProjectCategories` after
  deployment and review the generated type-specific category lists in admin.

## P1 - Type-Specific Project Experience

- [x] Make project creation, editing, categories, filters, cards, releases,
  moderation, SEO, and analytics use the centralized four-type model and show
  type-specific upload requirements and errors.
- [x] Add type-specific project metadata with shared validators and consistent
  creator, moderation, public detail, filter, and SEO support:
  - Addons: behavior pack included, resource pack included, experimental
    features required, and a small structured dependency list.
  - Maps: game mode, multiplayer support, and optional estimated playtime.
    Display file size from the release and derive unpacked world size from the
    validator report instead of asking creators to enter it.
  - Resource packs: resolution and multi-select content areas such as textures,
    UI, sounds, and shaders. Keep supported Minecraft versions on releases and
    do not add an edition field because Hub is Bedrock-only.
  - Skins: Classic/Steve or Slim/Alex model and character category. Keep the
    MVP limited to a single PNG; only add skin-pack metadata after defining and
    validating a supported pack artifact format.
- [x] Replace the separate public Versions and Changelog tabs with a Releases
  tab that presents complete release entries. Add a canonical public page at
  `/projects/[slug]/releases/[version]` for every release with compatibility,
  publication date, file metadata, download count, Markdown changelog, and the
  tracked download action; redirect the old tab URLs to Releases.
- [ ] Add a skin release experience with PNG preview, explicit Classic/Steve
  and Slim/Alex selection, a public interactive player renderer, and download
  support through the existing tracked route.
- [ ] Prepare the private mixed R2 bucket for a future media Worker: only the
  `media/` namespace may be exposed through a CDN, while `artifacts/` and
  `temporary/` must continue using controlled or signed access.

## P2 - Nice Later

- [ ] Migrate remaining Lucide icons to Hugeicons using the
  [Hugeicons migration tool](https://hugeicons.com/docs/migration-tool).

## Explicitly Deferred

- [ ] Blog publishing, schema, RSS, and public post routes remain deferred.
