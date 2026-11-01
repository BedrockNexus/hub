# Add-on and resource-pack roadmap

The active downloadable catalogs are add-ons and resource packs. Plugin
publishing uses its own GitHub build/review workflow. Mods remain paused.

## Shipped foundation

- Separate catalogs, create forms, dashboards and organization lists.
- Stable listing references and compatibility redirects for old links.
- Private uploads, bounded artifact validation, moderator review and CDN promotion.
- Draft preview, submission checks, moderator corrections and resubmission.
- Release history, licensing, credits, galleries and public reviews.
- A versioned launcher API with update queries, checksums when available and
  canonical download URLs.
- Official download counts in Convex and optional OpenPanel events.

Current contracts are described in [publishing flow](../PROJECT_FLOW.md),
[storage](./STORAGE.md), [route identities](./LISTING_ROUTE_IDS.md),
[permissions](./PERMISSIONS.md), and [analytics/downloads](./ANALYTICS_AND_DOWNLOADS.md).
[TODO.md](../TODO.md) owns active tasks and operational follow-up.

## Remaining improvements

1. Refine release-specific compatibility, dependencies, experiments, rendering
   requirements and installation instructions. Keep creator claims, structural
   validation and verified Minecraft behavior distinct.
2. Improve player decisions using useful filters, clear requirements, previews
   and release comparisons. Bundled packs should not require duplicate listings.
3. Review metadata-edit moderation, change previews, reports and review history
   without making publishing errors harder for creators to resolve.
4. Activate OpenPanel and design creator analytics, follows and release
   notifications as separate features. Ranking inputs must never be purchasable.
5. Complete individual/organization publishing acceptance on desktop and mobile,
   and test representative artifacts in Minecraft. Backend tests do not establish
   import success, compatibility or gameplay quality.

The dated development reports in this directory are historical evidence, not
current deployment instructions. They retain the exact scope and limits of each
acceptance run. Do not treat their earlier deployment blockers as current tasks.
