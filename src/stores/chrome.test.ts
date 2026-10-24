import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { getChromeStatus } from "./chrome";

const ENV = {
  CHROME_PUBLISHER_ID: "publisher-1",
  CHROME_EXTENSION_ID: "extension-1",
  CHROME_CLIENT_ID: "client-id",
  CHROME_CLIENT_SECRET: "client-secret",
  CHROME_REFRESH_TOKEN: "refresh-token",
};

type Call = { url: string; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let calls: Call[];

/** Answers the token request, then the status request with `status`. */
const mockChrome = (status: unknown, statusResponse = 200) => {
  calls = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(url), init });

    if (String(url).startsWith("https://oauth2.googleapis.com")) {
      return Response.json({ access_token: "access-token" });
    }

    return Response.json(status, { status: statusResponse });
  }) as typeof fetch;
};

beforeEach(() => {
  Object.assign(process.env, ENV);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("getChromeStatus", () => {
  test("reads the live and pending versions", async () => {
    mockChrome({
      publishedItemRevisionStatus: {
        state: "PUBLISHED",
        distributionChannels: [{ crxVersion: "1.5.1", deployPercentage: 100 }],
      },
      submittedItemRevisionStatus: {
        state: "PENDING_REVIEW",
        distributionChannels: [{ crxVersion: "2.0.0", deployPercentage: 100 }],
      },
    });

    expect(await getChromeStatus()).toEqual({
      live: "1.5.1",
      pending: { version: "2.0.0", state: "PENDING_REVIEW" },
    });
  });

  test("has no pending version when nothing is in review", async () => {
    mockChrome({
      publishedItemRevisionStatus: {
        state: "PUBLISHED",
        distributionChannels: [{ crxVersion: "1.5.1", deployPercentage: 100 }],
      },
    });

    expect(await getChromeStatus()).toEqual({
      live: "1.5.1",
      pending: undefined,
    });
  });

  test("has no live version before the first publish", async () => {
    mockChrome({
      submittedItemRevisionStatus: {
        state: "PENDING_REVIEW",
        distributionChannels: [{ crxVersion: "0.1.0", deployPercentage: 100 }],
      },
    });

    expect(await getChromeStatus()).toEqual({
      live: undefined,
      pending: { version: "0.1.0", state: "PENDING_REVIEW" },
    });
  });

  test("ignores a submission without a version", async () => {
    mockChrome({ submittedItemRevisionStatus: { state: "CANCELLED" } });

    expect((await getChromeStatus()).pending).toBeUndefined();
  });

  test("exchanges the refresh token, then asks for the item's status", async () => {
    mockChrome({});

    await getChromeStatus();

    const [token, status] = calls;
    const body = token.init?.body as URLSearchParams;

    expect(token.url).toBe("https://oauth2.googleapis.com/token");
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-token");
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");

    expect(status.url).toBe(
      "https://chromewebstore.googleapis.com/v2/publishers/publisher-1/items/extension-1:fetchStatus",
    );
    expect(status.init?.headers).toEqual({
      Authorization: "Bearer access-token",
    });
  });

  test("points to ext-store auth when the refresh token is rejected", async () => {
    globalThis.fetch = (async () =>
      new Response("invalid_grant", {
        status: 400,
      })) as unknown as typeof fetch;

    await expect(getChromeStatus()).rejects.toThrow(
      'Chrome refresh token was rejected: invalid_grant\nRun "ext-store auth" to get a new one.',
    );
  });

  test("throws with the response when the status request fails", async () => {
    mockChrome("item not found", 404);

    await expect(getChromeStatus()).rejects.toThrow(
      "Chrome status check failed (404)",
    );
  });

  test("lists the missing credentials", async () => {
    delete process.env.CHROME_CLIENT_SECRET;
    delete process.env.CHROME_REFRESH_TOKEN;

    await expect(getChromeStatus()).rejects.toThrow(
      "Missing env vars: CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN",
    );
  });
});
