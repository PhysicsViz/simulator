/*
 * captures.cjs — Screenshots of the site for the report (Playwright, Chromium,
 * pages opened over file:// exactly as students do). Run from the repository
 * root after `npm install`:
 *   node memoire/rapport/outils/captures.cjs
 * Output: memoire/rapport/figures/captures/*.png
 */
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(path.resolve(__dirname, "../../../node_modules/@playwright/test"));

const ROOT = path.resolve(__dirname, "../../..");
const OUTPUT = path.resolve(__dirname, "../figures/captures");
const PAGE = pathToFileURL(path.join(ROOT, "src/mechanics/loop-wagon/index.html")).href;
const HOME = pathToFileURL(path.join(ROOT, "index.html")).href;

/* playFor: run the clock for a wall-clock duration, then pause */
async function playFor(page, milliseconds) {
    await page.click("#play_pause_button");
    await page.waitForTimeout(milliseconds);
    await page.click("#play_pause_button");
    await page.waitForTimeout(150);
}

/* seek: move main.js's clock to a given time through the timeline input
   (hidden in game mode, still listened to) */
async function seek(page, time) {
    await page.evaluate((target) => {
        const timeline = document.getElementById("timeline");
        timeline.max = 1000;
        timeline.value = target;
        timeline.dispatchEvent(new Event("input"));
    }, time);
    await page.waitForTimeout(120);
}

/* SEEDED_RANDOM: init script replacing Math.random by mulberry32, so the drawn
   challenges (and thus the captures) are reproducible */
const SEEDED_RANDOM = `(() => {
    let state = 20261026;
    Math.random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
})();`;

/* gameData: numbers of the current challenge read from its data list */
async function gameData(page) {
    const lines = await page.locator(".game-row .game-data li").allTextContents();
    const number = (pattern) => {
        const line = lines.find((entry) => pattern.test(entry));
        const match = line && line.match(/=\s*([\d\s,]+)/);
        return match ? Number(match[1].replace(/\s/g, "").replace(",", ".")) : null;
    };
    return { gravity: number(/g =/), rope_length: number(/L =/), mass: number(/m =/), tension_max: number(/T_max/) };
}

/* speedChallenge: draw challenges until the free variable is v₀ */
async function speedChallenge(page) {
    for (let i = 0; i < 40; i++) {
        if ((await page.locator('label[for="slider_game_value"]').textContent()).includes("v₀")) {
            return gameData(page);
        }
        await page.click("#new_challenge_button");
    }
    throw new Error("no v₀ challenge drawn");
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", locale: "fr-BE" });
    const shoot = (name) => page.screenshot({ path: path.join(OUTPUT, name) });
    await page.addInitScript(SEEDED_RANDOM);
    const shootScene = async (name) => {
        const box = await page.locator(".scene-panel").boundingBox();
        await page.screenshot({ path: path.join(OUTPUT, name), clip: { x: box.x + 0.25 * box.width, y: box.y, width: 0.5 * box.width, height: box.height } });
    };

    await page.goto(HOME);
    await page.waitForTimeout(300);
    await shoot("accueil.png");

    await page.goto(PAGE);
    await page.waitForTimeout(400);
    await seek(page, 1.75);
    await shoot("looping-ecran-complet.png");

    await page.fill("#number_start_height", "4");
    await seek(page, 2.55);
    await shoot("looping-decollage.png");

    await page.click(".mode-tabs button:nth-child(2)");
    await page.waitForTimeout(300);
    const data = await speedChallenge(page);
    const radius = 0.5 + data.rope_length + 0.19;
    const minimum = Math.sqrt(5 * data.gravity * radius);
    const maximum = Math.sqrt((data.tension_max / data.mass - data.gravity) * radius);
    const success_speed = (1.06 * minimum + 0.94 * maximum) / 2;
    const failure_speed = 0.85 * minimum;
    const runOf = (launch_speed) => page.evaluate((parameters) => {
        const run = globalThis.loop_wagon_game.simulateRun(parameters, false);
        return { release_time: run.release_time, event_time: run.event_time, outcome: run.outcome };
    }, { ...data, launch_speed });
    const time_scale = Math.sqrt(radius / data.gravity);

    await page.fill("#number_game_value", success_speed.toFixed(2));
    const success = await runOf(success_speed);
    const wind_up = [1.5 * time_scale, 5 * time_scale, 7 * time_scale, (7 * time_scale + success.release_time) / 2, success.release_time + 0.25, success.release_time + 0.7];
    for (const [index, time] of wind_up.entries()) {
        await seek(page, time);
        await shootScene(`jeu-elan-${index + 1}.png`);
    }
    await shoot("jeu-ecran-complet.png");

    await page.fill("#number_game_value", failure_speed.toFixed(2));
    const failure = await runOf(failure_speed);
    const failing = [failure.release_time + 0.3, failure.event_time - 0.25, failure.event_time + 0.2, failure.event_time + 0.8];
    for (const [index, time] of failing.entries()) {
        await seek(page, time);
        await shootScene(`jeu-rate-${index + 1}.png`);
    }
    console.log(`challenge ${JSON.stringify(data)}`);
    console.log(`success v0 ${success_speed.toFixed(2)} m/s ${JSON.stringify(success)} frames ${wind_up.map((t) => t.toFixed(2)).join(" ")}`);
    console.log(`failure v0 ${failure_speed.toFixed(2)} m/s ${JSON.stringify(failure)} frames ${failing.map((t) => t.toFixed(2)).join(" ")}`);

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-BE" });
    await phone.goto(PAGE);
    await phone.waitForTimeout(400);
    await phone.screenshot({ path: path.join(OUTPUT, "looping-telephone.png") });
    await browser.close();
    console.log(`captures written to ${OUTPUT}`);
})();
