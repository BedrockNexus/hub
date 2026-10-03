# syntax=docker.io/docker/dockerfile:1

# Keep in step with "packageManager" in package.json.
FROM oven/bun:1.3.6-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

# Lint, typecheck and unit tests. CI builds this stage first (test-target:
# test) and only builds, pushes and deploys the image when it passes.
FROM base AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run lint && bun run typecheck && bun run test

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public values inlined into the client bundle at build time. They are
# visible in the image and the browser, so nothing secret belongs here;
# server-only settings (SITE_URL, BEDROCKNEXUS_API_URL, ...) are runtime
# environment variables set in Coolify.
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1

ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
ENV NEXT_PUBLIC_CONVEX_SITE_URL=${NEXT_PUBLIC_CONVEX_SITE_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Secrets are supplied by the deployment environment, never copied into images.
RUN BROWSERSLIST_IGNORE_OLD_DATA=true bun --bun next build

# Production image, copy all the files and run next
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 coolify
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:coolify /app/.next/standalone ./
COPY --from=builder --chown=nextjs:coolify /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
