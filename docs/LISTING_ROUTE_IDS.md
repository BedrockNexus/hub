# Listing route identities

Public and dashboard links use the same identity for each listing:

| Listing | Public | Dashboard |
| --- | --- | --- |
| Addon | `/addons/a_<project-record-id>` | `/dashboard/addons/a_<project-record-id>` |
| Resource pack | `/resource-packs/rp_<project-record-id>` | `/dashboard/resource-packs/rp_<project-record-id>` |
| Plugin | `/plugins/p_<base36-github-repository-id>` | `/dashboard/plugins/p_<base36-github-repository-id>` |
| Server | `/server/play.example.com` | `/dashboard/servers/play.example.com` |

Addon/resource pack identities wrap existing project IDs; no records, files, or
ownership relationships are recreated. Plugin IDs retain the existing repository
encoding. Names and slugs remain editable metadata. Legacy `texture_pack` records
use the `rp_` prefix.

Server hosts are normalized to lowercase without a trailing dot. The default
Bedrock port (19132) is omitted; other ports appear as `host:port` to distinguish
listings on the same domain. IPv4 hosts follow the same rule. Changing a server's
connection address changes its canonical URL; the connection form navigates to
the updated dashboard address after saving.

Old public slugs and dashboard record IDs continue to resolve. Canonical pages
redirect to the new identity and preserve the active section. Public visibility
and dashboard authorization checks still apply before returning a listing or
redirecting. Release downloads continue to identify their original stored files.

## Release order

1. Deploy the Convex resolvers, plugin card identity field, sitemap projections,
   and `servers.by_ipAddress_and_port` index first; wait for the index to be ready.
   These functions continue accepting the old route arguments.
2. Deploy the Hub routes and link changes.
3. Verify public details, legacy redirects, release downloads, and an authenticated
   dashboard edit for every listing type. Include two servers using the same host
   on different ports.

Local verification covers codec and URL helpers, actual Convex test functions
(including visibility, ownership, and plugin downloads), server component redirect
behavior, TypeScript, and the production build. It does not replace acceptance
against a deployed backend and an authenticated production browser session.
