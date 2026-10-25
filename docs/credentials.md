# Credentials

Neither store's API can create a listing: upload the first version by hand, then use `submit` for every update. Put these in `.env`:

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

## Chrome Web Store

Uses the [Chrome Web Store API V2](https://developer.chrome.com/docs/webstore/api) with an OAuth refresh token.

- In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable the **Chrome Web Store API**.
- Under **Google Auth Platform**, set up the consent screen with user type **External**, then under **Audience** click **Publish app**. While it's in **Testing**, refresh tokens expire after 7 days.
- Under **Clients**, create an OAuth client of type **Desktop app**, and put its ID and secret in `.env`.
- Run `ext-store auth` and sign in with the account that owns the listing. Google warns the app isn't verified: choose **Advanced > Go to (app name)**.
- In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/), go to **Publisher > Settings** and copy the publisher ID.

## Firefox Add-ons

- Generate API credentials at [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/en-US/developers/addon/api/key/).
