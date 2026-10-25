import { describe, expect, test } from "bun:test";

import type { Scene } from "../config";
import { headlineLines, resolvePage, selectScenes } from "./screenshots";

const scenes: Scene[] = [
  { id: "hero", headline: "Hello" },
  { id: "picker", headline: ["One", "Two"] },
];

describe("selectScenes", () => {
  test("returns every scene without --only", () => {
    expect(selectScenes(scenes, [])).toEqual(scenes);
  });

  test("returns the scene --only names", () => {
    expect(selectScenes(scenes, ["--only", "picker"])).toEqual([scenes[1]]);
  });

  test("lists the scenes when --only is unknown", () => {
    expect(() => selectScenes(scenes, ["--only", "nope"])).toThrow(
      'No scene "nope". Scenes: hero, picker.',
    );
  });
});

describe("headlineLines", () => {
  test("gives a single line an empty accent line", () => {
    expect(headlineLines("Hello")).toEqual(["Hello", ""]);
  });

  test("keeps two lines", () => {
    expect(headlineLines(["One", "Two"])).toEqual(["One", "Two"]);
  });
});

describe("resolvePage", () => {
  test("prefers the configured page", () => {
    expect(
      resolvePage(
        { scenes, page: "app.html" },
        { chrome_url_overrides: { newtab: "newtab.html" } },
      ),
    ).toBe("app.html");
  });

  test("falls back to the new tab, then the popup", () => {
    expect(
      resolvePage({ scenes }, { chrome_url_overrides: { newtab: "/n.html" } }),
    ).toBe("n.html");
    expect(
      resolvePage({ scenes }, { action: { default_popup: "popup.html" } }),
    ).toBe("popup.html");
  });

  test("asks for a page when the manifest has none", () => {
    expect(() => resolvePage({ scenes }, {})).toThrow("screenshots.page");
  });
});
