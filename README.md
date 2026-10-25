# @ajgeel/ext-store

Ship a browser extension to the Chrome Web Store and Firefox Add-ons from the command line. Requires [Bun](https://bun.sh/): the package ships TypeScript source and uses Bun APIs, so it does not run on Node alone.

## What you can do

- **Set up a repo** in one command: `ext-store init`.
- **Check** which version is live and which is in review on each store.
- **Submit** a build to both stores (or one), with checks first.
- **Tag a release** on GitHub, with release notes from `CHANGELOG.md`.
- **Generate store screenshots**: captured from the real extension, framed with a headline.
- **Replace the Firefox listing's screenshots**, and open the Chrome dashboard for the rest.

```sh
ext-store init [--yes]
ext-store status [chrome|firefox]
ext-store submit [chrome|firefox] [--dry-run] [--yes]
ext-store auth                                  # get the Chrome refresh token
ext-store tag-release [--dry-run] [--yes]
ext-store screenshots [setup|upload] [--only <id>] [--dry-run] [--yes]
```

`--dry-run` shows the plan and changes nothing. `--yes` skips confirmations, e.g. in CI.

## Get started

- Run `bun add -d @ajgeel/ext-store web-ext` in your extension repo.
- Run `bunx ext-store init`. It creates `ext-store.config.ts`, adds the `store:*` scripts to `package.json`, creates `.env.example` and adds `.env` to `.gitignore`. It never overwrites anything.
- Copy `.env.example` to `.env` and fill in the [credentials](#credentials).
- Run `bun run store:auth` to get the Chrome refresh token.
- Run `bun run store:status` to check both stores are connected.

Your repo needs to provide:

- `dist/chromium/` and `dist/firefox/`, plus `dist/chromium.zip` and `dist/firefox.zip`, as produced by `buildCommand` (default `bun run ship`). The Firefox manifest needs `browser_specific_settings.gecko.id`, the Chrome one must not have `browser_specific_settings`.
- A `CHANGELOG.md` with `## [V<version>]` sections, for `tag-release`.

## Ship a release

- Bump `version` in `package.json` and add a `## [V<version>]` section to `CHANGELOG.md`. Merge to your release branch (default `main`).
- `bun run store:submit --dry-run` builds and checks without uploading.
- `bun run store:submit` builds and uploads to both stores. It stops first if there are uncommitted changes, a store already has this version, or a built manifest has the wrong version or belongs to the other browser.
- `bun run tag-release` tags the version, pushes the tag and creates the GitHub release.

## Store screenshots

Add a `screenshots` block to `ext-store.config.ts`. It needs `bun add -d playwright` and an MV3 extension (data is seeded through the background service worker).

```ts
import { defineConfig } from "@ajgeel/ext-store";
import { waitForImages } from "@ajgeel/ext-store/screenshots";

export default defineConfig({
  name: "My Extension",
  screenshots: {
    now: new Date("2026-06-20T16:20:00+02:00"), // fixes the page clock
    prepare: async ({ context, worker }) => {
      // Every scene: mock network routes, seed storage.
      await context.route("https://api.example.com/**", (route) =>
        route.fulfill({ json: { hello: "world" } }),
      );
      await worker.evaluate(() => chrome.storage.sync.set({ theme: "light" }));
    },
    ready: async (page) => {
      await page.getByRole("button", { name: "Add" }).waitFor();
    },
    scenes: [
      {
        id: "hero",
        headline: ["A beautiful tab", "that stays out of your way."],
      },
      {
        id: "settings",
        headline: "Make it yours.",
        backdrop: "https://example.com/photo.jpg", // faint image behind the window
        prepare: async ({ worker }) => {}, // seed just this scene
        setup: async (page, stage) => {
          await stage("opening settings", () => page.keyboard.press("s"));
          await stage("loading images", () => waitForImages(page));
        },
      },
    ],
  },
});
```

- `ext-store screenshots setup` runs your `screenshots.setup` hook, e.g. a build into `extensionDir`. Skip it if `dist/chromium` is already built.
- `ext-store screenshots` captures and frames every scene (`--only <id>` for one). Raw captures go to `dist/screenshots/raw`, framed ones to `docs/store-listing/screenshots/1.jpg`, `2.jpg`, ... in scene order.
- `ext-store screenshots upload` replaces the Firefox listing's screenshots, captioned with the headlines. Chrome's API can't change listing images, so it opens the dashboard and the folder for you to drag them in.

Options, all optional: `extensionDir` (default `dist/chromium`), `page` (default: the manifest's new tab or popup), `viewport` (default 1280×640), `locale`, `timezoneId`, `geolocation`, `outputDir`, and `frame` (`title`, `icon`, `accent`, `ink`, or your own `template`, see [`src/lib/frame.html`](src/lib/frame.html)). Every `stage` fails after 30 seconds instead of hanging.

## Credentials

Neither store's API can create a listing: upload the first version by hand, then use `submit` for every update. Put these in `.env` (Bun loads it from the current directory):

```sh
CHROME_PUBLISHER_ID=
CHROME_EXTENSION_ID=
CHROME_CLIENT_ID=
CHROME_CLIENT_SECRET=
CHROME_REFRESH_TOKEN=   # set by ext-store auth

FIREFOX_EXTENSION_ID=
FIREFOX_JWT_ISSUER=
FIREFOX_JWT_SECRET=
```

### Chrome Web Store

Uses the [Chrome Web Store API V2](https://developer.chrome.com/docs/webstore/api) with an OAuth refresh token.

- In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable the **Chrome Web Store API**.
- Under **Google Auth Platform**, set up the consent screen with user type **External**, then under **Audience** click **Publish app**. While it's in **Testing**, refresh tokens expire after 7 days.
- Under **Clients**, create an OAuth client of type **Desktop app**, and put its ID and secret in `.env`.
- Run `ext-store auth` and sign in with the account that owns the listing. Google warns the app isn't verified: choose **Advanced > Go to (app name)**.
- In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/), go to **Publisher > Settings** and copy the publisher ID.

### Firefox Add-ons

Uses [`web-ext sign`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign) to submit a listed version, with the committed source (`git archive HEAD`) attached for reviewers.

- Generate API credentials at [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/en-US/developers/addon/api/key/).

## Configuration

`ext-store.config.ts`:

```ts
import { defineConfig } from "@ajgeel/ext-store";

export default defineConfig({
  name: "My Extension", // shown in the CLI
  // buildCommand: ["bun", "run", "ship"],
  // releaseBranch: "main",
  // checkBuild: ({ store, dir }) => {}, // throw to stop a submission
  // screenshots: { ... },
});
```

## Programmatic use

`@ajgeel/ext-store/firefox` exports `getFirefoxPreviews` and `replaceFirefoxPreviews`. `@ajgeel/ext-store/screenshots` exports `waitForImages` and the `Stage` type. `@ajgeel/ext-store/ui` and `@ajgeel/ext-store/utils` export the CLI helpers.

## License

[MIT](LICENSE): free to use, no warranty. You're responsible for what you submit to the stores.
