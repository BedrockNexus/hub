# Analytics and download URLs

## Responsibilities

OpenPanel is the shared Amblydia browsing/product analytics platform. BedrockNexus
has its own project and credentials within that instance. Convex remains the
authority for listing totals, creator totals, deduplication, and rate limits.
No counter is read back from OpenPanel or updated by a browser event.

The shared dashboard is planned at `https://analytics.amblydia.com`, managed
through `https://coolify.bedrocknexus.com`. Use the collector URL actually exposed
by that resource; a built-in Coolify service may expose a separate API origin.
The `/api` path applies to the optional same-origin stack in
`../infrastructure/openpanel/`, not automatically to every Coolify template.

Application integration and official counters are deployed. OpenPanel activation
and live collector acceptance remain in [TODO.md](../TODO.md).

## Website chart components

Use [Bklit UI](https://bklit.com/docs/installation) for analytics charts in the
BedrockNexus admin and creator dashboards. It is the chart presentation layer:
OpenPanel remains the behavioral analytics provider, and Convex remains the
source of official listing and download totals. Install the relevant Bklit
shadcn registry components when implementing those screens, using the site's
existing theme and accessible loading, empty and error states.

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

## Activate OpenPanel

1. Create the OpenPanel resource in Coolify and configure its dashboard domain.
   The optional custom stack under `../infrastructure/openpanel/` is not required
   when using the built-in resource. Wait for all services to become healthy.
2. Create the Amblydia organization and a BedrockNexus project. Create separate
   browser and server write clients. Restrict the browser client to production
   website origins and use separate dev credentials for localhost.
3. On production Convex set `OPENPANEL_CLIENT_ID`, `OPENPANEL_CLIENT_SECRET` and
   `OPENPANEL_API_URL` to the server client and actual collector base URL. These
   are deployment variables, not Hub `.env.local` values. No new function deploy
   is required just to change the environment.
4. On Hub's Coolify runtime environment set `OPENPANEL_BROWSER_CLIENT_ID` and
   the same `OPENPANEL_API_URL`. Redeploy the Hub service to load them; these
   values need no new Docker build arguments. The CSP permits the collector
   origin only when the browser client is configured.
5. The API needs no OpenPanel credentials; it calls the same Convex download
   mutations as the website. Keep its existing shared redirect secret and
   trusted proxy configuration. Disabling telemetry must not disable downloads.
6. Verify public browser events and backend `download_redirect_issued` events in
   OpenPanel. Check account-page exclusion, query-value omission, checksums,
   repeat deduplication, HEAD rejection, account isolation and collector outages.
   Browser/client, backend and Minecraft acceptance are distinct checks.

## Application deployment dependency

When changing the download contract, deploy Convex functions first, then API and
Hub. The API's `DOWNLOAD_REDIRECT_SECRET` must match Hub/Convex, and
`API_PUBLIC_URL` must be the external API origin. Configure equivalent trusted
client-address detection on both services; never trust client-supplied forwarding
headers without a trusted proxy. See `.env.example` in each repository.

Creator-facing analytics dashboards and publication/signup funnel events are
future work; the current integration covers public discovery and download events.
