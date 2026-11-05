/*
 * captures.cjs — Screenshots of the bucket game for the report (Playwright,
 * Chromium, page opened over file:// as students do). The page computes its
 * challenges in a Web Worker, so the drawn challenge is not reproducible; the
 * script keeps drawing until the free variable is v₀ and prints the challenge.
 * The capture times come from the run itself (motor phases and outcome of
 * simulateRun). Run from the repository root:
 *   node memoire/rapport-jeu-seau/outils/captures.cjs
 * Output: memoire/rapport-jeu-seau/figures/captures/*.png
 */
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium } = require(path.resolve(__dirname, "../../../node_modules/@playwright/test"));

const ROOT = path.resolve(__dirname, "../../..");
const OUTPUT = path.resolve(__dirname, "../figures/captures");
const PAGE = pathToFileURL(path.join(ROOT, "src/mechanics/loop-wagon/index.html")).href;

/* seek: move main.js's clock through the (hidden) timeline input */
async function seek(page, time) {
    await page.evaluate((target) => {
        const timeline = document.getElementById("timeline");
        timeline.max = 1000;
        timeline.value = target;
        timeline.dispatchEvent(new Event("input"));
    }, time);
    await page.waitForTimeout(150);
}

/* ready: wait until the page has computed its challenge and attempt */
async function ready(page) {
    await page.locator('.game-panel[data-state="ready"]').waitFor({ timeout: 180000 });
}

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
        await ready(page);
    }
    throw new Error("no v₀ challenge drawn");
}

/* phaseTimes: first time of each motor phase, release and outcome of a run */
function phaseTimes(page, parameters) {
    return page.evaluate((input) => {
        const run = globalThis.loop_wagon_game.simulateRun(input, true);
        const first = (phase) => run.frames.find((frame) => frame.motor_phase === phase)?.time ?? null;
        return { swing: first("swing"), throw: first("throw"), align: first("align"), release: run.release_time, event: run.event_time, outcome: run.outcome, launch_speed: run.launch_speed };
    }, parameters);
}

(async () => {
    fs.mkdirSync(OUTPUT, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", locale: "fr-BE" });
    const shootScene = async (name) => {
        await page.evaluate(() => window.scrollTo(0, 0));
        const box = await page.locator(".scene-panel").boundingBox();
        await page.screenshot({ path: path.join(OUTPUT, name), clip: box });
    };

    await page.goto(PAGE);
    await page.waitForTimeout(400);
    await page.click(".mode-tabs button:nth-child(2)");
    await ready(page);
    const data = await speedChallenge(page);
    const radius = await page.evaluate((challenge) => globalThis.loop_wagon_game.bucketRadius(challenge.rope_length, challenge.mass), data);
    const minimum = Math.sqrt(5 * data.gravity * radius);
    const window = await page.evaluate((challenge) => globalThis.loop_wagon_game.winningWindow({ variable: "launch_speed", launch_speed: null, ...challenge }), data);
    const success_speed = (window.minimum + window.maximum) / 2;
    const failure_speed = 0.9 * minimum;

    await page.fill("#number_game_value", success_speed.toFixed(2));
    await ready(page);
    const success = await phaseTimes(page, { ...data, launch_speed: Number(success_speed.toFixed(2)) });
    const moments = {
        "jeu-elan.png": (success.swing + success.throw) / 2,
        "jeu-lancer.png": (success.throw + success.align) / 2,
        "jeu-lacher.png": success.release,
        "jeu-tour-libre.png": success.release + 0.45,
    };
    for (const [name, time] of Object.entries(moments)) {
        await seek(page, time);
        await shootScene(name);
    }
    await seek(page, success.release + 0.45);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUTPUT, "jeu-ecran-complet.png") });

    await page.fill("#number_game_value", failure_speed.toFixed(2));
    await ready(page);
    const failure = await phaseTimes(page, { ...data, launch_speed: Number(failure_speed.toFixed(2)) });
    await seek(page, failure.event + 0.35);
    await shootScene("jeu-rate.png");

    console.log(`challenge ${JSON.stringify(data)} R ${radius.toFixed(4)} m window ${window.minimum.toFixed(2)}–${window.maximum.toFixed(2)} m/s`);
    console.log(`success v0 ${success_speed.toFixed(2)} m/s ${JSON.stringify(success)}`);
    console.log(`failure v0 ${failure_speed.toFixed(2)} m/s ${JSON.stringify(failure)}`);
    await browser.close();
})();
