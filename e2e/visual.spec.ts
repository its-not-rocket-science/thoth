import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "thoth-progress-v1";

/** Pins createTrial()'s output to the first item of each pool (circle at
 *  peripheral position 0), so the flash/dial screenshots are reproducible. */
async function withDeterministicTrial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
}

test.describe("visual regression", () => {
  test("ready phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await expect(page.getByRole("heading", { name: "Centre and edge" })).toBeVisible();
    await expect(page.locator(".game-card")).toHaveScreenshot("ready.png");
  });

  test("showing phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.clock.install();
    await page.goto("/thoth/");
    await page.getByRole("button", { name: "Start trial" }).click();
    // Past the fixed 650ms "preparing" delay, inside the flash itself.
    await page.clock.fastForward(700);
    await expect(page.locator("#central")).toBeVisible();
    await expect(page.locator(".game-card")).toHaveScreenshot("showing.png");
  });

  test("responding phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.clock.install();
    await page.goto("/thoth/");
    await page.getByRole("button", { name: "Start trial" }).click();
    // Past preparing + the default 850ms presentation, into the response form.
    await page.clock.fastForward(1600);
    await expect(page.locator("#answer-controls")).toBeEnabled();
    await expect(page.locator(".game-card")).toHaveScreenshot("responding.png");
  });

  test("complete phase", async ({ page }) => {
    await page.addInitScript(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            state: { score: 16, attempts: 20, presentationMs: 700, presentationStreak: 0, distractorCount: 2, distractorStreak: 0 },
            bestPresentationMs: 620,
          }),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.goto("/thoth/");
    await expect(page.locator("#summary-heading")).toBeVisible();
    await expect(page.locator(".game-card")).toHaveScreenshot("complete.png");
  });
});
