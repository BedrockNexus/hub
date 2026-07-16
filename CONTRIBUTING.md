# Contributing to Bedrock Nexus Hub

Thanks for helping improve Bedrock Nexus. Contributions should stay focused,
respect the existing architecture, and include enough context to review safely.

## Before You Start

1. Search existing issues and pull requests for related work.
2. Open an issue before beginning a large feature, schema rewrite, or visual
   redesign so the direction can be agreed first.
3. Never include credentials, production data, private reports, or user data in
   an issue, commit, fixture, screenshot, or log.

## Development

This repository uses Bun. Do not introduce npm, pnpm, or Yarn lockfiles.

```bash
bun install
bun run dev
```

Copy `.env.example` to `.env.local` and use your own development resources.
Configure server-only secrets in the Convex dashboard as well as any runtime
environment that needs them.

Follow the established Next.js, Convex, Base UI, and shadcn patterns. Keep
Convex authorization and lifecycle enforcement in backend functions, even when
the UI also prevents an invalid action.

## Before Opening A Pull Request

Run the checks relevant to your change:

```bash
bun run lint
bun run typecheck
bun run test:e2e
```

Run `bun run build` when changing routes, server rendering, metadata,
configuration, or dependencies. Add or update tests when behavior changes.

Pull requests should explain the problem, the chosen solution, verification
performed, screenshots for visible UI changes, and any schema or environment
changes. Keep generated files and unrelated formatting out of the change.

## Licensing

By submitting a contribution, you agree that it may be distributed under this
repository's GNU Affero General Public License v3.0.
