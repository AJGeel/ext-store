import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { verify } from "jsonwebtoken";

import { getFirefoxStatus } from "../../../src/stores/firefox";

const ENV = {
  FIREFOX_EXTENSION_ID: "me@example.com",
  FIREFOX_JWT_ISSUER: "user:123:456",
  FIREFOX_JWT_SECRET: "jwt-secret",
};

type Call = { url: string; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let calls: Call[];

const version = (number: string, status: string) => ({
  version: number,
  file: { status },
});

/** Answers with `versions`, newest first, as AMO does. */
const mockAmo = (versions: unknown[], statusCode = 200) => {
  calls = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(url), init });

    return Response.json({ results: versions }, { status: statusCode });
  }) as typeof fetch;
};

beforeEach(() => {
  Object.assign(process.env, ENV);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("getFirefoxStatus", () => {
  test("has no pending version when the newest one is public", async () => {
    mockAmo([version("2.0.0", "public"), version("1.5.0", "public")]);

    expect(await getFirefoxStatus()).toEqual({
      live: "2.0.0",
      pending: undefined,
    });
  });

  test("reads a newer version that isn't public as pending", async () => {
    mockAmo([version("2.0.1", "unreviewed"), version("2.0.0", "public")]);

    expect(await getFirefoxStatus()).toEqual({
      live: "2.0.0",
      pending: { version: "2.0.1", state: "unreviewed" },
    });
  });

  test("shows the newest public version as live, not the newest overall", async () => {
    mockAmo([
      version("3.0.0", "disabled"),
      version("2.0.0", "public"),
      version("1.0.0", "public"),
    ]);

    expect(await getFirefoxStatus()).toEqual({
      live: "2.0.0",
      pending: { version: "3.0.0", state: "disabled" },
    });
  });

  test("has no live version before the first approval", async () => {
    mockAmo([version("0.1.0", "unreviewed")]);

    expect(await getFirefoxStatus()).toEqual({
      live: undefined,
      pending: { version: "0.1.0", state: "unreviewed" },
    });
  });

  test("handles an add-on without versions", async () => {
    mockAmo([]);

    expect(await getFirefoxStatus()).toEqual({
      live: undefined,
      pending: undefined,
    });
  });

  test("asks AMO for the add-on's versions with a signed token", async () => {
    mockAmo([]);

    await getFirefoxStatus();

    const [{ url, init }] = calls;
    const { Authorization } = init?.headers as Record<string, string>;
    const claims = verify(Authorization.replace("JWT ", ""), "jwt-secret", {
      algorithms: ["HS256"],
    }) as { iss: string; jti: string };

    expect(url).toBe(
      "https://addons.mozilla.org/api/v5/addons/addon/me%40example.com/versions/?filter=all_with_unlisted&page_size=10",
    );
    expect(Authorization.startsWith("JWT ")).toBe(true);
    expect(claims.iss).toBe("user:123:456");
    expect(claims.jti).toBeTruthy();
  });

  test("throws with the response when AMO rejects the request", async () => {
    mockAmo([], 401);

    await expect(getFirefoxStatus()).rejects.toThrow(
      "Firefox status check failed (401)",
    );
  });

  test("lists the missing credentials", async () => {
    delete process.env.FIREFOX_JWT_ISSUER;
    delete process.env.FIREFOX_JWT_SECRET;

    await expect(getFirefoxStatus()).rejects.toThrow(
      "Missing env vars: FIREFOX_JWT_ISSUER, FIREFOX_JWT_SECRET",
    );
  });
});
