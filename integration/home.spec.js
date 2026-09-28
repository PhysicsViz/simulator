/*
 * home.spec.js — Integration tests of the root index.html on every device
 * project: loads over file://, fits the viewport, and every exercise card
 * opens a working exercise page (file:// links expanded to index.html).
 */
import { test, expect } from "@playwright/test";
import { fileUrl, trackPageErrors, horizontalOverflow, press } from "./exercise_suite.js";

test.describe("index.html", () => {
    test("home page loads without errors and fits the viewport", async ({ page }) => {
        const page_errors = trackPageErrors(page);
        await page.goto(fileUrl("index.html"));
        await expect(page.locator("a.card").first()).toBeVisible();
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        expect(page_errors).toEqual([]);
    });

    test("every exercise card opens its simulation", async ({ page, hasTouch }) => {
        const page_errors = trackPageErrors(page);
        await page.goto(fileUrl("index.html"));
        const card_count = await page.locator("a.card").count();
        expect(card_count).toBeGreaterThan(0);
        for (let i = 0; i < card_count; i++) {
            const card = page.locator("a.card").nth(i);
            await card.scrollIntoViewIfNeeded();
            await press(card, hasTouch);
            await expect(page).toHaveURL(/index\.html$/);
            await expect(page.locator("#simulation_canvas")).toBeVisible();
            await page.goBack();
        }
        expect(page_errors).toEqual([]);
    });
});
