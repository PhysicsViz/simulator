/*
 * playwright.config.js — Integration test runner configuration: every spec in
 * integration/ runs once per target device (desktop, tablet, phone, portrait
 * and landscape, Chromium/WebKit/Firefox engines). Pages are opened through
 * file:// URLs, exactly as students open them, so no server is started.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "integration",
    testMatch: "**/*.spec.js",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        locale: "fr-BE",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "pc-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
        { name: "pc-firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } } },
        { name: "pc-small", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 640 } } },
        { name: "tablet-ipad", use: { ...devices["iPad (gen 7)"] } },
        { name: "tablet-ipad-landscape", use: { ...devices["iPad (gen 7) landscape"] } },
        { name: "tablet-android", use: { ...devices["Galaxy Tab S4"] } },
        { name: "phone-iphone", use: { ...devices["iPhone 13"] } },
        { name: "phone-iphone-landscape", use: { ...devices["iPhone 13 landscape"] } },
        { name: "phone-android", use: { ...devices["Pixel 7"] } },
    ],
});
