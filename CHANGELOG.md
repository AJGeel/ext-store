# Changelog

## [V0.1.2] — 2026-10-24

- Source reorganised into `commands/`, `stores/` and `lib/`. Import paths such as `@ajgeel/ext-store/ui` are unchanged.
- Unit and end-to-end tests, a linter and Prettier.
- CI runs the type check, lint, format check and tests on every push and pull request.

## [V0.1.1] — 2026-10-24

- Publish to npm from GitHub Actions, with provenance.
- `bun run release` tags and publishes this package.

## [V0.1.0] — 2026-10-24

- First version: `status`, `submit`, `auth` and `tag-release` for the Chrome Web Store and Firefox Add-ons.
