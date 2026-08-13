import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/thoth/",
  test: {
    // Playwright owns e2e/ (its own runner, run via `npx playwright test`);
    // Vitest's default "*.spec.ts" glob would otherwise try to collect it too.
    exclude: ["e2e/**", "node_modules/**"],
  },
});
