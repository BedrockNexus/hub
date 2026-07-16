# Testing

This file is the canonical checklist for launch verification, automated tests, and manual QA. Product work belongs in `TODO.md`.

## Automated Launch Checks

- [x] Run `bun run lint`.
- [x] Run `bun run lint:framework` (passes with existing React Compiler/TanStack Table and image warnings only).
- [x] Run `bun run typecheck`.
- [ ] Run `bun run build:dev`.
- [ ] Run `bun run test:e2e`.
- [ ] Treat agent sandbox ACL failures as environment-only only after the same command passes in Git Bash or a normal local terminal.
- [ ] Add seeded Playwright fixtures and storage-state generation for authenticated creator and admin flows.
- [ ] Inspect build route output and client chunks; confirm home, listings, detail pages, auth pages, and public layouts do not pull dashboard/editor-only code.
- [ ] Measure Core Web Vitals or Lighthouse on mobile and desktop for home, server listing, project listing, server detail, project detail, auth pages, dashboard, and admin.
- [ ] Confirm sitemap output includes home, server/project listings, published servers, published projects, and public user profiles with published content.
- [ ] Confirm robots and page metadata keep dashboard, admin, auth, maintenance, deferred blog, and not-found pages out of search results.
- [ ] Confirm Privacy and Terms pages load from every footer link, expose canonical metadata, and appear in the sitemap.

## Public

- [ ] Home, server listing, and project listing load on desktop and mobile widths.
- [ ] Published server detail shows overview, gallery, reviews, copy IP, status, and SEO metadata.
- [ ] Published project detail shows overview, gallery, versions, changelog, reviews, and download buttons.
- [ ] Blog remains a deferred placeholder with no publishing or editing surface.
- [ ] User profiles show public bio, role badge, published servers, and published projects.
- [ ] Public listings have no broken filtering, sorting, pagination, empty, or error states.

## Lifecycle And Moderation

- [ ] Generate a server verification code, add the exact token as a DNS TXT record, and confirm DNS verification succeeds for the matching hostname.
- [ ] Generate a server verification code, add the exact token to either Bedrock MOTD line, and confirm MOTD verification succeeds only for the matching online host and port.
- [ ] Confirm DNS verification fails for a missing or incorrect TXT record, and MOTD verification fails for an offline server, mismatched port, or missing token.
- [ ] Confirm MOTD verification rejects Geyser responses with default or explicit Geyser branding.
- [ ] Confirm customized Geyser networks are classified using Java status/SRV, MOTD, player-count, capacity, and proxy-software correlation; ambiguous dual-edition hosts must not pass automatic verification.
- [ ] Confirm creation succeeds only for the same authenticated user, IP address, port, and selected verification method before the proof expires.
- [ ] Confirm an unverified, mismatched, reused, or expired server verification proof cannot create a server.
- [ ] Create and edit a verified server draft, publish it as the owner, move it back to draft, and publish it again.
- [ ] Confirm an owner-published server remains public with `pending` moderation, appears in the admin review queue, and can be explicitly approved without changing its public URL.
- [ ] Move a published server to `under_review` as an admin; confirm the owner cannot change its visibility, then approve or reject it.
- [ ] Create and edit a project draft, submit it for review, publish it as an admin, then move it back to review.
- [ ] Confirm public listings and detail routes only expose `published` content.
- [ ] Confirm rejected and under-review content remains private.
- [ ] Confirm creator dashboard detail queries return unpublished content only to the owner, organization members, or an admin.
- [ ] Flag or reject a server and project with a required reason; confirm the creator sees the note and the moderator and timestamp are stored.
- [ ] Confirm admin moderation actions enforce permission-denied states for non-admin users.

## R2 And Downloads

- [ ] Upload, replace, and remove the site logo from admin settings; confirm navbar, footer, dashboard, admin, and metadata use the new R2 image.
- [ ] Upload, replace, and remove the Open Graph image and favicon; confirm metadata resolves their R2 URLs and the previous objects are deleted.
- [ ] Confirm site-logo uploads reject unsupported image types and files larger than 5MB.
- [ ] Confirm replacing or removing a site logo deletes the previous R2 object and stale unsaved uploads are cleaned up.
- [ ] Upload, replace, and remove a project icon.
- [ ] Upload, replace, and remove a server logo and banner.
- [ ] Upload, reorder, caption, and delete server gallery images.
- [ ] Upload, reorder, caption, and delete project gallery images.
- [ ] Confirm server and project galleries reject a thirteenth image.
- [ ] Confirm unsupported image types and images larger than 8MB show inline errors.
- [ ] Confirm gallery captions stop at 160 characters.
- [ ] Confirm reorder rejects duplicate, missing, or cross-entity gallery IDs.
- [ ] Confirm deleting an image compacts the remaining sort order without gaps.
- [ ] Upload and remove editor media.
- [ ] Upload and delete a project version file.
- [ ] Download a project version through the app route and confirm version and aggregate project counts increment.
- [ ] Confirm each version download requests a fresh signed URL and shows a preparing state.
- [ ] Confirm a missing R2 version file shows retry-friendly unavailable copy without incrementing download counts.
- [ ] Confirm deleted, unpublished, malformed, and temporarily failed version downloads return the correct error state instead of navigating to a dead page.
- [ ] Confirm retrying a temporary download failure generates a new signed URL and starts the download.
- [ ] Confirm aggregate download statistics remain correct after version deletion.
- [ ] Confirm replaced, deleted, and stale unattached objects are removed from R2.
- [ ] Confirm all R2 object keys follow the documented user/entity paths.

## Editor And Content

- [ ] Test MDXEditor rich-text and source modes for server descriptions, project descriptions, and version changelogs.
- [ ] Test headings, lists, links, tables, code blocks, and Markdown shortcuts.
- [ ] Test R2-backed image uploads and public Markdown image rendering.
- [ ] Test YouTube video, Short, live, and embed URLs in rich-text and source modes; confirm invalid URLs are rejected and public embeds remain responsive.

## Creator Dashboard

- [ ] Server creation validates core fields, generates verification codes, disables actions while requests run, and warns about unsaved changes.
- [ ] Server edit pages save general, connection, description, categories, links, branding, and gallery changes.
- [ ] Project creation warns about unsaved changes and creates a draft.
- [ ] Project edit pages save general, description, categories, links, license, gallery, and version changes.
- [ ] Version lists render newest-first and download buttons handle expired signed URLs clearly.

## Account And Organizations

- [ ] Test login, registration, email verification, password reset, profile visibility, account settings, providers, and sessions.
- [ ] Test organization switcher, settings, members, invitations, and organization-owned content.
- [ ] Test owner, admin, member, and unauthenticated permission states.

## Admin

- [ ] Admin overview, users, organizations, categories, game versions, settings, servers, and projects show loading, empty, error, and permission-denied states.
- [ ] Open draft, under-review, and published server/project submissions from their admin review pages and inspect descriptions, media, ownership, and version files.
- [ ] Confirm approve, flag, reject, and unpublish actions require confirmation and show useful success/error feedback.
- [ ] Confirm promote, demote, ban, and unban account actions require confirmation and cannot be used against the current admin where prohibited.
- [ ] Confirm the admin overview queue counts match the server, project, user, and organization tables.
- [ ] Admin pages remain usable on mobile and desktop.

## Accessibility And Layout

- [ ] Keyboard focus remains visible through navigation, forms, tabs, dialogs, editor controls, and upload controls.
- [ ] Dialogs trap focus and close with Escape where expected.
- [ ] Empty and error states have readable copy and stable layouts.
- [ ] Mobile layouts have no horizontal overflow, clipped text, or overlapping controls.

## Abuse Protection

- [ ] Confirm normal server verification, gallery upload, review, favourite, analytics, status-refresh, and download bursts remain usable.
- [ ] Confirm repeated requests beyond each configured limit return a `RATE_LIMITED` Convex error with a retry delay.
- [ ] Confirm limits are isolated by authenticated user where applicable and anonymous analytics/download limits are isolated by public target.
- [ ] Confirm cron status checks, stale-upload cleanup, and other internal jobs are not rate limited.
