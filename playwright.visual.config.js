/*
 * playwright.visual.config.js — Watchable run of the @important integration
 * tests: visible browser windows (one PC, one tablet, one phone), actions
 * slowed down, one test at a time, every run recorded on video. The HTML
 * report (videos + step-by-step traces) opens at the end.
 */
import { defineConfig } from "@playwright/test";
import base_config from "./playwright.config.js";

const VISUAL_PROJECTS = ["pc-chromium", "tablet-ipad", "phone-iphone"];
const ACTION_DELAY_MS = 400;

export default defineConfig({
    ...base_config,
    grep: /@important/,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 120000,
    outputDir: "test-results/visual",
    reporter: [["list"], ["html", { outputFolder: "playwright-report/visual", open: "always" }]],
    use: {
        ...base_config.use,
        headless: false,
        video: "on",
        trace: "on",
        launchOptions: { slowMo: ACTION_DELAY_MS },
    },
    projects: base_config.projects.filter((project) => VISUAL_PROJECTS.includes(project.name)),
});
