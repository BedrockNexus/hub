# Browser acceptance

Install Chromium with `bunx playwright install chromium`. On Windows, the
installed Edge browser can be used by setting `E2E_BROWSER_CHANNEL=msedge`.

`bun run test:e2e` runs public smoke tests. Tests requiring existing accounts
or content are skipped unless their documented environment variables are set.

## Publishing regression suite

Run `bun run build`, then `bun run test:e2e:publishing` against the local app and development Convex.
The default origin is `http://localhost:3000`, matching Better Auth's trusted
origin. The Playwright web-server configuration starts the production build if needed.
The operator must already be signed into the Convex CLI for this project.

The suite runs desktop Chromium and mobile Chromium, one worker at a time.
It creates fresh creator, moderator and admin accounts, signs in through the
real authentication API, and saves isolated storage states for the browser
contexts. A separate test also exercises the actual login form for each role.
Account verification and initial roles are fixture prerequisites, not tested
email-delivery or signup behavior.

For each addon, resource pack and server it checks:

- Creator submission and moderator claims.
- Requested changes, creator feedback, editing and resubmission.
- Approval, public visibility and recorded decision history.
- Preservation of the approved public snapshot during later corrections.
- Addon/resource-pack upload, actual asynchronous artifact validation, and
  byte-for-byte identity of the published download.
- Creator/moderator/admin route and API permission boundaries, including the
  moderator's inability to change a server's content through admin APIs.

The server uses an isolated `.example.invalid` address and a manually seeded,
single-use ownership proof. DNS/MOTD ownership verification and Minecraft
gameplay are separate acceptance tasks. Live plugin publishing is excluded;
it is tested by the participating plugin developers.

## Authorized production acceptance

Production writes are opt-in and target only `https://bedrocknexus.com` and its
existing production Convex deployment. No backend code deployment is needed.
In PowerShell, after obtaining authorization:

```powershell
$env:E2E_BASE_URL='https://bedrocknexus.com'
$env:E2E_ALLOW_PRODUCTION='1'
bun run test:e2e:publishing
```

Fixture users and listings carry a unique `e2e...` run identifier. Fixture
announcement records suppress publication announcements for those IDs only.
Provisioning appends those records; it never replaces a table, alters existing
users, changes site-wide configuration, or imports a snapshot.

Normal teardown removes only the verified fixture owner's listings and then
deletes the temporary accounts through the ordinary authenticated APIs. The
append-only moderation audit and skipped announcement records are retained.
Do not remove their history to make database counts match an earlier snapshot.

Credentials and storage states are saved only under ignored
`.e2e/publishing/<project>-<run>/`. Do not commit or attach those files.
Acceptance screenshots, per-content evidence and `cleanup.json` are written
there too. If cleanup fails, the run fails and retains the manifest so the
specific owned records can be recovered; do not rerun blindly.

Authentication traces are not captured on these non-retrying tests. Never
enable tracing while sharing real-account credentials.
