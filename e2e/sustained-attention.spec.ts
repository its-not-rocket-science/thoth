import { expect, test } from "@playwright/test";

test.describe("sustained attention", () => {
  test("streams go/no-go glyphs with a visible countdown and captures spacebar responses", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="sustained-attention"]').click();
    await expect(page.getByRole("heading", { name: "Sustained attention" })).toBeVisible();

    await page.getByRole("button", { name: "Start trial" }).click();
    await expect(page.locator(".cpt-timer-fill")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#cpt-respond")).toBeVisible();
    await expect(page.locator(".cpt-timer-label")).toContainText("remaining");

    // Respond to several events over a few seconds — this only checks the
    // stream mechanics (timer ticking down, responses not throwing), not
    // the full ~65s natural completion.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(600);
    }

    const label = await page.locator(".cpt-timer-label").textContent();
    expect(label).toMatch(/\d+s remaining/);
    const seconds = Number(label?.match(/(\d+)s/)?.[1]);
    expect(seconds).toBeLessThan(65);
    expect(seconds).toBeGreaterThan(50);
  });
});
