/**
 * Renders the store listing screenshots from the built extension: each scene
 * is captured in Chromium, then framed with its headline.
 *
 *   ext-store screenshots setup          runs `screenshots.setup`, e.g. a build
 *   ext-store screenshots [--only <id>]  capture and frame every scene
 *   ext-store screenshots upload         see screenshots-upload.ts
 */
import { mkdir, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { pathToFileURL } from "url";

import { type Scene, type ScreenshotsConfig, loadConfig } from "../config";
import { createStage, withDeadline } from "../lib/playwright";
import { header, p, pc, step } from "../lib/ui";
import { DIST_DIR, ROOT_DIR } from "../lib/utils";

const DEFAULT_VIEWPORT = { width: 1280, height: 640 };
const DEFAULT_ACCENT = "#138cd0";
const DEFAULT_INK = "#020e2c";
const DEFAULT_TEMPLATE = resolve(import.meta.dir, "../lib/frame.html");

export const outputDir = (screenshots: ScreenshotsConfig) =>
  resolve(ROOT_DIR, screenshots.outputDir ?? "docs/store-listing/screenshots");

/** The framed screenshots are numbered in scene order: 1.jpg, 2.jpg, ... */
export const framedFile = (screenshots: ScreenshotsConfig, scene: Scene) =>
  resolve(
    outputDir(screenshots),
    `${screenshots.scenes.indexOf(scene) + 1}.jpg`,
  );

/** The scenes `--only <id>` selects, or all of them. */
export const selectScenes = (scenes: Scene[], args: string[]) => {
  const index = args.indexOf("--only");

  if (index === -1) {
    return scenes;
  }

  const id = args[index + 1];
  const selected = scenes.filter((scene) => scene.id === id);

  if (selected.length === 0) {
    throw new Error(
      `No scene "${id}". Scenes: ${scenes.map((scene) => scene.id).join(", ")}.`,
    );
  }

  return selected;
};

export const headlineLines = (headline: Scene["headline"]) =>
  typeof headline === "string" ? [headline, ""] : headline;

export const getScreenshotsConfig = async () => {
  const { screenshots, ...config } = await loadConfig();

  if (!screenshots?.scenes.length) {
    throw new Error(
      "No screenshots configured. Add `screenshots: { scenes: [...] }` to ext-store.config.ts.",
    );
  }

  return { config, screenshots };
};

const extensionDirOf = (screenshots: ScreenshotsConfig) =>
  resolve(ROOT_DIR, screenshots.extensionDir ?? resolve(DIST_DIR, "chromium"));

/** The page to capture: configured, or the manifest's new tab or popup. */
export const resolvePage = (
  screenshots: ScreenshotsConfig,
  manifest: {
    chrome_url_overrides?: { newtab?: string };
    action?: { default_popup?: string };
  },
) => {
  const page =
    screenshots.page ??
    manifest.chrome_url_overrides?.newtab ??
    manifest.action?.default_popup;

  if (!page) {
    throw new Error(
      "The manifest has no new tab or popup page. Set `screenshots.page`.",
    );
  }

  return page.replace(/^\//, "");
};

const setup = async () => {
  header("Store screenshots: setup");

  const { screenshots } = await getScreenshotsConfig();

  if (!screenshots.setup) {
    throw new Error("No `screenshots.setup` in ext-store.config.ts.");
  }

  await screenshots.setup({ extensionDir: extensionDirOf(screenshots) });
  p.outro(`Ready. Run ${pc.bold("ext-store screenshots")} next.`);
};

type Playwright = typeof import("playwright");

const capture = async (
  { chromium }: Playwright,
  screenshots: ScreenshotsConfig,
  scene: Scene,
  extensionDir: string,
  manifestPage: string,
  update: (message: string) => void,
  file: string,
) => {
  const stage = createStage(scene.id, update);
  const viewport = screenshots.viewport ?? DEFAULT_VIEWPORT;
  const { context, worker, extensionId } = await stage(
    "launching Chromium",
    async () => {
      const profile = await mkdtemp(join(tmpdir(), "ext-store-shots-"));
      const context = await chromium.launchPersistentContext(profile, {
        // Full Chromium: the headless shell can't load extensions.
        channel: "chromium",
        headless: true,
        args: [
          `--disable-extensions-except=${extensionDir}`,
          `--load-extension=${extensionDir}`,
        ],
        viewport,
        deviceScaleFactor: 2,
        geolocation: screenshots.geolocation,
        permissions: screenshots.geolocation ? ["geolocation"] : [],
        timezoneId: screenshots.timezoneId,
        locale: screenshots.locale,
      });
      const worker =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent("serviceworker", { timeout: 15_000 }));

      return { context, worker, extensionId: new URL(worker.url()).host };
    },
  );

  try {
    await stage("seeding", async () => {
      const prepare = { context, worker, extensionId, scene };

      await screenshots.prepare?.(prepare);
      await scene.prepare?.(prepare);
    });

    const page = await context.newPage();

    // Starts at `now` and keeps running, so timers work.
    if (screenshots.now) {
      await page.clock.install({ time: screenshots.now });
    }

    await stage("opening the page", () =>
      page.goto(`chrome-extension://${extensionId}/${manifestPage}`),
    );
    await screenshots.ready?.(page, stage);
    await scene.setup?.(page, stage);

    await stage("settling", async () => {
      // Away from anything hoverable.
      await page.mouse.move(viewport.width - 1, viewport.height / 2);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      await page.waitForTimeout(1200);
    });
    await stage("capturing", () => page.screenshot({ path: file }));
  } finally {
    await withDeadline(context.close(), 10_000, "closing Chromium").catch(
      () => {},
    );
  }
};

const frame = async (
  { chromium }: Playwright,
  name: string,
  screenshots: ScreenshotsConfig,
  scenes: Scene[],
  rawFile: (scene: Scene) => string,
  update: (message: string) => void,
) => {
  const stage = createStage("frame", update);
  const template = pathToFileURL(
    resolve(ROOT_DIR, screenshots.frame?.template ?? DEFAULT_TEMPLATE),
  ).href;
  const { icon } = screenshots.frame ?? {};
  const browser = await stage("launching Chromium", () => chromium.launch());

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });

    for (const scene of scenes) {
      await stage(`framing ${scene.id}`, async () => {
        await page.goto(template);
        await page.evaluate(
          (data) =>
            (
              window as unknown as {
                render: (data: unknown) => Promise<unknown>;
              }
            ).render(data),
          {
            headline: headlineLines(scene.headline),
            // File URLs, not data URLs: a multi-megabyte string can crash the page.
            screen: pathToFileURL(rawFile(scene)).href,
            backdrop: scene.backdrop,
            title: screenshots.frame?.title ?? name,
            icon: icon && pathToFileURL(resolve(ROOT_DIR, icon)).href,
            accent: screenshots.frame?.accent ?? DEFAULT_ACCENT,
            ink: screenshots.frame?.ink ?? DEFAULT_INK,
          },
        );
        await page.screenshot({
          path: framedFile(screenshots, scene),
          type: "jpeg",
          quality: 90,
        });
      });
    }
  } finally {
    // A crashed browser never finishes closing.
    await withDeadline(browser.close(), 10_000, "closing Chromium").catch(
      () => {},
    );
  }
};

const shots = async (args: string[]) => {
  header("Store screenshots");

  const { config, screenshots } = await getScreenshotsConfig();
  const selected = selectScenes(screenshots.scenes, args);
  const extensionDir = extensionDirOf(screenshots);
  const manifestFile = Bun.file(resolve(extensionDir, "manifest.json"));

  if (!(await manifestFile.exists())) {
    throw new Error(
      `No build in ${extensionDir}. ${
        screenshots.setup
          ? `Run ${pc.bold("ext-store screenshots setup")} first.`
          : "Build the extension first."
      }`,
    );
  }

  const manifestPage = resolvePage(screenshots, await manifestFile.json());
  const playwright = await import("playwright").catch(() => {
    throw new Error("Playwright is needed: bun add -d playwright");
  });
  const rawDir = resolve(DIST_DIR, "screenshots/raw");
  const rawFile = (scene: Scene) =>
    resolve(rawDir, `${screenshots.scenes.indexOf(scene) + 1}-${scene.id}.png`);

  await mkdir(rawDir, { recursive: true });
  await mkdir(outputDir(screenshots), { recursive: true });

  for (const scene of selected) {
    await step(
      `Capturing ${scene.id}`,
      (update) =>
        capture(
          playwright,
          screenshots,
          scene,
          extensionDir,
          manifestPage,
          update,
          rawFile(scene),
        ),
      `Captured ${scene.id}`,
    );
  }

  await step(
    "Framing",
    (update) =>
      frame(playwright, config.name, screenshots, selected, rawFile, update),
    "Framed",
  );

  p.outro(
    `${selected.length} screenshots in ${pc.dim(outputDir(screenshots))}`,
  );
};

export const runScreenshots = async (args: string[]) => {
  const [command, ...rest] = args;

  switch (command) {
    case "setup":
      return await setup();
    case "upload": {
      const { upload } = await import("./screenshots-upload");

      return await upload(rest);
    }
    default:
      return await shots(args);
  }
};
