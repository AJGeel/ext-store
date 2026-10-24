import { describe, expect, test } from "bun:test";

import { extractReleaseNotes } from "../../../src/commands/release";

const CHANGELOG = `# Changelog

## [V1.2.0] — 2026-02-01

### ✨ Added

- A new thing.
  - With a sub-point.

### 🐛 Fixed

- A bug.

## [V1.1.0] — 2026-01-01

- Older release.

## [V1.0.0] — 2025-12-01

- First release.
`;

describe("extractReleaseNotes", () => {
  test("returns the section up to the next release heading", () => {
    expect(extractReleaseNotes(CHANGELOG, "V1.2.0")).toBe(
      [
        "### ✨ Added",
        "",
        "- A new thing.",
        "  - With a sub-point.",
        "",
        "### 🐛 Fixed",
        "",
        "- A bug.",
      ].join("\n"),
    );
  });

  test("returns a middle section without its neighbours", () => {
    expect(extractReleaseNotes(CHANGELOG, "V1.1.0")).toBe("- Older release.");
  });

  test("returns the last section to the end of the file", () => {
    expect(extractReleaseNotes(CHANGELOG, "V1.0.0")).toBe("- First release.");
  });

  test("throws when the version has no section", () => {
    expect(() => extractReleaseNotes(CHANGELOG, "V9.9.9")).toThrow(
      'CHANGELOG.md has no "## [V9.9.9]" section.',
    );
  });

  test("doesn't match a version that only starts the same", () => {
    expect(() => extractReleaseNotes(CHANGELOG, "V1.2")).toThrow(
      'CHANGELOG.md has no "## [V1.2]" section.',
    );
  });

  test("matches the tag's prefix exactly", () => {
    expect(() => extractReleaseNotes(CHANGELOG, "v1.2.0")).toThrow(
      'CHANGELOG.md has no "## [v1.2.0]" section.',
    );
  });

  test("returns an empty string for an empty section", () => {
    expect(
      extractReleaseNotes("## [V1.0.0]\n\n## [V0.9.0]\n- Old", "V1.0.0"),
    ).toBe("");
  });
});
