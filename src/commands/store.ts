/**
 * Shows the status of, and submits to, the Chrome Web Store and Firefox Add-ons.
 * Without a store argument, both stores are used.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { getChromeStatus, submitToChrome } from "../stores/chrome";
import { ExtStoreConfig, loadConfig } from "../config";
import { getFirefoxStatus, submitToFirefox } from "../stores/firefox";
import { StoreStatus } from "../stores/types";
import { confirmOrExit, header, p, pc, runTask, step } from "../lib/ui";
import { DIST_DIR, ROOT_DIR, compareVersions, read } from "../lib/utils";

type Store = {
  name: string;
  buildDir: string;
  getStatus: () => Promise<StoreStatus>;
  submit: () => Promise<void>;
  /** Checks the built manifest is the one meant for this store. */
  isExpectedManifest: (manifest: Manifest) => boolean;
};

type Manifest = {
  version: string;
  browser_specific_settings?: { gecko?: { id?: string } };
};

/** A pending submission in one of these states doesn't block a resubmit. */
const RETRYABLE_STATES = ["REJECTED", "CANCELLED", "disabled"];

const STORES: Record<string, Store> = {
  chrome: {
    name: "Chrome",
    buildDir: resolve(DIST_DIR, "chromium"),
    getStatus: getChromeStatus,
    submit: () => submitToChrome(resolve(DIST_DIR, "chromium.zip")),
    isExpectedManifest: (manifest) => !manifest.browser_specific_settings,
  },
  firefox: {
    name: "Firefox",
    buildDir: resolve(DIST_DIR, "firefox"),
    getStatus: getFirefoxStatus,
    submit: () => submitToFirefox(resolve(DIST_DIR, "firefox")),
    isExpectedManifest: (manifest) =>
      Boolean(manifest.browser_specific_settings?.gecko?.id),
  },
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));

const NAME_WIDTH = 9;

export const describeStatus = ({ live, pending }: StoreStatus) =>
  [
    `live ${live ? pc.green(live) : pc.dim("none")}`,
    pending
      ? `${pc.dim("·")} in review ${pc.yellow(pending.version)} ${pc.dim(`(${pending.state})`)}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");

const formatRow = (store: Store, details: string) =>
  `${pc.bold(store.name.padEnd(NAME_WIDTH))}${details}`;

/** The store's version that `version` doesn't beat, if any. */
export const findConflictingVersion = (
  version: string,
  status: StoreStatus,
) => {
  const blockingPending =
    status.pending && !RETRYABLE_STATES.includes(status.pending.state)
      ? status.pending.version
      : undefined;

  return [status.live, blockingPending].find(
    (existing) => existing && compareVersions(version, existing) <= 0,
  );
};

const assertCleanWorkingTree = async () => {
  if (await read(["git", "status", "--porcelain"])) {
    throw new Error(
      "Commit or stash your changes first, so the build and source upload match a commit.",
    );
  }
};

const assertBuild = async (
  store: Store,
  version: string,
  config: ExtStoreConfig,
) => {
  const manifest = readJson<Manifest>(resolve(store.buildDir, "manifest.json"));

  if (manifest.version !== version) {
    throw new Error(
      `${store.name} build has version ${manifest.version}, expected ${version}.`,
    );
  }

  if (!store.isExpectedManifest(manifest)) {
    throw new Error(`${store.name} build has the wrong manifest.`);
  }

  await config.checkBuild?.({
    dir: store.buildDir,
    store: store === STORES.chrome ? "chrome" : "firefox",
  });
};

const status = async (stores: Store[]) => {
  const { name } = await loadConfig();

  header(`${name} · Store status`);

  const results = await step(
    "Asking the stores",
    () => Promise.allSettled(stores.map((store) => store.getStatus())),
    "Stores checked",
  );

  const rows = results.map((result, i) =>
    formatRow(
      stores[i],
      result.status === "fulfilled"
        ? describeStatus(result.value)
        : pc.red(result.reason.message),
    ),
  );

  p.note(rows.join("\n"), "Versions");
  p.outro(pc.dim("Run ext-store submit to ship the next version"));
};

const submit = async (stores: Store[], isDryRun: boolean) => {
  const config = await loadConfig();
  const { version } = readJson<{ version: string }>(
    resolve(ROOT_DIR, "package.json"),
  );
  const storeNames = stores.map((store) => store.name).join(" and ");

  header(
    isDryRun
      ? `${config.name} · Store submit (dry run)`
      : `${config.name} · Store submit`,
  );
  p.log.info(`Shipping version ${pc.cyan(pc.bold(version))} to ${storeNames}`);

  await step(
    "Checking for uncommitted changes",
    assertCleanWorkingTree,
    "Working tree is clean",
  );

  const statuses = await step(
    "Asking the stores",
    () => Promise.all(stores.map((store) => store.getStatus())),
    "Stores checked",
  );
  const conflicts = statuses.map((storeStatus) =>
    findConflictingVersion(version, storeStatus),
  );

  p.note(
    stores
      .map((store, i) =>
        formatRow(
          store,
          `${describeStatus(statuses[i])}  ${
            conflicts[i]
              ? pc.red(`✗ already has ${conflicts[i]}`)
              : pc.cyan(`→ ${version}`)
          }`,
        ),
      )
      .join("\n"),
    "Versions",
  );

  const conflict = conflicts.findIndex(Boolean);

  if (conflict !== -1) {
    throw new Error(
      `${stores[conflict].name} already has ${conflicts[conflict]}. Bump "version" in package.json.`,
    );
  }

  await runTask("Building Chrome and Firefox packages", config.buildCommand);
  await step(
    "Checking the builds",
    async () => {
      for (const store of stores) {
        await assertBuild(store, version, config);
      }
    },
    `Builds are version ${version}, with the right manifest`,
  );

  if (isDryRun) {
    p.outro(pc.green(`Dry run passed · ready to submit ${version} 🚀`));
    return;
  }

  await confirmOrExit(`Submit ${version} to ${storeNames}?`);

  for (const store of stores) {
    p.log.step(pc.bold(`${store.name}`));
    await store.submit();
  }

  p.outro(
    `🚀 ${pc.green(`${version} submitted to ${storeNames}`)} ${pc.dim("· track the review with ext-store status")}`,
  );
};

export const runStore = async (command: string, rest: string[]) => {
  const isDryRun = rest.includes("--dry-run");
  const names = rest.filter((arg) => !arg.startsWith("--"));
  const unknown = names.filter((name) => !STORES[name]);

  if (unknown.length > 0) {
    throw new Error(
      `Unknown store: ${unknown.join(", ")}. Use chrome or firefox.`,
    );
  }

  const stores = (names.length > 0 ? names : Object.keys(STORES)).map(
    (name) => STORES[name],
  );

  switch (command) {
    case "status":
      return await status(stores);
    case "submit":
      return await submit(stores, isDryRun);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
};
