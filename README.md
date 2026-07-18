# Bedrock Nexus Hub

Bedrock Nexus Hub is the open-source web platform behind
[bedrocknexus.com](https://bedrocknexus.com). It helps the Minecraft Bedrock
community discover servers and projects while giving creators tools for
publishing, collaboration, moderation, downloads, galleries, and analytics.

## What Is Included

- Public server and project directories with profiles, galleries, reviews,
  favourites, live server status, and search-friendly metadata
- Creator dashboards for servers, projects, versions, organizations, profiles,
  and analytics
- DNS and MOTD server ownership verification
- Project submission and admin moderation workflows
- R2-backed media and version downloads with cleanup and download tracking
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

- [Bun 1.3.6 or newer](https://bun.sh/)
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

Start the frontend and Convex development processes:

```bash
bun run dev
```

The web app runs at [http://localhost:3000](http://localhost:3000). On first
use, the Convex CLI will prompt you to select or create a deployment.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start Next.js and Convex development servers |
| `bun run lint` | Run Biome checks |
| `bun run lint:fix` | Apply safe Biome formatting and lint fixes |
| `bun run lint:framework` | Run framework-specific ESLint checks |
| `bun run typecheck` | Run TypeScript without emitting files |
| `bun run build` | Create a production build |
| `bun run test:e2e` | Run Playwright end-to-end tests |

## GitHub Deployment

Pull requests and pushes to `main` run lint and typechecking. Image publishing
uses GitHub Container Registry:

- `main` builds with the `prod` GitHub Environment and publishes `latest`.
- Every image also receives an immutable commit SHA tag.

Create a `prod` GitHub Environment with these variables:
`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_API_URL`, `SITE_URL`, and `BEDROCKNEXUS_API_URL`.
Runtime secrets are configured in the deployment platform and are never copied
into the image.

Local development uses an ignored `.env.local` file and does not require a
GitHub Environment.

## Repository Layout

| Path | Contents |
| --- | --- |
| `app/` | Next.js routes, layouts, metadata, and API handlers |
| `components/` | Public, dashboard, admin, editor, and UI components |
| `convex/` | Schema, queries, mutations, actions, auth, and scheduled jobs |
| `lib/` | Shared clients, helpers, validation, and SEO utilities |
| `e2e/` | Playwright smoke tests |
| `docs/` | Product and search-authority documentation |

See [SERVER_FLOW.md](./SERVER_FLOW.md) and [PROJECT_FLOW.md](./PROJECT_FLOW.md)
for lifecycle rules. Launch verification is tracked in [TESTING.md](./TESTING.md),
while remaining product work lives in [TODO.md](./TODO.md).

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
