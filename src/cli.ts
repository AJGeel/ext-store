#!/usr/bin/env bun
/**
 * Usage:
 *   ext-store init [--yes]
 *   ext-store status [chrome|firefox]
 *   ext-store submit [chrome|firefox] [--dry-run] [--yes]
 *   ext-store auth
 *   ext-store tag-release [--dry-run] [--yes]
 *   ext-store screenshots [setup|upload] [--only <id>] [--dry-run] [--yes]
 */
import { auth } from "./commands/auth";
import { init } from "./commands/init";
import { release } from "./commands/release";
import { runScreenshots } from "./commands/screenshots";
import { runStore } from "./commands/store";
import { runCli } from "./lib/ui";

const USAGE =
  "Usage: ext-store init | status | submit | auth | tag-release | screenshots";

runCli(async () => {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "init":
      return await init();
    case "status":
    case "submit":
      return await runStore(command, rest);
    case "auth":
      return await auth();
    case "tag-release":
      return await release();
    case "screenshots":
      return await runScreenshots(rest);
    default:
      throw new Error(USAGE);
  }
});
