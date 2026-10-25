/**
 * Replaces the Firefox listing's screenshots through AMO's API. Chrome's API
 * can't change listing images, so this opens the dashboard and the folder instead.
 */
import { resolve } from "path";

import { getFirefoxPreviews, replaceFirefoxPreviews } from "../stores/firefox";
import { confirmOrExit, header, p, pc, step } from "../lib/ui";
import { read, requireEnv } from "../lib/utils";
import {
  framedFile,
  getScreenshotsConfig,
  headlineLines,
  outputDir,
} from "./screenshots";

export const upload = async (args: string[]) => {
  header("Store screenshots: upload");

  const { screenshots } = await getScreenshotsConfig();
  const screenshotFiles = screenshots.scenes.map((scene) => ({
    path: framedFile(screenshots, scene),
    caption: headlineLines(scene.headline).join(" ").trim(),
  }));

  for (const { path } of screenshotFiles) {
    if (!(await Bun.file(path).exists())) {
      throw new Error(
        `${path} is missing. Run ${pc.bold("ext-store screenshots")} first.`,
      );
    }
  }

  const current = await step(
    "Loading the Firefox listing",
    getFirefoxPreviews,
    (previews) => `Firefox listing has ${previews.length} screenshots`,
  );

  p.note(
    screenshotFiles
      .map(({ caption }, index) => `${index + 1}.jpg  ${pc.dim(caption)}`)
      .join("\n"),
    `Replaces Firefox's ${current.length} screenshots with`,
  );

  if (args.includes("--dry-run")) {
    p.outro("Dry run: nothing was uploaded.");
    return;
  }

  await confirmOrExit("Replace the screenshots on the live Firefox listing?");
  await step(
    "Updating the Firefox listing",
    (update) => replaceFirefoxPreviews(screenshotFiles, update),
    `Firefox listing has the ${screenshotFiles.length} new screenshots`,
  );

  const env = requireEnv("CHROME_PUBLISHER_ID", "CHROME_EXTENSION_ID");
  const dashboard = `https://chrome.google.com/webstore/devconsole/${env.CHROME_PUBLISHER_ID}/${env.CHROME_EXTENSION_ID}/edit`;

  await read(["open", dashboard]);
  await read(["open", resolve(outputDir(screenshots))]);
  p.log.info(
    [
      "Chrome: in the dashboard that just opened, go to Store listing > Screenshots,",
      `remove the old ones, drag in 1.jpg to ${screenshotFiles.length}.jpg from the folder that opened,`,
      "and save the draft. Listing changes go through review with the next submission.",
    ].join("\n"),
  );
  p.outro("Done");
};
