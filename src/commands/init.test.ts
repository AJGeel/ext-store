import { describe, expect, test } from "bun:test";

import { addScripts, configTemplate } from "./init";

describe("addScripts", () => {
  test("adds missing scripts and keeps existing ones", () => {
    const pkg: { scripts: Record<string, string> } = {
      scripts: { "store:status": "custom" },
    };

    expect(
      addScripts(pkg, {
        "store:status": "ext-store status",
        "tag-release": "x",
      }),
    ).toEqual(["tag-release"]);
    expect(pkg.scripts).toEqual({
      "store:status": "custom",
      "tag-release": "x",
    });
  });

  test("creates the scripts field", () => {
    const pkg: { scripts?: Record<string, string> } = {};

    addScripts(pkg, { a: "b" });
    expect(pkg.scripts).toEqual({ a: "b" });
  });
});

describe("configTemplate", () => {
  test("quotes the name", () => {
    expect(configTemplate('My "Ext"', false)).toContain('name: "My \\"Ext\\""');
  });

  test("only includes screenshots when asked", () => {
    expect(configTemplate("X", false)).not.toContain("screenshots");
    expect(configTemplate("X", true)).toContain("screenshots");
  });
});
