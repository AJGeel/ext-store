import type { BrowserContext, Page, Worker } from "playwright";
import { existsSync } from "fs";
import { resolve } from "path";

import { ROOT_DIR } from "./lib/utils";

/** Reports what a scene is doing, and fails it if a stage takes too long. */
export type Stage = <T>(
  label: string,
  task: () => Promise<T>,
  timeoutMs?: number,
) => Promise<T>;

/** What `prepare` hooks get, before the extension page opens. */
export type PrepareContext = {
  context: BrowserContext;
  /** The extension's background service worker: seed storage through `worker.evaluate`. */
  worker: Worker;
  extensionId: string;
  scene: Scene;
};

export type Scene = {
  /** Names the raw capture, and selects the scene with `--only`. */
  id: string;
  /** Shown above the window; with two lines, the second is drawn in the accent colour. */
  headline: string | [string, string];
  /** Image (URL or file path) shown faint behind the window. */
  backdrop?: string;
  /** Seeds this scene's data, after `screenshots.prepare`. */
  prepare?: (prepare: PrepareContext) => Promise<void>;
  /** Brings the loaded page into the state to capture, one named stage at a time. */
  setup?: (page: Page, stage: Stage) => Promise<void>;
};

export type ScreenshotsConfig = {
  scenes: Scene[];
  /** The unpacked Chrome build. Defaults to `dist/chromium`. */
  extensionDir?: string;
  /**
   * The extension page to capture, relative to the build. Defaults to the
   * manifest's new tab override or popup.
   */
  page?: string;
  /** Runs for `ext-store screenshots setup`, e.g. a build into `extensionDir`. */
  setup?: (setup: { extensionDir: string }) => Promise<void>;
  /** Seeds data for every scene: storage, mocked network routes, ... */
  prepare?: (prepare: PrepareContext) => Promise<void>;
  /** Waits until the opened page is done loading. */
  ready?: (page: Page, stage: Stage) => Promise<void>;
  /** The browser window that's captured. Defaults to 1280x640. */
  viewport?: { width: number; height: number };
  /** Fixes the page clock (it keeps running), so dates are the same every run. */
  now?: Date;
  locale?: string;
  timezoneId?: string;
  geolocation?: { latitude: number; longitude: number };
  /** Where the framed screenshots go. Defaults to `docs/store-listing/screenshots`. */
  outputDir?: string;
  frame?: {
    /** Replaces the built-in template, see `src/lib/frame.html` for what it receives. */
    template?: string;
    /** The tab's title. Defaults to `name`. */
    title?: string;
    /** The tab's icon, a file path. */
    icon?: string;
    /** The second headline line. Defaults to `#138cd0`. */
    accent?: string;
    /** The headline. Defaults to `#020e2c`. */
    ink?: string;
  };
};

export type ExtStoreConfig = {
  /** Store listing screenshots: `ext-store screenshots`. */
  screenshots?: ScreenshotsConfig;
  /** Shown in the CLI headers, e.g. "UpTab". */
  name: string;
  /**
   * Builds and zips `dist/chromium(.zip)` and `dist/firefox(.zip)`.
   * Defaults to `bun run ship`.
   */
  buildCommand?: string[];
  /** Extra checks on a finished build. Throw to stop the submission. */
  checkBuild?: (build: {
    store: "chrome" | "firefox";
    dir: string;
  }) => void | Promise<void>;
  /** The branch releases are tagged on. Defaults to `main`. */
  releaseBranch?: string;
};

export const CONFIG_FILE = "ext-store.config.ts";

export const defineConfig = (config: ExtStoreConfig) => config;

/** Loads `ext-store.config.ts` from the extension repo the CLI runs in. */
export const loadConfig = async (): Promise<
  Required<Pick<ExtStoreConfig, "buildCommand" | "releaseBranch">> &
    ExtStoreConfig
> => {
  const path = resolve(ROOT_DIR, CONFIG_FILE);

  if (!existsSync(path)) {
    throw new Error(`No ${CONFIG_FILE} found in ${ROOT_DIR}.`);
  }

  const { default: config } = (await import(path)) as {
    default: ExtStoreConfig;
  };

  return {
    buildCommand: ["bun", "run", "ship"],
    releaseBranch: "main",
    ...config,
  };
};
