# Bedrock Nexus Hub

Bedrock Nexus Hub is the open-source web platform behind
[bedrocknexus.com](https://bedrocknexus.com). It helps the Minecraft Bedrock
community discover servers, add-ons, resource packs and plugins while giving creators tools for
publishing, collaboration, moderation, downloads, and galleries.

## What Is Included

- Public server, add-on, resource-pack and plugin directories with profiles, galleries, reviews,
  favourites, live server status, and search-friendly metadata
- Creator dashboards for listings, releases, organizations, and
  profiles
- DNS and MOTD server ownership verification
- Add-on/resource-pack validation and moderation, plus GitHub-based plugin publishing
- R2 media and release delivery, official Convex download totals, and optional OpenPanel analytics
- Better Auth accounts, email verification, sessions, roles, and organizations
- Admin controls for moderation, users, site settings, feature flags, and SEO

## Stack

- [Next.js 16](https://nextjs.org/) and React 19
- [Convex](https://www.convex.dev/) for data, functions, scheduling, and realtime
- [Better Auth](https://www.better-auth.com/) for authentication
- Cloudflare R2 for files and images
- Tailwind CSS, Base UI, shadcn components, and Hugeicons
- Biome, TypeScript, Playwright, and Bun

## Local Development

### Requirements

- [Bun 1.3.6](https://bun.sh/)
- A [Convex](https://dashboard.convex.dev/) project
- Cloudflare R2 credentials
- Resend credentials for account emails
- A Bedrock Nexus API deployment, or access to the hosted API

Install dependencies:

```bash
bun install
```

Create `.env.local` from [.env.example](./.env.example), then fill in your own
development credentials. Never commit environment files or credentials.

Configure the matching server-side variables in your Convex deployment. Convex
actions cannot call a `localhost` API, so `BEDROCKNEXUS_API_URL` and
`SERVER_VERIFICATION_API_URL` must be publicly reachable HTTPS endpoints when
used by hosted Convex functions.

Project release validation also requires a separately deployed validator
worker. Configure `ARTIFACT_VALIDATOR_URL` in Convex and either share
`BEDROCKNEXUS_API_KEY` with the worker or set a dedicated
`ARTIFACT_VALIDATOR_API_KEY`.

Public media and approved releases are delivered from the R2 CDN bucket, while
unvalidated project uploads remain in a separate private bucket. Configure
`R2_CDN_BUCKET`, `R2_UPLOADS_BUCKET`, and `R2_CDN_PUBLIC_URL` in Convex. The R2
credentials must be able to read, write, copy, and delete objects in both
buckets. See [STORAGE.md](./docs/STORAGE.md) for the bucket, CORS, lifecycle,
and release-promotion setup.

Start Convex and select or create the local development deployment:

```bash
bunx convex dev
```

Keep Convex running, then start Next.js in a second terminal:

```bash
bun run dev
```

The web app runs at [http://localhost:3000](http://localhost:3000). On first
use, the Convex CLI will prompt you to select or create a deployment.

## Commands

| Command | Purpose |
| --- | --- |
| `bunx convex dev` | Start the Convex development server |
| `bun run dev` | Start the Next.js development server |
| `bun run lint` | Run Biome checks |
| `bun run lint:fix` | Apply safe Biome formatting and lint fixes |
| `bun run lint:framework` | Run framework-specific ESLint checks |
| `bun run test` | Run library, infrastructure and Convex function tests |
| `bun run typecheck` | Run TypeScript without emitting files |
| `bun run build` | Create a production build |
| `bun run test:e2e` | Run Playwright end-to-end tests |

## GitHub Deployment

CI/CD uses the shared workflows in
[BedrockNexus/github-actions](https://github.com/BedrockNexus/github-actions):

- `Pull Request` builds the Dockerfile `test` stage (lint, typecheck, unit
  tests) and the production image, without pushing. `Quality` runs the same
  checks directly for fast feedback.
- `Deploy` runs on pushes to `main`: the `test` stage must pass, then the image
  is pushed to `ghcr.io/bedrocknexus/hub` with branch and commit tags, and
  Coolify is asked to redeploy.

Set these **repository variables** (Settings > Secrets and variables > Actions >
Variables). They are public values inlined into the client bundle:
`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`,
`NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL`.

Set the `COOLIFY_WEBHOOK` secret on the repository (the `COOLIFY_TOKEN` secret
can be shared at organization level). Hub server settings such as `SITE_URL`,
`DOWNLOAD_REDIRECT_SECRET` and the OpenPanel configuration are runtime values in
Coolify. Convex-only settings, including `BEDROCKNEXUS_API_URL`, R2 credentials
and auth secrets, belong on the Convex deployment. See [.env.example](./.env.example)
and `scripts/env-names.mjs` for the environment ownership map. Secrets are never
built into the image.

Local development uses an ignored `.env.local` file.

Convex functions deploy separately from the Hub image. Check the target before
using `bunx convex deploy`; a Hub push does not deploy the backend. Configure
OpenPanel only when the collector is ready; downloads work without it. See
[analytics and downloads](./docs/ANALYTICS_AND_DOWNLOADS.md).

## Repository Layout

| Path | Contents |
| --- | --- |
| `app/` | Next.js routes, layouts, metadata, and API handlers |
| `components/` | Public, dashboard, admin, editor, and UI components |
| `convex/` | Schema, queries, mutations, actions, auth, and scheduled jobs |
| `lib/` | Shared clients, helpers, validation, and SEO utilities |
| `e2e/` | Playwright smoke tests |
| `docs/` | Maintained contracts, operations and dated acceptance reports |

Start with the [documentation index](./docs/README.md).

See [SERVER_FLOW.md](./SERVER_FLOW.md) and [PROJECT_FLOW.md](./PROJECT_FLOW.md)
for lifecycle rules. Launch verification is tracked in [TESTING.md](./TESTING.md),
while remaining product work lives in [TODO.md](./TODO.md). Storage delivery
and deployment are documented in [STORAGE.md](./docs/STORAGE.md).

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Please
report vulnerabilities privately using [SECURITY.md](./SECURITY.md).

## License And Branding

The source code is licensed under the
[GNU Affero General Public License v3.0](./LICENSE). The license does not grant
rights to the Bedrock Nexus name, logo, or other brand assets; see
[TRADEMARKS.md](./TRADEMARKS.md).

Bedrock Nexus is not affiliated with Mojang Studios or Microsoft. Minecraft is
a trademark of Microsoft Corporation.
