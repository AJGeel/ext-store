/**
 * Sets up an extension repo: writes ext-store.config.ts, adds the package.json
 * scripts, and adds a .env.example (with .env in .gitignore). Never overwrites.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { CONFIG_FILE } from "../config";
import { header, p, pc } from "../lib/ui";
import { ROOT_DIR } from "../lib/utils";

const SCRIPTS = {
  "store:auth": "ext-store auth",
  "store:status": "ext-store status",
  "store:submit": "ext-store submit",
  "tag-release": "ext-store tag-release",
};

const SCREENSHOT_SCRIPTS = {
  "store:shots": "ext-store screenshots",
  "store:shots:upload": "ext-store screenshots upload",
};

export const ENV_EXAMPLE = `CHROME_PUBLISHER_ID=
CHROME_EXTENSION_ID=
CHROME_CLIENT_ID=
CHROME_CLIENT_SECRET=
CHROME_REFRESH_TOKEN= # set by ext-store auth

FIREFOX_EXTENSION_ID=
FIREFOX_JWT_ISSUER=
FIREFOX_JWT_SECRET=
`;

export const configTemplate = (name: string, withScreenshots: boolean) =>
  `import { defineConfig } from "@ajgeel/ext-store";

export default defineConfig({
  name: ${JSON.stringify(name)},
  // buildCommand: ["bun", "run", "ship"],
  // releaseBranch: "main",${
    withScreenshots
      ? `
  screenshots: {
    scenes: [
      { id: "hero", headline: ["Your headline", "and a second line."] },
    ],
  },`
      : ""
  }
});
`;

/** Adds the scripts that aren't there yet, and returns which were added. */
export const addScripts = (
  pkg: { scripts?: Record<string, string> },
  scripts: Record<string, string>,
) => {
  pkg.scripts ??= {};

  const added = Object.keys(scripts).filter((name) => !(name in pkg.scripts!));

  for (const name of added) {
    pkg.scripts[name] = scripts[name];
  }

  return added;
};

const cancelled = <T>(value: T | symbol): T => {
  if (p.isCancel(value)) {
    p.cancel("Cancelled. Nothing was changed.");
    process.exit(0);
  }

  return value as T;
};

export const init = async () => {
  header("ext-store · Setup");

  const pkgFile = resolve(ROOT_DIR, "package.json");

  if (!existsSync(pkgFile)) {
    throw new Error(`No package.json in ${ROOT_DIR}. Run this in your repo.`);
  }

  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  const interactive = !process.argv.includes("--yes") && process.stdin.isTTY;
  const fallbackName = pkg.displayName ?? pkg.name ?? "My Extension";
  const name = interactive
    ? cancelled<string>(
        await p.text({
          message: "What's the extension called?",
          initialValue: fallbackName,
        }),
      )
    : fallbackName;
  const withScreenshots = interactive
    ? cancelled<boolean>(
        await p.confirm({
          message: "Set up store screenshots too?",
          initialValue: false,
        }),
      )
    : false;
  const done: string[] = [];
  const configFile = resolve(ROOT_DIR, CONFIG_FILE);

  if (existsSync(configFile)) {
    p.log.info(`${CONFIG_FILE} already exists, left as it is.`);
  } else {
    writeFileSync(configFile, configTemplate(name, withScreenshots));
    done.push(`Created ${CONFIG_FILE}`);
  }

  const added = addScripts(pkg, {
    ...SCRIPTS,
    ...(withScreenshots ? SCREENSHOT_SCRIPTS : {}),
  });

  if (added.length > 0) {
    writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    done.push(`Added scripts to package.json: ${added.join(", ")}`);
  }

  const envExample = resolve(ROOT_DIR, ".env.example");

  if (!existsSync(envExample)) {
    writeFileSync(envExample, ENV_EXAMPLE);
    done.push("Created .env.example");
  }

  const gitignore = resolve(ROOT_DIR, ".gitignore");
  const ignored = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";

  if (!/^\.env$/m.test(ignored)) {
    writeFileSync(
      gitignore,
      `${ignored}${ignored && !ignored.endsWith("\n") ? "\n" : ""}.env\n`,
    );
    done.push("Added .env to .gitignore");
  }

  p.log.success(done.length > 0 ? done.join("\n") : "Already set up.");
  p.note(
    [
      "1. bun add -d @ajgeel/ext-store web-ext" +
        (withScreenshots ? " playwright" : ""),
      "2. cp .env.example .env, then fill in the store credentials",
      "   (the README says where to find each one)",
      "3. Upload the first version of each listing by hand: the store APIs can't",
      "4. bun run store:auth to get the Chrome refresh token",
      "5. bun run store:status to check everything is connected",
    ].join("\n"),
    "Next steps",
  );
  p.outro(`Ready. ${pc.dim("Submit with")} ${pc.bold("bun run store:submit")}`);
};
