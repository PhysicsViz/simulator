/*
 * main.spec.js — Integration tests of the loop-the-loop page on every device
 * project (PC, tablet, phone), through the shared exercise suite, plus the
 * loop-shape selector and the rope-swing water-bucket game inputs (one free
 * variable per challenge).
 */
import { test, expect } from "@playwright/test";
import { describeExercisePage, fileUrl, press, trackPageErrors } from "../../exercise_suite.js";

const PAGE_PATH = "src/mechanics/loop-the-loop/index.html";

describeExercisePage({
    page_path: PAGE_PATH,
    parameter_key: "start_height",
    parameter_value: 4,
    formula_id: "normal_top",
});

test.describe(`${PAGE_PATH} — specific`, () => {
    test("the clothoid needs less height than the circle (h_min card)", async ({ page, hasTouch }) => {
        const page_errors = trackPageErrors(page);
        await page.goto(fileUrl(PAGE_PATH));
        await expect(page.locator("#res_h_min")).toHaveText("2,50 m");
        await press(page.locator("#shape_clothoid"), hasTouch);
        await expect(page.locator("#shape_clothoid")).toHaveClass(/active/);
        await expect(page.locator("#res_h_min")).toHaveText("2,32 m");
        expect(page_errors).toEqual([]);
    });

    test("game mode: rope swing with one free input (v₀, R or m)", { tag: "@important" }, async ({ page, hasTouch }) => {
        const page_errors = trackPageErrors(page);
        await page.goto(fileUrl(PAGE_PATH));
        await press(page.locator(".mode-tabs button").nth(1), hasTouch);
        await expect(page.locator("body")).toHaveClass(/game-mode/);
        for (const id of ["number_loop_radius", "number_mass", "number_gravity", "shape_circle", "shape_clothoid"]) {
            await expect(page.locator(`#${id}`), id).toBeDisabled();
        }
        await expect(page.locator("#number_start_height")).toBeHidden();
        await expect(page.locator("#number_game_value")).toBeEnabled();
        await page.locator("#number_game_value").fill("1");
        await expect(page.locator("#slider_game_value")).toHaveValue("1");
        await press(page.locator(".mode-tabs button").nth(0), hasTouch);
        await expect(page.locator("#number_loop_radius")).toBeEnabled();
        await expect(page.locator("#number_start_height")).toBeVisible();
        await expect(page.locator("#number_game_value")).toBeHidden();
        expect(page_errors).toEqual([]);
    });
});
