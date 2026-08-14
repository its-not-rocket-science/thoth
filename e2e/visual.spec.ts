import { expect, test, type Page } from "@playwright/test";

const CENTRE_EDGE_PROGRESS_KEY = "thoth-progress-centre-edge-v1";

/** Pins createTrial()'s output to the first item of each pool (circle at
 *  peripheral position 0), so the flash/dial screenshots are reproducible. */
async function withDeterministicTrial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
}

/** Centre and edge is the default active exercise, but select it
 *  explicitly anyway so these tests don't silently depend on registry
 *  order once more exercises exist. */
async function selectCentreAndEdge(page: Page): Promise<void> {
  await page.locator('[data-exercise-id="centre-edge"]').click();
}

test.describe("visual regression", () => {
  test("ready phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await expect(page.getByRole("heading", { name: "Centre and edge" })).toBeVisible();
    await expect(page.locator(".game-card")).toHaveScreenshot("ready.png");
  });

  test("showing phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await page.getByRole("button", { name: "Start trial" }).click();
    // A flat real wait, not page.clock.fastForward() or a bare polling
    // assert: fastForward only fires the already-scheduled 650ms "preparing"
    // timer, not the 850ms "showing" timer nested inside its own callback,
    // and a bare toBeVisible()/toBeEnabled() poll was observed resolving
    // before the app's own setTimeout had actually fired under Docker's
    // parallel-worker load — this waits comfortably past the 650ms
    // "preparing" delay before asserting anything.
    await page.waitForTimeout(900);
    await expect(page.locator("#central")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".game-card")).toHaveScreenshot("showing.png");
  });

  test("responding phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await page.getByRole("button", { name: "Start trial" }).click();
    // Comfortably past preparing (650ms) + the default presentation (850ms).
    await page.waitForTimeout(1800);
    await expect(page.locator("#answer-controls")).toBeEnabled({ timeout: 10_000 });
    await expect(page.locator(".game-card")).toHaveScreenshot("responding.png");
  });

  test("complete phase", async ({ page }) => {
    await page.addInitScript(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            session: { score: 16, attempts: 20, presentationMs: 700, presentationStreak: 0, distractorCount: 2, distractorStreak: 0 },
            bestPresentationMs: 620,
            sessionLowestMs: 700,
          }),
        );
      },
      { key: CENTRE_EDGE_PROGRESS_KEY },
    );
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await expect(page.locator("#summary-heading")).toBeVisible();
    await expect(page.locator(".game-card")).toHaveScreenshot("complete.png");
  });
});
