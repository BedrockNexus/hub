# November 2026 dependency update

The Hub uses Convex 1.49.0, Next.js 16.4.4 and React 19.3.1. Compatible
patches were applied to Convex components, Better Auth UI, the editor, AWS SDK,
OpenPanel, testing tools and other dependencies. Convex 1.49 requires Node 22
or newer; the existing Docker image uses Node 22.

The API uses Hono 4.13.16, zip.js 2.24.0 and Biome 2.6.4. Its Biome
configuration was migrated to the new recommended preset syntax.

## Compatibility decisions

- Better Auth stays on 1.6.34: `@convex-dev/better-auth` 0.12.6 requires
  `better-auth >=1.6.11 <1.7.0`. Optional auth plugin peers are pinned to that
  same supported line. Better Auth UI 1.6.45 also requires `react-email`, which
  is installed explicitly.
- Hub keeps Ultracite 7.0.11 and Biome 2.5.15. Moving both to their next major
  ruleset caused extensive unrelated formatting and lint changes. The API has
  no Ultracite dependency and can use Biome 2.6.4 directly.
- CodeMirror language packages resolve to 6.13.1 to avoid incompatible copies
  of its nominal TypeScript classes. If an existing Bun installation retains
  an obsolete nested package, clear that stale dependency and TypeScript's
  incremental cache before checking again.
- `fflate` 0.8.3 addresses the malformed ZIP64 advisory. The
  `postcss-selector-parser` override uses the patched, compatible 6.1.5 release.

## Remaining audit findings

The refreshed Hub lockfile reduces `bun audit --json` from 58 advisory records
to 11; this does not establish that the application has no vulnerabilities.
The API audit reports no known vulnerabilities at the time of this update.

Better Auth's remaining findings concern Magic Link plus OAuth, OAuth Proxy,
device authorization, OAuth provider resource audiences, and PostgreSQL
adapter rate limits. The current application uses the Convex adapter and
does not enable those optional plugins. This configuration assessment is not
a substitute for upgrading once the Convex adapter supports the patched auth
line. Reassess before adding any of those plugins or changing adapters.

Other findings affect `deepmerge` (no patched version available in the checked
release line) and the `glob`/`minimatch` trees used by development tooling.
Forcing their newest major versions through global overrides can break their
callers. Upgrade the owning tools together in a separate migration.

## Validation and rollout

Validation completed for this update:

- Hub: Biome lint, application and Convex typechecks, production Next.js build,
  93 Bun tests and 271 Convex/Vitest tests pass.
- API: lint, typecheck and 199 tests pass. Both frozen lockfile installs pass.
- Convex: development deployment succeeds and the production dry run validates
  the schema and new outbox index. Production has not been updated by this work.
- The additional `lint:framework` check reports 15 errors in existing files
  outside this change, alongside 33 warnings. These include React Compiler
  checks in the editor/settings/hooks, a JSX apostrophe, a type-only interface,
  and CommonJS script imports. This check is not part of the current Quality
  workflow. Its source cleanup remains separate; the check is not reported as
  passing and its rules have not been weakened.

Discord delivery tests use mocked requests and must not post to the real
channel. No real webhook message has been sent. See
[Discord listing announcements](DISCORD_ANNOUNCEMENTS.md) for activation and
publication rules.

Production rollout must deploy the Convex schema/functions with the updated
components before releasing the Hub. Set the Discord webhook through the
deployment's secret environment configuration; enable announcements only on
the production deployment intended to publish to the channel.
