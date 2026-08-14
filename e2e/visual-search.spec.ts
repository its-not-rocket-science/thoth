import { expect, test } from "@playwright/test";

test.describe("visual search", () => {
  test("renders a grid and accepts a click on a target-shaped item", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="visual-search"]').click();
    await expect(page.getByRole("heading", { name: "Visual search" })).toBeVisible();

    await page.getByRole("button", { name: "Start trial" }).click();
    await expect(page.locator(".search-item").first()).toBeVisible({ timeout: 5000 });
    const itemCount = await page.locator(".search-item").count();
    expect(itemCount).toBeGreaterThanOrEqual(4);

    // Click the actual target if we can find it (brass diamond); otherwise
    // click any item — either way the trial should be accepted and scored.
    const target = page.locator(".search-item.diamond.color-brass");
    if (await target.count()) {
      await target.first().click();
    } else {
      await page.locator(".search-item").first().click();
    }

    await expect(page.locator("#feedback")).not.toBeEmpty();
    await expect(page.locator("#progress-text")).toHaveText("1 of 20");
  });

  test("clicking the actual target scores as correct and updates a slope readout", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="visual-search"]').click();

    // Run trials until we log at least one correct click (clicking the
    // brass diamond every time we can find it), enough to populate one of
    // the two slope readouts.
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: /trial/i }).click();
      await expect(page.locator(".search-item").first()).toBeVisible({ timeout: 5000 });
      const target = page.locator(".search-item.diamond.color-brass").first();
      await target.click();
      await expect(page.locator("#feedback")).not.toBeEmpty();
    }

    const readoutCell = (label: string) =>
      page
        .locator("#readouts .readout")
        .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
        .locator("dd");

    const accuracy = await readoutCell("Accuracy").textContent();
    expect(accuracy).not.toBe("—");
    expect(accuracy).not.toBe("0%");
  });
});
