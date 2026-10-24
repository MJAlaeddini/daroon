# Architecture

## Principles

1. **Offline-first.** The app keeps everything on the device first and works fully without the server. The server adds three things: sign-in, sync between devices, and weekly stories written by Claude.
2. **One source of truth for shared rules.** The calendar, the allowed words, the data shapes and the story prompt live in `packages/shared`, used by both the web app and the API; the same zod schema validates in the browser and on the server.
3. **One module per feature.** Each new feature gets its own folder and talks to the rest only through its small interface.

## Web (`apps/web`)

The single-file prototype was split into modules without changing its behaviour. The `e2e/parity` test keeps its look identical to `docs/prototype/daroon.html`.

| Folder                    | Responsibility                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `core/`                   | Small utilities and colour (OKLab)                                                                  |
| `domain/`                 | Vocabulary and each emotion's form parameters, guided-path questions, a day's emotional composition |
| `sculpture/`              | WebGL2 shader, Canvas2D fallback renderer, spring-driven sculpture engine, calendar thumbnails      |
| `stage/`                  | The single sculpture that travels between views, and the motion choreography                        |
| `state/`                  | App state (`S`) and local storage (`DB` in localStorage)                                            |
| `views/`                  | Screens; each builds its own HTML                                                                   |
| `ui/`                     | Rendering and navigation, sheets, toasts, theme, the save scene                                     |
| `features/`               | Saving, account and sign-in, sync, stories                                                          |
| `net/api.ts`              | The only place that talks to the server                                                             |
| `actions.ts`, `events.ts` | Every click reaches `ACT` through `data-act`                                                        |

The interface layer is typed loosely for now (`strict: false`) because it came straight from the prototype; new code (`net/`, `features/sync.ts`, `packages/shared`, the whole API) is fully `strict`. Suggestion: whenever you work on one of the interface modules, tighten its types.

### Sync

- Every entry has `updatedAt`; `syncedAt` records the version last delivered to the server. Any entry where the two differ still has to travel.
- Deletions are kept as tombstones (`deletedAt`) so they reach other devices too.
- The server stamps every write with an increasing number (`seq`). A device asks for "everything written after N", and the newest edit wins.
- Sync runs shortly after each save, on reconnect, on returning to the app, and every minute.
- Notes and sample entries are never sent.

## API (`apps/api`)

```
src/
  config.ts          All settings from env, validated with zod
  app.ts             Builds the app from injected dependencies (tests swap in fakes)
  db/                Drizzle schema, connection, migrations
  plugins/           Session (cookie + hash in the database), CSRF
  lib/               Errors, crypto, validation
  modules/
    auth/            Email codes, Google, mail delivery
    account/         Profile, export, account deletion
    entries/         Sync
    stories/         Weekly stories with Claude
```

Each module has a `routes.ts` (HTTP input and validation) and a `service.ts` (logic and database).

### Adding a feature

1. If it has a new data shape, write its schema in `packages/shared/src/schemas.ts`.
2. Add its table to `apps/api/src/db/schema.ts` and run `pnpm --filter @daroon/api db:generate`.
3. Create `apps/api/src/modules/<name>/` with `routes.ts` and `service.ts` and register it in `app.ts`.
4. Add its function to `apps/web/src/net/api.ts` and call it from a module in `features/`.
5. Add API tests in `apps/api/test` and, if it has UI, browser tests in `apps/web/e2e`.

## Security

- Six-digit login code, ten-minute lifetime, five attempts, at most five codes per hour per address, and per-IP rate limits.
- The database stores only an HMAC of each code and the SHA-256 of each session token.
- Cookie is `httpOnly`, `SameSite=Lax`, `Secure` in production and scoped to `/api`; state-changing requests must come from the app's own origin and carry JSON.
- Caddy: automatic HTTPS, HSTS, and a strict CSP (Google Identity Services is the only external source).
