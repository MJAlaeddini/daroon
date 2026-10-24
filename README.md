# Daroon

A private journal for feelings: touch the words, see the shape of what's inside, and keep a trace of it.
This repository is the production version of the prototype: an installable web app (PWA) for phones, tablets and desktops, plus a backend for sign-in, sync and weekly stories. The interface is in Persian (RTL).

## Layout

```
apps/
  web/        Web app (Vite + TypeScript, no framework): WebGL sculpture, views, offline-first sync, PWA
  api/        Backend (Fastify + Drizzle + PostgreSQL): email-code and Google sign-in, sync, stories, account
packages/
  shared/     Shared code: Jalali calendar, emotion vocabulary, zod schemas, the weekly-story prompt
deploy/       Dockerfiles, docker-compose and Caddy for a VPS
docs/         Architecture, deployment, testing; the original prototype as the visual reference
```

More detail: [architecture](docs/architecture.md) · [deploying to a server](docs/deploy.md) · [tests](docs/testing.md)

## Local development

Requirements: Node 22+, pnpm 10 (`corepack enable`), and Docker for the database.

```bash
pnpm install
pnpm db:up                         # PostgreSQL on port 5432
cp apps/api/.env.example apps/api/.env
pnpm dev                           # web on http://localhost:5173, API on 8787
```

Without `SMTP_URL`, login codes are printed to the API console instead of being emailed. Without `GOOGLE_CLIENT_ID` the Google button is hidden, and without `STORY_API_URL` (any OpenAI-compatible chat API) the weekly story is a plain summary written on the device. The app works fully without the server; only sign-in and sync are unavailable.

## Commands

| Command                                 | What it does                                                |
| --------------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                              | Run web and API in development mode                         |
| `pnpm build`                            | Production build of both                                    |
| `pnpm lint` / `pnpm typecheck`          | Lint and type-check                                         |
| `pnpm test`                             | Unit and API tests (needs PostgreSQL)                       |
| `pnpm test:e2e`                         | Browser tests: acceptance, parity with the prototype, flows |
| `pnpm --filter @daroon/api db:generate` | Generate a migration after changing `schema.ts`             |

## Privacy, plainly

- Notes are never stored on the server. When a weekly story is written, that week's notes are sent for that one request only.
- Login codes are stored only as hashes, and sessions live in an httpOnly cookie.
- Deleting the account removes everything on the server, and a full export is always available.
