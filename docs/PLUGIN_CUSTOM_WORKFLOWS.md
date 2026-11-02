# Connect an existing workflow

Status: proposed Hub feature. The public `BedrockNexus/plugin-workflows`
repository is a collection of copyable templates. Connecting arbitrary existing
workflow paths is not implemented in Hub yet. Uploading a correctly named
artifact does not bypass that gate.

## Creator experience

The creator chooses either **Install a managed workflow** or **Use an existing
workflow** after selecting their repository and server software.

For an existing workflow, choose its GitHub workflow file and publication branch,
then submit that configuration for review. Display the workflow and build scripts
as a diff against the last approved revision. The app reads the existing file;
it does not install another pipeline. A creator can add a `plugin-package` upload
step to the pipeline they already maintain.

After approval, successful builds appear in the same build picker. Selecting a
build copies its plugin file to private storage and creates the usual release
submission. The moderator reviews that stored file. Approval publishes those
bytes without rebuilding or downloading a newer artifact.

## Existing implementation and changes needed

Hub currently uses `.github/workflows/bedrocknexus-publish.yml`, expects a workflow
named `BedrockNexus Publish`, and matches the file blob SHA against the installed
template. Its validator requires `{{package_name}}` and an explicit artifact upload
step. The official repository's `templates/index.json` supplies the available
templates. A scheduled action refreshes a read-only Convex cache atomically from
one repository commit, while the admin page provides refresh and source links.
Each installation records its source commit and path. The template repository
does not execute builds or provide reusable workflow endpoints.

Hub already stores selected artifact bytes privately, calculates the plugin's
SHA-256, and keeps build selection separate from moderation and publication.
Keep that path. Extend the producer selection and provenance checks.

Proposed records, added compatibly alongside existing managed records:

| Record | Purpose |
| --- | --- |
| Build source | Repository ID, software ID, mode, GitHub workflow ID/path, allowed branch, creator and current approval revision |
| Approval revision | Immutable workflow blob, tracked build-file blobs, dependency lockfile blobs, resolved external action/workflow commit pins, reviewer, review time, disposition and reason |
| Build attempt | Repository and workflow IDs, run ID **and attempt**, source SHA, event/ref, approval revision, conclusion, artifact ID and expiry, GitHub archive digest when available |
| Submission receipt | Build-attempt identity, private storage key, file name/size, extracted plugin SHA-256 and archive SHA-256 |

Approval is a separate state from release moderation. A pending configuration
cannot submit builds. A denied configuration needs an explanation and a new
revision. Reconnecting a repository or changing workflow/branch creates a new
revision; an earlier approval cannot transfer to a different producer.

## What needs renewed review

- Changes to workflow steps, declared build scripts, lockfiles, permissions,
  external actions or reusable workflow revisions create a new approval revision.
- Ordinary plugin source changes remain visible in the release review. They do
  not require a separate build-configuration approval unless they change a tracked
  build input.
- Community template changes are reviewed through pull requests. Hub refreshes
  the catalog from `main`; existing installations change only when their owner
  explicitly installs or updates their workflow.

Matching a workflow blob only establishes that the file is unchanged. It does not
prove that repository scripts, generated code or downloaded dependencies are the
same. Reviewers must see the relevant scripts and dependency sources. Remote
actions/workflows must be pinned to full commits; project dependencies should use
reviewed locks or verified downloads. An upload action or checksum supplied by the
creator cannot independently establish that the output matches the source.

For the first implementation, support a documented, bounded set of tracked build
inputs. If a build resolves mutable or undeclared build logic, require a reviewer
to resolve that dependency before approving it. Do not present a static YAML
scanner as proof of arbitrary shell behavior.

## Import gate

Before making a build selectable, obtain its identity from GitHub with the app's
installation credentials and verify:

1. It belongs to the connected repository and approved workflow ID/path.
2. It is a successful completed **push** on the approved branch. Fork pull
   requests, manual dispatches and tag pushes are not publication candidates.
3. The exact commit's workflow and tracked build inputs match an approved
   revision. Check resolved reusable workflow revisions as well as the caller.
4. The artifact belongs to that exact run/attempt, is unexpired, and contains one
   supported plugin file within the existing size limits.
5. The downloaded archive matches GitHub's digest when supplied. Compute the
   archive digest and extracted plugin checksum independently on the backend.

Then persist the receipt and immutable private copy before moderation. An expired
GitHub artifact is harmless after a verified private copy exists. Revalidate
authorization and source identity at submission to close selection-time races.

Rerunning a GitHub run increases its attempt without necessarily changing the run
ID. Hub currently caches completed builds by run ID. The custom-workflow work
must address attempts rather than accepting a stale artifact or rewriting a
previously selected build. Store attempts separately and keep submitted receipts
immutable. The same improvement should cover managed builds.

The build job never receives BedrockNexus app credentials or storage credentials.
The backend performs artifact import and publication. Use read-only repository
permissions and hosted runners for supported publishing builds. Existing unrelated
deployment jobs remain outside the approved producer; their presence is not proof
that a build is acceptable.

## Reviewer workload

Show changed workflow/build inputs, resolved tool versions, commit comparison,
build logs, manifest information, artifact identity and checksum together. Do not
require reviewers to approve an unchanged configuration for every plugin release.
Keep a separate release decision for code and artifact changes.

## Implementation order and acceptance

1. Add build sources and immutable approval revisions, with authenticated owner
   submission and moderator decisions. Old managed drafts retain current behavior.
2. Add existing-workflow discovery and the creator/reviewer screens; no automatic
   approval based on a workflow name or an installed upload action.
3. Extend webhook/run synchronization and artifact import to track attempts and
   bind every candidate to its approved revision. Use repository/workflow indexes
   and bounded queries.
4. Test changed scripts/locks/pins, denied and revoked approvals, fork/manual/tag
   events, wrong repositories, duplicate artifact names, run reruns, expired files,
   digest mismatch and selection/submission races. Verify one authenticated hosted
   lifecycle through review and download before enabling the feature generally.

Start with one collaborator's real existing workflow so the first integration
solves the duplicated-pipeline problem without requiring arbitrary YAML editing in
the website.
