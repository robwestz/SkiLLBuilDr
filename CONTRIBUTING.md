# Contributing

Thanks for your interest in improving skill-browser. This is a small, zero-dependency tool — contributions should stay in that spirit.

## Setup

```bash
node build.mjs      # scan plugins + user skills, emit data.js / data.json
bash launch.sh      # serve index.html locally and open it in a browser
```

No `npm install` step — the project has zero runtime npm dependencies.

## Dev loop

```bash
bash test.sh        # run the test suite
```

Iterate: edit → `node build.mjs` (if you touched scanning or data shape) → refresh the browser.

## Architecture

- **Single-page HTML UI** — `index.html` is the entire frontend. No build step, no framework.
- **ES modules** — all JS is native ESM (`.mjs`), loaded directly by the browser or Node.
- **Zero npm deps** — keep it that way. Prefer a few lines of vanilla JS over pulling in a package.
- **Data is emitted, not fetched** — `build.mjs` scans the filesystem and writes `data.js` / `data.json` / `recipes.js`. The UI reads these as static files.

## Where to put new features

| Area | File |
| --- | --- |
| UI, layout, interactions | `index.html` |
| Scanning plugins / skills, catalog shape | `build.mjs` |
| Intent matching, scoring, Compose ranking | `intent.mjs` |
| Query helpers used by the UI | `query.mjs` |
| Bundling for distribution | `bundle.mjs` |
| Seed recipe chains | `recipes.json` |

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new user-visible feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — tooling, refactors, non-functional

Keep the subject line under 72 characters. Explain *why* in the body when it isn't obvious.

## Pull requests

- Run `bash test.sh` before pushing.
- Do not commit generated artifacts (`data.json`, `data.js`, `recipes.js`) — they are in `.gitignore`.
- Do commit `recipes.json` (the source) when you add or edit recipes.
