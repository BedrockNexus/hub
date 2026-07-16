# TODO

## Launch MVP Priorities (Updated July 16, 2026)

Keep this list small. Add only work that blocks a reliable public launch or materially improves an already-shipped MVP flow.
Testing and launch verification are tracked separately in `TESTING.md`.

## P0 - Must Fix Before Launch

- [x] Diagnose and harden the full server add flow because real users hit errors: auth/session, owner or organization selection, connection fields, DNS and MOTD verification, logo/banner upload, publish, admin post-publication review, public visibility, and live status display.
- [x] Add immediate/persistent server status refresh behavior: schedule a status check when a server is published, make owner refresh persist through Convex, and show `Checking` or `Unknown` when no status record exists yet.
- [x] Audit launch-critical user flow code paths and fix blockers: register, login, email verification, account settings, organization switching, server create/edit/publish, project create/edit/submit, admin moderation, gallery uploads, project version downloads, and public listing/detail pages. Browser and build verification stay in `TESTING.md`.
- [x] Harden the project publish flow: require at least one version file before owner review submission or admin approval, and show creator/admin guidance when a project is not ready.
- [x] Make organization-owned projects manageable: include member-accessible org projects in the dashboard project table and switcher, and add an organization Projects dashboard page.
- [x] Make the website faster for launch: reduce avoidable server fetches, cache safe public data, optimize images, review bundle size, and target good Core Web Vitals on home, listings, detail pages, auth pages, and dashboards.
  - [x] Cache safe public site settings and public home stats at runtime.
  - [x] Reduce public server/project listing query fan-out for stats, categories, and status data.
  - [x] Scope MDX editor CSS to the dashboard and remove unnecessary public navbar image preload.
  - [x] Add responsive image sizing hints for public server/project banners.
  - [x] Move bundle output and Core Web Vitals verification to `TESTING.md` for the next launch build.
- [x] Recheck SEO metadata across the site: titles, descriptions, canonical URLs, Open Graph images, favicon output, sitemap, robots, JSON-LD, and noindex rules for private/dashboard/admin pages.
- [x] Add public Privacy Policy and Terms of Service pages, including essential-cookie and local-storage disclosure, canonical metadata, footer links, and sitemap entries.
- [x] Add app-level rate limiting for content creation, server verification, manual status refreshes, R2 upload and deletion requests, reviews, favourites, analytics events, and project downloads.

## P1 - Important Improvements To Existing Features

- [x] Add a practical backlink and search-authority plan: improve internal linking, add shareable creator/server/project links, prepare community/partner backlink targets, and make public pages worth linking to for Minecraft Bedrock searches. The outreach and measurement plan lives in `docs/SEO_AUTHORITY_PLAN.md`.
- [x] Add a lightweight follow/favourite system for servers and projects: authenticated toggle, saved-items view, and aggregate counts; no notifications or social feed for MVP.
- [x] Add public organization profiles: profile page, organization avatar/banner/about fields, linked servers/projects, owner/member display, and SEO metadata.
- [x] Restore lightweight analytics for creators and admins: views, clicks/copies, downloads, referrers where available, and publish funnel stats.
- [x] Add additional user profile fields: display name, bio, avatar/banner polish, social links, Minecraft username, and public creator stats.
- [x] Diagnose dashboard polish issues that slow users down: sidebar collapsed states, admin empty/error states, form validation copy, loading states, and permission-denied states.
- [x] Normalize project public visibility checks so listings, detail pages, gallery, versions, reviews, downloads, and sitemap all require the same published/approved state.

## P2 - Nice Later, Not Launch Blocking

- [ ] Migrate remaining Lucide icons to Hugeicons using the [Hugeicons migration tool](https://hugeicons.com/docs/migration-tool).

## Explicitly Deferred

- [ ] Blog stays a placeholder for MVP. Do not add blog schema, admin publishing, RSS, or public post routes before launch unless the scope changes.
