# Analytics and download URLs

## Responsibilities

OpenPanel is the shared Amblydia browsing/product analytics platform. BedrockNexus
has its own project and credentials within that instance. Convex remains the
authority for listing totals, creator totals, deduplication, and rate limits.
No counter is read back from OpenPanel or updated by a browser event.

The prepared self-hosted stack is in `../infrastructure/openpanel/`:

- Dashboard: `https://analytics.amblydia.com`
- Collector base: `https://analytics.amblydia.com/api`
- Coolify: `https://coolify.bedrocknexus.com` (user-managed deployment)

The domain choice is confirmed. The stack has not been deployed by this change.
Docker/container, authenticated dashboard, and live collection acceptance still
need to run on the host; Docker is unavailable in the current Windows session.

## URL contract

| Consumer | Route |
| --- | --- |
| Website add-on | `/addons/{ref}/download/{version}` |
| Website resource pack | `/resource-packs/{ref}/download/{version}` |
| Website plugin | `/plugins/{ref}/download/{version}` |
| Launcher/API | `https://api.bedrocknexus.com/v1/{section}/{ref}/releases/{version}/download` |

`section` is `addons`, `resource-packs`, or `plugins`. Website links use the
existing stable `a_`, `rp_`, and `p_` identities. Slugs remain accepted. API
content IDs are also accepted directly and remain stable when names change.
API download endpoints additionally accept `latest`. Pin an explicit version
and verify its SHA-256 for reproducible launcher installations.

The old `/api/projects/versions/{id}/download` is compatibility-only: it checks
public visibility and redirects to the canonical website path, preserving
`format=json`. It never counts the compatibility hop. Website content routes
retain `?format=json` for the retryable download buttons. All actual delivery
redirects use 307 and `Cache-Control: no-store`; HEAD returns 405 without
issuing or counting a download. Download links disable Next.js prefetch.

Website wrappers forward the current Better Auth session. API callers are
anonymous. Both call the same secret-protected Convex mutations, which recheck
publication and release availability. API responses, including update results,
contain API download URLs rather than website URLs or final storage URLs.

## Counting and events

Every accepted redirect is rate-limited by requester across releases (60/minute,
burst 20). Official totals count at most one download per requester per release
per fixed daily window. Signed-in website users are identified by account;
anonymous website/API callers use a salted SHA-256 of the trusted client IP.
Hub and API must share the same secret and equivalent proxy settings for the
anonymous identity to match. HEAD and rejected/missing/unpublished files do not
count. Historical totals are preserved; there is no retrospective backfill.

Plugin totals use the existing sharded project and owner counters. Their stored
catalog sort total is refreshed within five seconds after new counts. Legacy
plugins without initialized sharded counters retain their existing stored total.
The retired `pluginDownloads` event table is not repopulated.

After a successful mutation, an internal Convex action sends
`download_redirect_issued` with section, stable reference, version, source
(`website` or `api`), and `counted`. Requester identities are hashed again in a
separate analytics namespace. No raw IP, email, user agent, storage key, signed
URL, or redirect secret is sent. Delivery is best effort with a five-second
timeout and no automatic retry of the non-idempotent collector call. Missing
configuration, collector errors, and timeouts cannot reverse the counter or
prevent delivery of the download response.

The browser SDK records anonymous public `screen_view`, `catalog_search`
(query length only), and `download_clicked` events. Query strings and fragments
are omitted from page URLs, and referrers are reduced to their origin. Account,
authentication, admin and dashboard pages are excluded; replay is disabled.
Browser download clicks support browsing funnels. Server redirects use a
separate pseudonymous identity, so do not assume automatic browser/server
session stitching. A redirect records an issued link, not completed file transfer.

## Configuration and release order

1. Deploy OpenPanel manually using `../infrastructure/openpanel/README.md`.
   Create separate browser and server write clients for BedrockNexus. Restrict
   the browser client to production website origins; use a separate dev project
   and credentials for localhost. Keep the server secret out of the browser.
2. On the Convex deployment set `OPENPANEL_CLIENT_ID`,
   `OPENPANEL_CLIENT_SECRET`, and
   `OPENPANEL_API_URL=https://analytics.amblydia.com/api`. Leave credentials
   absent until the collector is ready. Existing downloads continue to work.
3. Deploy Convex functions first. They add only a read-only public compatibility
   resolver and an internal telemetry action; no new analytics table or data
   migration is required. Preserve the existing pending backend changes.
4. On API set `CONVEX_URL`, `DOWNLOAD_REDIRECT_SECRET` (same as Hub/Convex),
   and `API_PUBLIC_URL=https://api.bedrocknexus.com`. Configure trusted client
   address detection: `TRUST_PROXY_HEADERS=true` only behind a proxy that
   overwrites/validates forwarding headers, with `CLIENT_IP_HEADER` or
   `TRUSTED_PROXY_HOPS` matching the actual topology. Deploy API.
5. On Hub set runtime `OPENPANEL_BROWSER_CLIENT_ID` and
   `OPENPANEL_API_URL=https://analytics.amblydia.com/api`. These runtime values
   need no new Docker build arguments. The CSP allows this collector origin
   only when the browser client is configured. Deploy Hub.
6. Verify one public add-on, resource pack, and enabled plugin via website and
   API. Check checksums, redirect targets, no-store headers, repeat deduplication,
   HEAD rejection, visibility changes, account isolation, and rate-limit errors.
   Confirm browser events in DevTools and the OpenPanel dashboard. Confirm
   backend `download_redirect_issued` events after commit. A collector outage
   must leave redirects and official totals working. Do not describe mocked
   collector tests as live acceptance.

Creator-facing analytics dashboards and publication/signup funnel events are
future work; this change establishes public discovery and download tracking.
