# syntax=docker/dockerfile:1
# Builds the web app and serves it with Caddy, which also terminates TLS and proxies /api.
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile --filter @daroon/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @daroon/web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
