# Documentation

Use maintained contracts and operator guides for current behavior. Product work
lives in [TODO.md](../TODO.md); regression checks live in [TESTING.md](../TESTING.md).

## Contracts and operations

| Guide | Scope |
| --- | --- |
| [Server flow](../SERVER_FLOW.md) | Ownership verification, publication, moderation and status visibility |
| [Add-on/resource-pack flow](../PROJECT_FLOW.md) | Artifact validation, release review and publication |
| [Permissions](./PERMISSIONS.md) | User, organization and administrator access |
| [Storage](./STORAGE.md) | Private uploads, CDN promotion and object cleanup |
| [Listing identities](./LISTING_ROUTE_IDS.md) | Stable URLs and compatibility redirects |
| [Analytics and downloads](./ANALYTICS_AND_DOWNLOADS.md) | Convex totals, OpenPanel configuration and event meaning |
| [Follows and server intelligence](./FOLLOWS_AND_SERVER_INTELLIGENCE.md) | Follows, library, collections, notifications, release dependencies, incidents and health scores |
| [Schema maintenance](./SCHEMA_MAINTENANCE.md) | Unused fields, data audits and staged retirement |
| [Plugin workflow catalog](./PLUGIN_WORKFLOW_CATALOG.md) | Official repository, automatic refresh and installed revision tracking |
| [Discord announcements](./DISCORD_ANNOUNCEMENTS.md) | First-publication events, secret configuration and delivery retries |
| [Content Security Policy](./CSP.md) | Browser origins and nonce policy |
| [API README](https://github.com/BedrockNexus/api#readme) | Public API, validator worker and API deployment |

## Planning and historical evidence

- [Content roadmap](./CONTENT_TYPES_ROADMAP.md): remaining product improvements.
- [Custom plugin workflow proposal](./PLUGIN_CUSTOM_WORKFLOWS.md): approval and
  artifact tracking for creators connecting an existing build pipeline.
- [Search authority plan](./SEO_AUTHORITY_PLAN.md): discovery and outreach planning.
- [November 2026 dependency update](./DEPENDENCY_UPDATE_2026-11.md): compatibility
  decisions, remaining audit findings and rollout guidance.
- [Development content acceptance](./DEV_CONTENT_ACCEPTANCE.md) and
  [development add-on acceptance](./DEV_ADDON_ACCEPTANCE.md): dated evidence with
  explicit limits; they are not current deployment checklists.
- Workspace `docs/handoffs/` and `docs/roadmap/`: historical records outside this
  repository. Their old task states do not supersede the current TODO.

Keep internal `projects` names when describing tables or functions. Use add-ons,
resource packs and plugins for public product sections. Internal table renames
are separate migrations, not documentation cleanup.
