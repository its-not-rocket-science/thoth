import { expect, test } from "@playwright/test";

test.describe("multiple object tracking", () => {
  test("can be started, animates, stops, and accepts a selection", async ({ page }) => {
    await page.goto("/thoth/");
    await page.locator('[data-exercise-id="multiple-object-tracking"]').click();
    await expect(page.getByRole("heading", { name: "Multiple object tracking" })).toBeVisible();

    await page.getByRole("button", { name: "Start trial" }).click();

    // Highlight phase: some dots are shown as targets.
    await expect(page.locator(".mot-object.target-highlight").first()).toBeVisible({ timeout: 5000 });
    const targetCount = await page.locator(".mot-object.target-highlight").count();
    expect(targetCount).toBeGreaterThan(0);

    // Drift phase: highlighting clears and objects actually move.
    await expect(page.locator(".mot-object.target-highlight")).toHaveCount(0, { timeout: 3000 });
    const before = await page.locator(".mot-object").first().boundingBox();
    await page.waitForTimeout(500);
    const after = await page.locator(".mot-object").first().boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(before?.x !== after?.x || before?.y !== after?.y).toBe(true);

    // Responding phase: motion stops, objects become clickable.
    await expect(page.locator("#answer-controls")).toBeEnabled({ timeout: 10_000 });
    await expect(page.locator(".mot-objects.respond-active")).toHaveCount(1);
    const frozen1 = await page.locator(".mot-object").first().boundingBox();
    await page.waitForTimeout(300);
    const frozen2 = await page.locator(".mot-object").first().boundingBox();
    expect(frozen1?.x).toBe(frozen2?.x);
    expect(frozen1?.y).toBe(frozen2?.y);

    // Accepts a selection and submits.
    await page.locator(".mot-object").nth(0).click();
    await page.locator(".mot-object").nth(1).click();
    await expect(page.locator(".mot-object.selected")).toHaveCount(2);

    await page.locator(".submit-answer").click();
    await expect(page.locator("#feedback")).not.toBeEmpty();
    // The arbitrary selection above is unlikely to exactly match the
    // random target set, so only assert the trial was accepted and
    // counted — not that it scored correct.
    await expect(page.locator("#progress-text")).toHaveText("1 of 20");
  });
});
