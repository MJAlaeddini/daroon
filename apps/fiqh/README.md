# Shajara (شجره): a tree of jurisprudential reasoning

A standalone web app, served for now at `/fiqh/` next to Daroon. It shares no code with Daroon. It has its own
`package.json`, build and fonts, and imports nothing from `@daroon/*`, so it can move to its own repository by
copying this folder.

## What it does

- **A tree per question.** The tree grows upward:
  - sources at the roots: verse, narration, rule, consensus, rational argument, the facts of the case
  - inferences in the middle
  - rulings at the top
- **Narrations.**
  - Each narration has its Arabic text (set in Amiri), a translation, its source, and its chain of narrators with each
    narrator's standing.
  - The chain is graded automatically (`gradeChain` in `src/model.ts`). The weakest link decides:
    - **sahih:** every narrator is a trustworthy Imami
    - **muwaththaq:** every narrator is trustworthy, but at least one is not Imami
    - **hasan:** no weak narrator, but at least one is only praised
    - **daif:** at least one narrator is weak or unknown
    - **mursal:** the chain has a gap
- **Selecting a ruling.** Its whole derivation lights up down to the roots and is listed as ordered steps.
- **Objections and replies.** An objection attacks one inference and can carry a reply.
- **Deriving a new ruling.** Choose premises and a method of inference; the app adds an inference and a ruling to
  the tree.
- **Storage.** Trees are kept in the browser (localStorage), with export and import as JSON.

## Files

| File            | What it holds                                                          |
| --------------- | ---------------------------------------------------------------------- |
| `src/model.ts`  | Types, labels, chain grading, lineage and steps of a derivation        |
| `src/sample.ts` | The worked example (istishab); citations to be checked against sources |
| `src/layout.ts` | Rows from roots to crown, ordered to keep lines from crossing          |
| `src/ui.ts`     | Library, tree, side panel, forms                                       |
| `src/style.css` | The manuscript look, light and dark                                    |

## Commands

```bash
pnpm --filter fiqh-tree dev      # local
pnpm --filter fiqh-tree build    # dist/, built for base /fiqh/
```

## Moving it out

1. Copy this folder into a new repository.
2. Run `pnpm install`.
3. Set `base` in `vite.config.ts` to wherever it will be served.

On Daroon's side, the `/fiqh` block goes from `deploy/Caddyfile` and the `fiqh` stage from
`deploy/web.Dockerfile`.
