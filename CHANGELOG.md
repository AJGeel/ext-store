# Changelog

## [V0.2.1] — 2026-10-25

- A scene's `backdrop` can be a file path, as documented. Before, only URLs worked.

## [V0.2.0] — 2026-10-25

- `ext-store screenshots` captures store listing screenshots from the built extension and frames them with a headline. Configure scenes, seeders, action paths and the frame in `ext-store.config.ts`. Needs `playwright`, an optional peer dependency.
- `ext-store screenshots upload` replaces the Firefox listing's screenshots and opens the Chrome dashboard for the rest.
- `ext-store init` sets up a repo: config file, `package.json` scripts, `.env.example` and `.gitignore`.
- `@ajgeel/ext-store/screenshots` exports `waitForImages` and the `Stage` type.
- The README is rewritten around what you can do, with step-by-step flows.
- `package.json` ends with a newline again, so the format check passes.

## [V0.1.3] — 2026-10-24

- Dependabot opens a weekly PR for outdated GitHub Actions and Bun dependencies. It waits 14 days after a release first, like `minimumReleaseAge` in `bunfig.toml`. Critical security updates bypass the cooldown.

## [V0.1.2] — 2026-10-24

- Source reorganised into `commands/`, `stores/` and `lib/`. Import paths such as `@ajgeel/ext-store/ui` are unchanged.
- Unit and end-to-end tests, a linter and Prettier.
- CI runs the type check, lint, format check and tests on every push and pull request.

## [V0.1.1] — 2026-10-24

- Publish to npm from GitHub Actions, with provenance.
- `bun run release` tags and publishes this package.

## [V0.1.0] — 2026-10-24

- First version: `status`, `submit`, `auth` and `tag-release` for the Chrome Web Store and Firefox Add-ons.
