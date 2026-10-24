import { existsSync } from "fs";
import { resolve } from "path";

import { ROOT_DIR } from "./lib/utils";

export type ExtStoreConfig = {
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
