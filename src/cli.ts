#!/usr/bin/env bun
/**
 * Usage:
 *   ext-store status [chrome|firefox]
 *   ext-store submit [chrome|firefox] [--dry-run] [--yes]
 *   ext-store auth
 *   ext-store tag-release [--dry-run] [--yes]
 */
import { auth } from "./auth";
import { release } from "./release";
import { runStore } from "./store";
import { runCli } from "./ui";

const USAGE = "Usage: ext-store status | submit | auth | tag-release";

runCli(async () => {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "status":
    case "submit":
      return await runStore(command, rest);
    case "auth":
      return await auth();
    case "tag-release":
      return await release();
    default:
      throw new Error(USAGE);
  }
});
