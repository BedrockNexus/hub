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

## Release downloads

Website release URLs use `/<section>/<ref>/download/<version>`. Launcher download
URLs use `/v1/<section>/<ref>/releases/<version>/download` on the API origin.
The old `/api/projects/versions/<id>/download` resolves the original release and
redirects to its canonical section URL. Availability rules and official counting
remain in Convex. See [analytics and downloads](./ANALYTICS_AND_DOWNLOADS.md).

Regression checks are in [TESTING.md](../TESTING.md). Route changes require both
backend resolvers and matching application handlers; deploy the backend first.
