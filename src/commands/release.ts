/**
 * Tags the current version on the release branch, pushes the tag and creates a
 * GitHub release with the matching CHANGELOG.md section as release notes.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { loadConfig } from "../config";
import { confirmOrExit, header, p, pc, step } from "../lib/ui";
import { ROOT_DIR, read } from "../lib/utils";

/** Returns the lines under `## [V1.2.3]`, up to the next release heading. */
export const extractReleaseNotes = (changelog: string, tag: string) => {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${tag}]`));

  if (start === -1) {
    throw new Error(`CHANGELOG.md has no "## [${tag}]" section.`);
  }

  const end = lines.findIndex(
    (line, i) => i > start && line.startsWith("## ["),
  );

  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
};

export const getReleaseNotes = (tag: string) =>
  extractReleaseNotes(
    readFileSync(resolve(ROOT_DIR, "CHANGELOG.md"), "utf8"),
    tag,
  );

const assertReadyToTag = async (tag: string, releaseBranch: string) => {
  if ((await read(["git", "branch", "--show-current"])) !== releaseBranch) {
    throw new Error(`Switch to ${releaseBranch} first.`);
  }

  if (await read(["git", "status", "--porcelain"])) {
    throw new Error("Commit or stash your changes first.");
  }

  await read(["git", "fetch", "--quiet", "--tags", "origin", releaseBranch]);

  const [head, remoteHead] = await Promise.all([
    read(["git", "rev-parse", "HEAD"]),
    read(["git", "rev-parse", `origin/${releaseBranch}`]),
  ]);

  if (head !== remoteHead) {
    throw new Error(
      `Local ${releaseBranch} doesn't match origin/${releaseBranch}. Pull or push first.`,
    );
  }

  if (await read(["git", "tag", "--list", tag])) {
    throw new Error(`Tag ${tag} already exists.`);
  }
};

export const release = async () => {
  const { name, releaseBranch } = await loadConfig();
  const isDryRun = process.argv.includes("--dry-run");
  const { version } = JSON.parse(
    readFileSync(resolve(ROOT_DIR, "package.json"), "utf8"),
  );
  const tag = `V${version}`;

  header(isDryRun ? `${name} · Release (dry run)` : `${name} · Release`);

  await step(
    `Checking ${releaseBranch} is clean and up to date`,
    () => assertReadyToTag(tag, releaseBranch),
    `On ${releaseBranch}, clean and in sync with origin`,
  );

  const notes = getReleaseNotes(tag);
  const commit = await read(["git", "log", "-1", "--format=%h %s"]);

  p.note(notes, `${pc.cyan(pc.bold(tag))} ${pc.dim(`on ${commit}`)}`);

  if (isDryRun) {
    p.outro(pc.green("Dry run passed · nothing was tagged or pushed"));
    return;
  }

  await confirmOrExit(`Tag ${tag}, push it and publish the GitHub release?`);

  await step(
    `Tagging ${tag}`,
    () => read(["git", "tag", tag]),
    `Tagged ${tag}`,
  );
  await step(
    "Pushing the tag to GitHub",
    () => read(["git", "push", "origin", tag]),
    "Tag pushed",
  );

  const url = await step(
    "Publishing the GitHub release",
    () =>
      read([
        "gh",
        "release",
        "create",
        tag,
        "--title",
        tag,
        "--notes",
        notes,
        "--verify-tag",
      ]),
    "GitHub release published",
  );

  p.outro(`🎉 ${pc.green(`Released ${tag}`)} ${pc.dim("→")} ${pc.cyan(url)}`);
};
