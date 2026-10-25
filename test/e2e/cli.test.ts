import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const CLI = resolve(import.meta.dir, "..", "..", "src", "cli.ts");

const CREDENTIALS = [
  "CHROME_PUBLISHER_ID",
  "CHROME_EXTENSION_ID",
  "CHROME_CLIENT_ID",
  "CHROME_CLIENT_SECRET",
  "CHROME_REFRESH_TOKEN",
  "FIREFOX_EXTENSION_ID",
  "FIREFOX_JWT_ISSUER",
  "FIREFOX_JWT_SECRET",
];

const CHANGELOG = `# Changelog

## [V1.2.3] — 2026-01-01

### ✨ Added

- Something users notice.

## [V1.0.0] — 2025-12-01

- First version.
`;

let workDir: string;
let repoDir: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();

/** Runs the real CLI in `repoDir`, with no store credentials in its environment. */
const run = async (...args: string[]) => {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    cwd: repoDir,
    env: {
      ...process.env,
      ...Object.fromEntries(CREDENTIALS.map((name) => [name, ""])),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    exitCode,
    // The CLI's output has colours and cursor codes.
    // eslint-disable-next-line no-control-regex
    output: (stdout + stderr).replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ""),
  };
};

/** An extension repo on `main`, with a clean tree and a bare repo as origin. */
const createExtensionRepo = () => {
  const origin = join(workDir, "origin.git");

  mkdirSync(repoDir);
  mkdirSync(origin);
  git(origin, "init", "--bare", "-b", "main");

  git(repoDir, "init", "-b", "main");
  git(repoDir, "config", "user.name", "Test");
  git(repoDir, "config", "user.email", "test@example.com");
  git(repoDir, "config", "commit.gpgsign", "false");
  git(repoDir, "config", "tag.gpgsign", "false");

  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.2.3" }),
  );
  writeFileSync(
    join(repoDir, "ext-store.config.ts"),
    'export default { name: "Fixture" };\n',
  );
  writeFileSync(join(repoDir, "CHANGELOG.md"), CHANGELOG);

  git(repoDir, "add", ".");
  git(repoDir, "commit", "-m", "Initial commit");
  git(repoDir, "remote", "add", "origin", origin);
  git(repoDir, "push", "-u", "origin", "main");
};

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "ext-store-e2e-"));
  repoDir = join(workDir, "extension");
  createExtensionRepo();
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("cli", () => {
  test("shows the usage for an unknown command", async () => {
    const { exitCode, output } = await run("bogus");

    expect(exitCode).toBe(1);
    expect(output).toContain(
      "Usage: ext-store init | status | submit | auth | tag-release | screenshots",
    );
  });

  test("needs an ext-store.config.ts", async () => {
    rmSync(join(repoDir, "ext-store.config.ts"));

    const { exitCode, output } = await run("status");

    expect(exitCode).toBe(1);
    expect(output).toContain("No ext-store.config.ts found");
  });
});

describe("status", () => {
  test("reports the missing credentials per store", async () => {
    const { exitCode, output } = await run("status");

    expect(exitCode).toBe(0);
    expect(output).toContain("Fixture · Store status");
    expect(output).toContain("CHROME_PUBLISHER_ID");
    expect(output).toContain("FIREFOX_JWT_SECRET");
  });
});

describe("submit", () => {
  test("rejects an unknown store", async () => {
    const { exitCode, output } = await run("submit", "safari");

    expect(exitCode).toBe(1);
    expect(output).toContain("Unknown store: safari. Use chrome or firefox.");
  });

  test("refuses to run with uncommitted changes", async () => {
    writeFileSync(join(repoDir, "scratch.txt"), "work in progress");

    const { exitCode, output } = await run("submit", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain("Commit or stash your changes first");
  });

  test("stops before building when the store credentials are missing", async () => {
    const { exitCode, output } = await run("submit", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain("Missing env vars");
  });
});

describe("tag-release", () => {
  test("previews the release notes in a dry run without tagging", async () => {
    const { exitCode, output } = await run("tag-release", "--dry-run");

    expect(exitCode).toBe(0);
    expect(output).toContain("Fixture · Release (dry run)");
    expect(output).toContain("V1.2.3");
    expect(output).toContain("Something users notice.");
    expect(output).not.toContain("First version.");
    expect(git(repoDir, "tag", "--list")).toBe("");
  });

  test("stops when the changelog has no section for the version", async () => {
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture", version: "9.9.9" }),
    );
    git(repoDir, "commit", "-am", "Bump version");
    git(repoDir, "push");

    const { exitCode, output } = await run("tag-release", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain('CHANGELOG.md has no "## [V9.9.9]" section.');
  });

  test("stops when the tag already exists", async () => {
    git(repoDir, "tag", "V1.2.3");

    const { exitCode, output } = await run("tag-release", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain("Tag V1.2.3 already exists.");
  });

  test("stops outside the release branch", async () => {
    git(repoDir, "checkout", "-b", "feature");

    const { exitCode, output } = await run("tag-release", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain("Switch to main first.");
  });

  test("stops when main isn't pushed", async () => {
    writeFileSync(join(repoDir, "notes.txt"), "more work");
    git(repoDir, "add", ".");
    git(repoDir, "commit", "-m", "Unpushed commit");

    const { exitCode, output } = await run("tag-release", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain("doesn't match origin/main");
  });

  test("stops with uncommitted changes", async () => {
    writeFileSync(join(repoDir, "scratch.txt"), "work in progress");

    const { exitCode, output } = await run("tag-release", "--dry-run");

    expect(exitCode).toBe(1);
    expect(output).toContain("Commit or stash your changes first.");
  });
});
