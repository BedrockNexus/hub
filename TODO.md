# TODO

## Active Priorities (Updated July 18, 2026)

Keep this list limited to active product and engineering work. Completed work
lives in Git history; automated checks and manual QA live in `TESTING.md`.

## P0 - Project Artifacts And Storage

- [ ] Run `functions/projects/migrations:migrateTexturePacks` in production,
  verify its counts, then remove the temporary `texture_pack` schema value and
  compatibility normalization.
- [ ] Run `functions/projects/migrations:seedDefaultProjectCategories` after
  deployment and review the generated type-specific category lists in admin.

## P1 - Type-Specific Project Experience

- [ ] Make project creation, editing, categories, filters, cards, releases,
  moderation, SEO, and analytics use the centralized five-type model and show
  type-specific upload requirements and errors.
- [ ] Add a skin release experience with PNG preview, explicit Classic/Steve
  and Slim/Alex selection, a public interactive player renderer, and download
  support through the existing tracked route.
- [ ] Add a model release experience that parses and displays safe `.bbmodel`
  metadata such as format version, model format, elements, bones, and textures;
  use creator gallery images for previews until a stable rendering pipeline is
  selected.
- [ ] Prepare the private mixed R2 bucket for a future media Worker: only the
  `media/` namespace may be exposed through a CDN, while `artifacts/` and
  `temporary/` must continue using controlled or signed access.

## P2 - Nice Later

- [ ] Migrate remaining Lucide icons to Hugeicons using the
  [Hugeicons migration tool](https://hugeicons.com/docs/migration-tool).

## Explicitly Deferred

- [ ] Blog publishing, schema, RSS, and public post routes remain deferred.
- [ ] Interactive `.bbmodel` rendering remains deferred until a maintained,
  sandboxable parser or conversion pipeline is selected; do not hand-roll a
  renderer against Blockbench's evolving internal format.
