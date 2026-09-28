/*
 * exercise_suite.js — Shared integration checks for every exercise page, run by
 * Playwright on each device project (PC, tablet, phone). An exercise spec calls
 * describeExercisePage() with the few page-specific facts (which parameter to
 * change, which formula must react); the suite then checks loading over
 * file://, responsive layout, canvas sizing and rendering, parameter/formula
 * synchronization, transport, camera, language toggle, touch-target sizes and
 * the optional game mode.
 */
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const MINIMUM_TOUCH_TARGET = 24;
const PANEL_SELECTORS = [".scene-panel", ".transport-panel", ".control-panel", ".formula-panel", ".graphs-panel"];

/* fileUrl: file:// URL of a repository-relative page, as a student opens it */
export function fileUrl(relative_path) {
    return pathToFileURL(path.join(REPOSITORY_ROOT, relative_path)).href;
}

/* trackPageErrors: collect uncaught exceptions, console errors and failed loads */
export function trackPageErrors(page) {
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(`console: ${message.text()}`);
        }
    });
    page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.url()}`));
    return errors;
}

/* press: tap on touch devices, click elsewhere, so each device uses its real input */
export async function press(locator, has_touch) {
    if (has_touch) {
        await locator.tap();
    } else {
        await locator.click();
    }
}

/* horizontalOverflow: pixels by which the page is wider than the viewport */
export function horizontalOverflow(page) {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/* nextFrames: wait for a few animation frames so the render loop has redrawn */
function nextFrames(page, count = 3) {
    return page.evaluate((frame_count) => new Promise((resolve) => {
        let remaining = frame_count;
        const tick = () => (--remaining <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    }), count);
}

/* canvasSignature: cheap fingerprint of the canvas pixels, to detect redraws */
function canvasSignature(page, selector) {
    return page.locator(selector).evaluate((canvas) => {
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 0;
        for (let i = 0; i < pixels.length; i += 97) {
            hash = (hash * 31 + pixels[i]) | 0;
        }
        return hash;
    });
}

/* distinctColorCount: number of distinct sampled colors (1 means a blank canvas) */
function distinctColorCount(page, selector) {
    return page.locator(selector).evaluate((canvas) => {
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 4 * 53) {
            colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
        }
        return colors.size;
    });
}

/* translatedText: concatenated text of every data-i18n element */
function translatedText(page) {
    return page.evaluate(() => [...document.querySelectorAll("[data-i18n]")].map((element) => element.textContent).join("|"));
}

/* describeExercisePage: register the shared checks for one exercise page
   options: { page_path, parameter_key, parameter_value, formula_id } */
export function describeExercisePage({ page_path, parameter_key, parameter_value, formula_id }) {
    test.describe(page_path, () => {
        let page_errors;

        test.beforeEach(async ({ page }) => {
            page_errors = trackPageErrors(page);
            await page.goto(fileUrl(page_path));
            await expect(page.locator("#parameter_rows input").first()).toBeAttached();
            await nextFrames(page);
        });

        test.afterEach(() => {
            expect(page_errors, "no JS error, console error or failed file load").toEqual([]);
        });

        test("layout fits the viewport width (no horizontal page scroll)", async ({ page }) => {
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
            const viewport_width = page.viewportSize().width;
            for (const selector of PANEL_SELECTORS) {
                const panel = page.locator(selector);
                await panel.scrollIntoViewIfNeeded();
                await expect(panel, `${selector} visible`).toBeVisible();
                const box = await panel.boundingBox();
                expect(box.x, `${selector} left edge`).toBeGreaterThanOrEqual(-1);
                expect(box.x + box.width, `${selector} right edge`).toBeLessThanOrEqual(viewport_width + 1);
            }
        });

        test("scene canvas resolution matches its displayed size and is drawn", async ({ page }) => {
            const canvas = page.locator("#simulation_canvas");
            const size = await canvas.evaluate((element) => ({
                width: element.width,
                height: element.height,
                client_width: Math.round(element.clientWidth),
                client_height: Math.round(element.clientHeight),
            }));
            expect(size.width).toBe(size.client_width);
            expect(size.height).toBe(size.client_height);
            expect(size.client_height).toBeGreaterThanOrEqual(200);
            expect(await distinctColorCount(page, "#simulation_canvas")).toBeGreaterThan(3);
        });

        test("slider and number input stay in sync and formulas update", async ({ page, isMobile }) => {
            const number_input = page.locator(`#number_${parameter_key}`);
            const slider = page.locator(`#slider_${parameter_key}`);
            const substitution = page.locator(`#sub_${formula_id}`);
            const before = await substitution.textContent();

            await number_input.scrollIntoViewIfNeeded();
            await number_input.fill(String(parameter_value));
            await expect(slider).toHaveValue(String(parameter_value));
            await expect(substitution).not.toHaveText(before);

            await slider.fill(String(await slider.getAttribute("min")));
            await expect(number_input).toHaveValue(String(await slider.getAttribute("min")));
            expect(await horizontalOverflow(page), `no overflow after edit (mobile: ${isMobile})`).toBeLessThanOrEqual(0);
        });

        test("play advances time, pause freezes it, reset returns to t = 0", async ({ page, hasTouch }) => {
            const time_display = page.locator("#time_display");
            const initial_text = await time_display.textContent();
            const play_button = page.locator("#play_pause_button");

            await play_button.scrollIntoViewIfNeeded();
            await press(play_button, hasTouch);
            await expect(time_display).not.toHaveText(initial_text);
            await press(play_button, hasTouch);
            const paused_text = await time_display.textContent();
            await nextFrames(page, 10);
            await expect(time_display).toHaveText(paused_text);

            await press(page.locator("#reset_button"), hasTouch);
            await expect(time_display).toHaveText(initial_text);
        });

        test("timeline scrubber and step buttons move through time", async ({ page, hasTouch }) => {
            const time_display = page.locator("#time_display");
            const initial_text = await time_display.textContent();
            const timeline = page.locator("#timeline");
            await timeline.scrollIntoViewIfNeeded();
            await timeline.fill(await timeline.evaluate((input) => {
                const step = Number(input.step);
                return String(Number((Math.round(Number(input.max) / 2 / step) * step).toFixed(2)));
            }));
            await expect(time_display).not.toHaveText(initial_text);

            const scrubbed_text = await time_display.textContent();
            await press(page.locator("#step_forward_button"), hasTouch);
            await expect(time_display).not.toHaveText(scrubbed_text);
            await press(page.locator("#step_back_button"), hasTouch);
            await expect(time_display).toHaveText(scrubbed_text);
        });

        test("camera buttons redraw the scene", async ({ page, hasTouch }) => {
            await page.locator("#simulation_canvas").scrollIntoViewIfNeeded();
            const before = await canvasSignature(page, "#simulation_canvas");
            await press(page.locator("#zoom_in_button"), hasTouch);
            await nextFrames(page);
            expect(await canvasSignature(page, "#simulation_canvas")).not.toBe(before);
            await press(page.locator("#zoom_fit_button"), hasTouch);
            await nextFrames(page);
            expect(await canvasSignature(page, "#simulation_canvas")).toBe(before);
        });

        test("language toggle translates the page and persists across reloads", async ({ page, hasTouch }) => {
            await expect(page.locator("html")).toHaveAttribute("lang", "fr");
            const french_text = await translatedText(page);
            await press(page.locator("#language_toggle"), hasTouch);
            await expect(page.locator("html")).toHaveAttribute("lang", "en");
            expect(await translatedText(page)).not.toBe(french_text);
            await page.reload();
            await expect(page.locator("html")).toHaveAttribute("lang", "en");
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        });

        test("touch targets are large enough on touch devices", async ({ page, hasTouch }) => {
            test.skip(!hasTouch, "touch-only check");
            const too_small = await page.evaluate((minimum) => {
                const offenders = [];
                for (const element of document.querySelectorAll("button, input, a")) {
                    const box = element.getBoundingClientRect();
                    if (box.width === 0 || getComputedStyle(element).visibility === "hidden") {
                        continue;
                    }
                    if (box.width < minimum || box.height < minimum) {
                        offenders.push(`${element.id || element.textContent.trim() || element.tagName} ${Math.round(box.width)}×${Math.round(box.height)}`);
                    }
                }
                return offenders;
            }, MINIMUM_TOUCH_TARGET);
            expect(too_small, `interactive elements under ${MINIMUM_TOUCH_TARGET}×${MINIMUM_TOUCH_TARGET} CSS px`).toEqual([]);
        });

        test("game mode hides the answer and keeps the layout", async ({ page, hasTouch }) => {
            const tabs = page.locator(".mode-tabs button");
            test.skip(await tabs.count() === 0, "exercise has no game mode");
            await press(tabs.nth(1), hasTouch);
            await expect(page.locator("body")).toHaveClass(/game-mode/);
            await expect(page.locator(".formula-panel")).toBeHidden();
            await expect(page.locator(".graphs-panel")).toBeHidden();
            await expect(page.locator(".game-panel")).toBeVisible();
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
            await press(tabs.nth(0), hasTouch);
            await expect(page.locator("body")).not.toHaveClass(/game-mode/);
            await expect(page.locator(".formula-panel")).toBeVisible();
        });
    });
}
