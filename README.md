# @ajgeel/ext-store

Submits a browser extension to the Chrome Web Store and Firefox Add-ons, with one command. Requires [Bun](https://bun.sh/): the package ships TypeScript source and uses Bun APIs, so it does not run on Node alone.

The command is `ext-store`.

```sh
ext-store status [chrome|firefox]   # versions live and in review
ext-store submit [chrome|firefox] [--dry-run] [--yes]
ext-store auth                      # get the Chrome refresh token
ext-store tag-release [--dry-run] [--yes]
```

`submit` stops before uploading if there are uncommitted changes, a store already has the version in `package.json`, or a built manifest has the wrong version or belongs to the other browser.

## Setup

```sh
bun add -d @ajgeel/ext-store web-ext
```

Add the scripts you want to `package.json`, e.g. `"store:submit": "ext-store submit"`, and create `ext-store.config.ts`:

```ts
import { defineConfig } from "@ajgeel/ext-store";

export default defineConfig({
  name: "My Extension",
  // buildCommand: ["bun", "run", "ship"],
  // releaseBranch: "main",
  // checkBuild: ({ store, dir }) => {},
});
```

## What the extension repo provides

- `dist/chromium/` and `dist/firefox/`, plus `dist/chromium.zip` and `dist/firefox.zip`, as produced by `buildCommand`. The Firefox manifest needs `browser_specific_settings.gecko.id`, the Chrome one must not have `browser_specific_settings`.
- A `CHANGELOG.md` with `## [V<version>]` sections, for `tag-release`.
- A `.env` with the credentials below (Bun loads it from the current directory).

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

## Credentials

Neither store's API can create a listing: upload the first version by hand, then use `submit` for every update.

### Chrome Web Store

Uses the [Chrome Web Store API V2](https://developer.chrome.com/docs/webstore/api) with an OAuth refresh token.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable the **Chrome Web Store API**.
2. Under **Google Auth Platform**, set up the consent screen with user type **External**, then under **Audience** click **Publish app**. While it's in **Testing**, refresh tokens expire after 7 days.
3. Under **Clients**, create an OAuth client of type **Desktop app**, and put its ID and secret in `.env`.
4. Run `ext-store auth` and sign in with the account that owns the listing. Google warns the app isn't verified: choose **Advanced > Go to (app name)**.
5. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/), go to **Publisher > Settings** and copy the publisher ID.

### Firefox Add-ons

Uses [`web-ext sign`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign) to submit a listed version, with the committed source (`git archive HEAD`) attached for reviewers. Generate API credentials at [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/en-US/developers/addon/api/key/).

## Programmatic use

`@ajgeel/ext-store/firefox` exports `getFirefoxPreviews` and `replaceFirefoxPreviews` for managing listing screenshots. `@ajgeel/ext-store/ui` and `@ajgeel/ext-store/utils` export the CLI helpers.

## License

[MIT](LICENSE): free to use, no warranty. You're responsible for what you submit to the stores.
