# Daroon — notes for Claude

Persian (RTL) emotional journal: a PWA (`apps/web`) plus an API (`apps/api`), sharing `packages/shared`.
Read `docs/architecture.md` for the module map and `docs/deploy.md` for the server setup.

## Commands

- `pnpm install` — once per clone (set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if browsers are preinstalled)
- `pnpm lint`, `pnpm typecheck`, `pnpm exec prettier --check .` — must all pass before committing
- `pnpm test` — unit + API tests; API tests need PostgreSQL at `TEST_DATABASE_URL`
  (default `postgres://daroon:daroon@localhost:5433/daroon_test`)
- `pnpm test:e2e` — Playwright (acceptance, parity, flows); add `E2E_API=1 DATABASE_URL=…` for the two-device sync test
- `pnpm build` — web (Vite) and API (esbuild bundle)

Without Docker, a throwaway PostgreSQL for tests:

```bash
PG=/usr/lib/postgresql/16/bin; D=/var/tmp/daroon-pg
mkdir -p $D && chown postgres $D
su postgres -c "$PG/initdb -D $D/data -U daroon --auth=trust && $PG/pg_ctl -D $D/data -o '-p 5433 -k /tmp' -l $D/log start"
psql -h localhost -p 5433 -U daroon -d postgres -c "create database daroon_test"
```

## Rules of the house

- **The look and motion are the product.** The UI was ported 1:1 from `docs/prototype/daroon.html`; `e2e/parity` and
  `e2e/acceptance` guard it (no text over the sculpture, no jumps, the old page leaves before the new one arrives).
  Run them after any change under `apps/web/src`. The owner is very sensitive to choreography, clutter and typography.
- **User-facing text is colloquial Persian** («می‌شه»، «نمی‌دونم»). Never mention "AI" in the UI; stories are written by Claude
  but presented simply as the week's story. Code, comments, commits and docs are in English.
- **Notes never reach the server.** Sync sends entries without `note`; a story request carries the week's notes for that one
  call only. Keep it that way.
- **Shared rules live in `packages/shared`** (Jalali calendar, vocabulary, zod schemas, story prompt). Validate every API body
  with those schemas via `parse()`.
- New API feature = `apps/api/src/modules/<name>/{routes,service}.ts` registered in `app.ts`, a client function in
  `apps/web/src/net/api.ts`, and tests. Schema changes: edit `db/schema.ts`, then `pnpm --filter @daroon/api db:generate`.
- `apps/web/src` is typed loosely (ported code); new code should be strict. Tighten types when touching a module.

## Deploying

Pushing to `main` runs CI; when it passes, the `Deploy` workflow SSHes into the server and runs `deploy/update.sh`
(the app lives in `/opt/daroon`, currently in port mode over plain HTTP). Don't break `deploy/install.sh` re-runs:
an existing `deploy/.env` and its secrets must be kept.
