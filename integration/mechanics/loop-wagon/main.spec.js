/*
 * main.spec.js — Integration tests of the wagon loop-the-loop page on every
 * device project (PC, tablet, phone), through the shared exercise suite, plus
 * the specific behaviour: fixed view (no camera controls, wheel does not move
 * the scene), h capped at the top of the ramp 3R, the h_min = 5R/2 card, the
 * one-screen layout on a desktop viewport, and the bucket game (one free input,
 * loop parameters hidden, run length driven by the game).
 */
import { test, expect } from "@playwright/test";
import { describeExercisePage, fileUrl, press, trackPageErrors } from "../../exercise_suite.js";

const PAGE_PATH = "src/mechanics/loop-wagon/index.html";

describeExercisePage({
    page_path: PAGE_PATH,
    parameter_key: "start_height",
    parameter_value: 4,
    formula_id: "normal_top",
});

test.describe(`${PAGE_PATH} — specific`, () => {
    let page_errors;

    test.beforeEach(async ({ page }) => {
        page_errors = trackPageErrors(page);
        await page.goto(fileUrl(PAGE_PATH));
        await expect(page.locator("#number_start_height")).toBeAttached();
    });

    test.afterEach(() => {
        expect(page_errors).toEqual([]);
    });

    test("fixed view: no camera buttons, the wheel leaves the scene unchanged", async ({ page, isMobile }) => {
        test.skip(isMobile, "wheel input is desktop-only");
        await expect(page.locator("#zoom_in_button")).toHaveCount(0);
        const canvas = page.locator("#simulation_canvas");
        const signature = () => canvas.evaluate((element) => element.toDataURL().length);
        const before = await signature();
        await canvas.hover();
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(100);
        expect(await signature()).toBe(before);
    });

    test("h is capped at 3R and follows R; h_min = 5R/2", async ({ page }) => {
        await expect(page.locator("#res_h_min")).toHaveText("5,00 m");
        await page.locator("#number_loop_radius").fill("1");
        await expect(page.locator("#number_start_height")).toHaveAttribute("max", "3");
        await expect(page.locator("#number_start_height")).toHaveValue("3");
        await expect(page.locator("#res_h_min")).toHaveText("2,50 m");
    });

    test("one-screen mode: first view fills the viewport, formulas just below the fold, text not shrunk", async ({ page }) => {
        const viewport = page.viewportSize();
        test.skip(viewport.width < 700 || viewport.height < 540, "one-screen layout from 700 × 540");
        const boxes = await page.evaluate(() => Object.fromEntries(
            [".app-bar", ".first-view", ".formula-panel", ".side", "#simulation_canvas", "#graph_canvas"].map((selector) => {
                const box = document.querySelector(selector).getBoundingClientRect();
                return [selector, { top: box.top, bottom: box.bottom, height: box.height }];
            }),
        ));
        const font_size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".exercise-page")).fontSize));
        expect(boxes[".first-view"].height, "first view = viewport").toBeCloseTo(viewport.height, 0);
        expect(boxes[".side"].bottom, "side column inside the first view").toBeLessThanOrEqual(viewport.height + 1);
        expect(boxes[".formula-panel"].top, "formulas below the fold").toBeGreaterThanOrEqual(viewport.height - 1);
        expect(boxes[".formula-panel"].top, "formulas right after the fold").toBeLessThanOrEqual(viewport.height + 40);
        expect(font_size, "text not shrunk").toBeGreaterThanOrEqual(16);
        expect(boxes["#simulation_canvas"].height, "scene height").toBeGreaterThanOrEqual(0.4 * (viewport.height - boxes[".app-bar"].height));
        expect(boxes["#graph_canvas"].height, "graph height").toBeGreaterThanOrEqual(50);
    });

    test("game mode: one free input, loop parameters hidden, run length from the game", { tag: "@important" }, async ({ page, hasTouch }) => {
        await press(page.locator(".mode-tabs button").nth(1), hasTouch);
        await expect(page.locator("body")).toHaveClass(/game-mode/);
        await expect(page.locator("#number_start_height")).toBeHidden();
        await expect(page.locator("#number_game_value")).toBeVisible();
        await expect(page.locator(".game-panel")).toBeVisible();
        await page.locator("#number_game_value").fill(await page.locator("#number_game_value").getAttribute("min"));
        await expect(page.locator("#slider_game_value")).toHaveValue(await page.locator("#number_game_value").inputValue());
        await press(page.locator("#play_pause_button"), hasTouch);
        await expect(page.locator("#time_display")).not.toHaveText("t = 0,00 s");
        await press(page.locator(".mode-tabs button").nth(0), hasTouch);
        await expect(page.locator("#number_start_height")).toBeVisible();
        await expect(page.locator("#number_game_value")).toBeHidden();
    });
});
