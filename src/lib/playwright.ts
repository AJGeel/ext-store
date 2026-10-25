/* Parts of this file run in the browser through page.evaluate. */
/// <reference lib="dom" />
import type { Page } from "playwright";

import type { Stage } from "../config";
import { p, pc } from "./ui";

export type { Stage };

/** Rejects with `label` once `ms` have passed, so nothing can wait forever. */
export const withDeadline = <T>(
  task: Promise<T>,
  ms: number,
  label: string,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms / 1000}s: ${label}`)),
      ms,
    );
  });

  return Promise.race([task, deadline]).finally(() => clearTimeout(timer));
};

/** Most stages take a second or two; this only catches real stalls. */
const STAGE_TIMEOUT = 30_000;

/**
 * Runs named stages, showing how long the current one has been running, so a
 * stall is visible. Each stage fails after its timeout.
 */
export const createStage =
  (scope: string, update: (message: string) => void): Stage =>
  async (label, task, timeoutMs = STAGE_TIMEOUT) => {
    const name = `${scope} · ${label}`;
    const started = Date.now();
    const show = () =>
      update(
        `${name} ${pc.dim(`${Math.floor((Date.now() - started) / 1000)}s`)}`,
      );
    const ticker = setInterval(show, 1000);

    show();

    // Without a terminal the spinner isn't shown, so log each stage instead.
    if (!process.stdout.isTTY) {
      p.log.message(pc.dim(name));
    }

    try {
      return await withDeadline(task(), timeoutMs, name);
    } finally {
      clearInterval(ticker);
    }
  };

/**
 * Waits for fonts and every image on the page, including CSS backgrounds.
 * An image that hasn't loaded after `ms` fails the scene, with its URL.
 */
export const waitForImages = async (page: Page, ms = 20_000) => {
  const stalled = await page.evaluate(async (ms) => {
    await document.fonts.ready;

    const urls = [...document.querySelectorAll<HTMLElement>("*")]
      .flatMap((element) => [
        ...getComputedStyle(element).backgroundImage.matchAll(
          /url\("(.+?)"\)/g,
        ),
      ])
      .map((match) => match[1]);
    const images = [...document.images].map((image) => image.src);
    const results = await Promise.all(
      [...new Set([...urls, ...images])].map(
        (src) =>
          new Promise<string | null>((done) => {
            const image = new Image();
            const timer = setTimeout(() => done(src), ms);

            image.onload = image.onerror = () => {
              clearTimeout(timer);
              done(null);
            };
            image.src = src;
          }),
      ),
    );

    return results.filter((src) => src !== null);
  }, ms);

  if (stalled.length > 0) {
    throw new Error(
      `Images still loading after ${ms / 1000}s: ${stalled.join(", ")}`,
    );
  }
};
