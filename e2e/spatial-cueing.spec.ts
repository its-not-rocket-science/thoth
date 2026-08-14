import { expect, test } from "@playwright/test";

test.describe("spatial cueing", () => {
  test("accepts timed key-presses and updates the validity-effect readout", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="spatial-cueing"]').click();
    await expect(page.getByRole("heading", { name: "Spatial cueing" })).toBeVisible();

    const readoutCell = (label: string) =>
      page
        .locator("#readouts .readout")
        .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
        .locator("dd");

    await expect(readoutCell("Validity effect")).toHaveText("—");

    // Run a handful of trials, pressing Space shortly after the target
    // becomes visible each time (real timing, matching this project's
    // established e2e approach elsewhere — no fake clock).
    for (let i = 0; i < 4; i++) {
      // "Start trial" the first time, "Next trial" after.
      await page.getByRole("button", { name: /trial/i }).click();
      await expect(page.locator(".cueing-marker.target")).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(120);
      await page.keyboard.press("Space");
      await expect(page.locator("#feedback")).not.toBeEmpty();
      await expect(page.locator("#feedback")).toHaveText(/Recorded/);
    }

    await expect(page.locator("#progress-text")).toHaveText("4 of 20");
    await expect(readoutCell("Trials")).toHaveText("4");

    // At least one condition (valid or invalid) should have a real mean by
    // now given 4 trials at an 80/20 split; the readout should no longer
    // be showing the empty-state em dash for both RT cells simultaneously.
    const validRt = await readoutCell("Valid RT").textContent();
    const invalidRt = await readoutCell("Invalid RT").textContent();
    expect(validRt !== "—" || invalidRt !== "—").toBe(true);
  });

  test("records a timeout when the player doesn't respond in time", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="spatial-cueing"]').click();
    await page.getByRole("button", { name: "Start trial" }).click();

    // Don't respond at all; the flash's own timeout (cue + SOA + 2000ms)
    // should still auto-submit and advance the session.
    await expect(page.locator("#feedback")).toHaveText(/too slow/i, { timeout: 8000 });
    await expect(page.locator("#progress-text")).toHaveText("1 of 20");
  });
});
