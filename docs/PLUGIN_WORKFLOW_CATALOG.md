# Official plugin workflow catalog

`BedrockNexus/plugin-workflows` is the source for template content and metadata.
`templates/index.json` has `schemaVersion: 1` and a `templates` array containing
`key`, `softwareSlug`, `label` and `path` for each YAML template. Keep keys stable
and create the matching server software before adding an entry.

Convex's scheduled `functions/plugins/workflowCatalog:refreshScheduled` action
runs every 15 minutes. It resolves `main` to a full commit, then fetches the index
and all YAML from that commit. Responses, paths and entry counts are bounded;
every workflow must pass the existing managed-template validator before the
cache is updated in one transaction.

The admin workflow page has source links, refresh status and **Refresh catalog**.
Direct database template creation, editing and deletion are disabled. Old clients
receive a repository-managed error. `pluginWorkflowTemplates` is now a read model,
not an independently editable source. `pluginWorkflowCatalogState` records the
last successful commit and any refresh error. Requests are throttled and late
results cannot overwrite a newer refresh.

## Updates and compatibility

- Existing template keys and row identities are retained when adopted from the
  repository. New/changed content receives a cache version; unrelated repository
  commits update source provenance without changing the template version.
- New installations record the repository commit/path, template version and
  installed workflow blob SHA. Updating the catalog does not change installed
  drafts, selected builds or release receipts.
- An entry removed from the index is marked inactive for future selection and
  installation. Its cached history and existing builds remain. Use a new key for
  another server software instead of repurposing an existing key.
- A failed request, invalid YAML, unknown software or invalid metadata leaves the
  last good catalog in use. Legacy database templates remain available until the
  first successful repository refresh. An intentionally empty valid index retires
  every template.

Current limits are 20 templates per index, 64,000 bytes per YAML response and
200 cached entries including retired history. Retired history is not deleted by
refresh. Review archive/retention separately if that cache limit is approached.

## Rollout

Publish the repository's templates **and index** before enabling this integration
in production. Deploy the compatible Convex schema/functions and Hub UI, refresh
the catalog, and verify both software choices and an installation. Until the
repository files are published, a refresh reports the missing catalog and keeps
existing templates available. No database content migration is required.

To roll back template content, revert the repository change and refresh. To
restore a retired entry, re-add its original key and server software. These
operations affect future installations; existing workflows remain explicit
owner updates. Normal build selection, moderation and artifact publication are
unchanged.
