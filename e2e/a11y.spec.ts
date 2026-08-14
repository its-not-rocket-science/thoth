import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const CENTRE_EDGE_PROGRESS_KEY = "thoth-progress-centre-edge-v1";

/** Pins createTrial()'s output to the first item of each pool (circle at
 *  peripheral position 0), so reaching a given phase is reproducible. */
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

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations;
}

function describeViolations(items: Awaited<ReturnType<typeof violations>>): string {
  return items
    .map(v => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)\n  ${v.helpUrl}`)
    .join("\n");
}

test.describe("accessibility", () => {
  test("ready phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await expect(page.getByRole("heading", { name: "Centre and edge" })).toBeVisible();
    const found = await violations(page);
    expect(found, describeViolations(found)).toEqual([]);
  });

  test("responding phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await page.getByRole("button", { name: "Start trial" }).click();
    // See the comment in e2e/visual.spec.ts's "responding phase" test: a
    // flat real wait proved more reliable here than a bare polling assert.
    await page.waitForTimeout(1800);
    await expect(page.locator("#answer-controls")).toBeEnabled({ timeout: 10_000 });
    const found = await violations(page);
    expect(found, describeViolations(found)).toEqual([]);
  });

  test("paused phase", async ({ page }) => {
    await withDeterministicTrial(page);
    await page.goto("/thoth/");
    await selectCentreAndEdge(page);
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.locator("#field-message")).toHaveText("Paused");
    const found = await violations(page);
    expect(found, describeViolations(found)).toEqual([]);
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
    const found = await violations(page);
    expect(found, describeViolations(found)).toEqual([]);
  });
});
