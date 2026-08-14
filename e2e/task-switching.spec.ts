import { expect, test } from "@playwright/test";

test.describe("task switching", () => {
  test("connecting the full trail in order completes the round", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="task-switching"]').click();
    await expect(page.getByRole("heading", { name: "Task switching" })).toBeVisible();

    await page.getByRole("button", { name: "Start trial" }).click();
    await expect(page.locator(".trail-node").first()).toBeVisible({ timeout: 5000 });
    expect(await page.locator(".trail-node").count()).toBe(12);

    const sequence = ["1", "A", "2", "B", "3", "C", "4", "D", "5", "E", "6", "F"];
    for (const label of sequence) {
      await page.locator(".trail-node", { hasText: new RegExp(`^${label}$`) }).click();
    }

    await expect(page.locator("#feedback")).toHaveText(/Trail complete/, { timeout: 5000 });
    await expect(page.locator("#progress-text")).toHaveText("1 of 5");

    const completedReadout = page
      .locator("#readouts .readout")
      .filter({ has: page.locator("dt", { hasText: /^Completed$/ }) })
      .locator("dd");
    await expect(completedReadout).toHaveText("1");
  });

  test("clicking the wrong node counts an error without ending the round", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="task-switching"]').click();
    await page.getByRole("button", { name: "Start trial" }).click();
    await expect(page.locator(".trail-node").first()).toBeVisible({ timeout: 5000 });

    // "2" is not the expected first click ("1" is) — should flash red and
    // not advance the trail.
    const wrongNode = page.locator(".trail-node", { hasText: /^2$/ });
    await wrongNode.click();
    await expect(wrongNode).toHaveClass(/error-flash/);
    await expect(page.locator(".trail-node.visited")).toHaveCount(0);

    // The round is still open: completing it correctly from here should
    // still succeed and the error should be reflected in the readout.
    const sequence = ["1", "A", "2", "B", "3", "C", "4", "D", "5", "E", "6", "F"];
    for (const label of sequence) {
      await page.locator(".trail-node", { hasText: new RegExp(`^${label}$`) }).click();
    }
    await expect(page.locator("#feedback")).toHaveText(/error/, { timeout: 5000 });

    const errorsReadout = page
      .locator("#readouts .readout")
      .filter({ has: page.locator("dt", { hasText: /^Errors$/ }) })
      .locator("dd");
    await expect(errorsReadout).toHaveText("1");
  });
});
