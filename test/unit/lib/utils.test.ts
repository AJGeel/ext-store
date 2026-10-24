import { describe, expect, test } from "bun:test";

import {
  compareVersions,
  ensureOk,
  read,
  requireEnv,
} from "../../../src/lib/utils";

describe("compareVersions", () => {
  test.each([
    ["1.4.0", "1.4.0", 0],
    ["1.4", "1.4.0", 0],
    ["1.4.1", "1.4.0", 1],
    ["1.4.0", "1.4.1", -1],
    ["2.0.0", "1.9.9", 1],
    ["0.1.1", "0.1.0", 1],
  ])("compares %s with %s as %d", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  test("compares numbers, not text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  test("treats missing parts as zero", () => {
    expect(compareVersions("1.4.0.1", "1.4")).toBe(1);
    expect(compareVersions("1", "1.0.1")).toBe(-1);
  });
});

describe("requireEnv", () => {
  test("returns the requested variables", () => {
    process.env.EXT_STORE_TEST_A = "a";
    process.env.EXT_STORE_TEST_B = "b";

    expect(requireEnv("EXT_STORE_TEST_A", "EXT_STORE_TEST_B")).toEqual({
      EXT_STORE_TEST_A: "a",
      EXT_STORE_TEST_B: "b",
    });
  });

  test("lists every missing variable at once", () => {
    process.env.EXT_STORE_TEST_SET = "set";
    delete process.env.EXT_STORE_TEST_MISSING_1;
    delete process.env.EXT_STORE_TEST_MISSING_2;

    expect(() =>
      requireEnv(
        "EXT_STORE_TEST_MISSING_1",
        "EXT_STORE_TEST_SET",
        "EXT_STORE_TEST_MISSING_2",
      ),
    ).toThrow(
      "Missing env vars: EXT_STORE_TEST_MISSING_1, EXT_STORE_TEST_MISSING_2. See .env.example.",
    );
  });

  test("treats an empty variable as missing", () => {
    process.env.EXT_STORE_TEST_EMPTY = "";

    expect(() => requireEnv("EXT_STORE_TEST_EMPTY")).toThrow(
      "Missing env vars: EXT_STORE_TEST_EMPTY",
    );
  });
});

describe("ensureOk", () => {
  test("returns a successful response", async () => {
    const response = new Response("fine", { status: 200 });

    expect(await ensureOk(response, "Checking")).toBe(response);
  });

  test("throws with the action, status and body of a failed response", async () => {
    const response = new Response("quota exceeded", { status: 429 });

    await expect(ensureOk(response, "Chrome upload")).rejects.toThrow(
      "Chrome upload failed (429): quota exceeded",
    );
  });
});

describe("read", () => {
  test("returns the trimmed output of a command", async () => {
    expect(await read(["echo", "  hello  "])).toBe("hello");
  });

  test("passes extra environment variables to the command", async () => {
    expect(
      await read(["sh", "-c", "echo $EXT_STORE_TEST_VAR"], {
        EXT_STORE_TEST_VAR: "from-test",
      }),
    ).toBe("from-test");
  });

  test("throws with the command and its error output when it fails", async () => {
    await expect(read(["sh", "-c", "echo oops >&2; exit 3"])).rejects.toThrow(
      "sh -c echo oops >&2; exit 3 failed:\noops",
    );
  });
});
