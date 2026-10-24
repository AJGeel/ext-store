import { describe, expect, test } from "bun:test";

import { describeStatus, findConflictingVersion } from "./store";

/** Strips colour codes, so the tests don't depend on the terminal. */
// eslint-disable-next-line no-control-regex
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

describe("describeStatus", () => {
  test("shows a store without any version", () => {
    expect(plain(describeStatus({}))).toBe("live none");
  });

  test("shows the live version", () => {
    expect(plain(describeStatus({ live: "1.2.0" }))).toBe("live 1.2.0");
  });

  test("shows the version in review with its state", () => {
    expect(
      plain(
        describeStatus({
          live: "1.2.0",
          pending: { version: "1.3.0", state: "PENDING_REVIEW" },
        }),
      ),
    ).toBe("live 1.2.0 · in review 1.3.0 (PENDING_REVIEW)");
  });

  test("shows a pending version in a store that has no live one yet", () => {
    expect(
      plain(describeStatus({ pending: { version: "0.1.0", state: "STAGED" } })),
    ).toBe("live none · in review 0.1.0 (STAGED)");
  });
});

describe("findConflictingVersion", () => {
  test("allows a first version", () => {
    expect(findConflictingVersion("0.1.0", {})).toBeUndefined();
  });

  test("allows a version newer than the live one", () => {
    expect(findConflictingVersion("1.3.0", { live: "1.2.0" })).toBeUndefined();
  });

  test("blocks the live version", () => {
    expect(findConflictingVersion("1.2.0", { live: "1.2.0" })).toBe("1.2.0");
  });

  test("blocks a version older than the live one", () => {
    expect(findConflictingVersion("1.1.0", { live: "1.2.0" })).toBe("1.2.0");
  });

  test("blocks a version that is already in review", () => {
    expect(
      findConflictingVersion("1.3.0", {
        live: "1.2.0",
        pending: { version: "1.3.0", state: "PENDING_REVIEW" },
      }),
    ).toBe("1.3.0");
  });

  test("allows a newer version than the one in review", () => {
    expect(
      findConflictingVersion("1.4.0", {
        live: "1.2.0",
        pending: { version: "1.3.0", state: "PENDING_REVIEW" },
      }),
    ).toBeUndefined();
  });

  test.each(["REJECTED", "CANCELLED", "disabled"])(
    "allows resubmitting a version whose review ended as %s",
    (state) => {
      expect(
        findConflictingVersion("1.3.0", {
          live: "1.2.0",
          pending: { version: "1.3.0", state },
        }),
      ).toBeUndefined();
    },
  );

  test("still blocks the live version when the pending one was rejected", () => {
    expect(
      findConflictingVersion("1.2.0", {
        live: "1.2.0",
        pending: { version: "1.3.0", state: "REJECTED" },
      }),
    ).toBe("1.2.0");
  });
});
