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
# the commit being built ("<short hash> <date>"), shown as the version; .git is not in the build context
ARG BUILD_ID=
ENV BUILD_ID=$BUILD_ID
RUN pnpm --filter @daroon/web build

# the reasoning tree at /fiqh/: a separate app with no dependency on Daroon, built on its own
FROM node:22-alpine AS fiqh
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/fiqh/package.json apps/fiqh/
RUN pnpm install --frozen-lockfile --filter fiqh-tree
COPY apps/fiqh apps/fiqh
RUN pnpm --filter fiqh-tree build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
COPY --from=fiqh /repo/apps/fiqh/dist /srv-fiqh
# a broken Caddyfile would take the whole site down: fail the image build instead
RUN SITE_ADDRESS=:80 ACME_EMAIL=ci@example.com caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
