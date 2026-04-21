# Publish checklist

Manual pre-release verification for Skill Browser OSS release. Walk through every item before pushing to a public repo or npm.

## Code quality

- [ ] `bash test.sh` passes (19 tests, 0 fail)
- [ ] `node build.mjs` completes without warnings
- [ ] `node bundle.mjs` produces `dist/skill-browser.html` (~350KB)
- [ ] `node query.mjs --list-categories` — verify Misc count is ≤5
- [ ] `node intent.mjs "review my code"` — top result is relevant
- [ ] Open `dist/skill-browser.html` directly (no server), verify:
  - [ ] Welcome overlay appears on first open
  - [ ] Browse/Compose/Recipes tabs all work
  - [ ] Theme toggle works both directions
  - [ ] Basket add/remove/reorder/copy-as-prompt works
  - [ ] Export/import recipes round-trips correctly
  - [ ] `#basket=slug1,slug2` URL hash loads a basket

## Privacy / data hygiene

- [ ] `data.json`, `data.js`, `recipes.js` are in `.gitignore` (they may contain local paths and user-specific plugin lists)
- [ ] `dist/` is in `.gitignore`
- [ ] No absolute paths in committed files (only in generated artifacts)
- [ ] No email addresses or credentials in commits other than the author line in `package.json` / `LICENSE`
- [ ] `recipes.json` (committed) contains only public-safe content

## Files in release

- [x] `README.md` — current and accurate
- [x] `LICENSE` — MIT, year 2026, Robin Westerlund
- [x] `CHANGELOG.md` — updated with latest version
- [x] `CONTRIBUTING.md` — setup/dev-loop/conventions
- [x] `package.json` — version bumped, `files` field accurate
- [x] `.gitignore` — correct patterns
- [x] `.github/workflows/test.yml` — CI green on matrix Node 18/20/22

## Version bump

When releasing:
1. Update `package.json` `version`
2. Move unreleased entries from `CHANGELOG.md` to a new `## [x.y.z] - YYYY-MM-DD` section
3. Tag the commit: `git tag -a v0.x.y -m "..."` and `git push --tags`
4. Regenerate `dist/` artifact
5. If publishing to npm: `npm publish --access public`
6. If releasing on GitHub: attach `dist/skill-browser.html` to the release

## Landing

- [ ] `landing.html` opens correctly
- [ ] All internal links work (`./index.html`)
- [ ] Screenshot mock renders (no broken CSS)
- [ ] Mobile: test ≤640px width, layout doesn't break
- [ ] Dark mode on landing toggled (if implemented) or left light-only
- [ ] Remove placeholder refs to `buildr.nu` if domain isn't live yet, or point to a holding page

## Public-facing content review

- [ ] No mention of internal project names that aren't public
- [ ] No mention of people who haven't consented to public attribution
- [ ] Screenshots (if any added) don't leak personal data or project content
- [ ] Examples in `recipes.json` and documentation don't reference private repos

## Post-release smoke test

After publishing:
- [ ] Download `dist/skill-browser.html` from release page on a clean machine, open in browser, verify basic flows
- [ ] Clone the repo, run `bash launch.sh`, verify it works without modifications
- [ ] CI run on `main` branch passes
- [ ] Share with 1-2 early users, collect first-impressions feedback
