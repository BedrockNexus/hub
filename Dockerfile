# syntax=docker.io/docker/dockerfile:1

FROM oven/bun:alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public vars injected by CI
ARG CONVEX_DEPLOYMENT
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG SITE_URL
ARG BEDROCKNEXUS_API_URL

ENV NEXT_TELEMETRY_DISABLED=1

ENV CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
ENV NEXT_PUBLIC_CONVEX_SITE_URL=${NEXT_PUBLIC_CONVEX_SITE_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV SITE_URL=${SITE_URL}
ENV BEDROCKNEXUS_API_URL=${BEDROCKNEXUS_API_URL}

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
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
