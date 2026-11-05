/*
 * donnees.mjs — Generates the numbers and CSV data of the bucket-game report
 * from the real code of the site (src/mechanics/loop-wagon/game.js): the
 * hanging bucket at rest against T = (m + μL) g and the formula of R, the
 * shooting of the throw energy toward the chosen v₀, the rope tension of the
 * free turns against the course formula, the speed of the free turns against
 * v² = v₀² − 2 g R (1 − cos(θ)), and the success
 * threshold k* = v₀/√(5 g R) of the simulation against the course (k = 1) and
 * a rigid rotating chain that includes the bar and the rope (k_chaîne).
 * Run from the repository root:
 *   node memoire/rapport-jeu-seau/outils/donnees.mjs
 * Output: memoire/rapport-jeu-seau/figures/donnees/*.csv (+ summary on stdout)
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const OUTPUT = path.resolve(HERE, "../figures/donnees");
await import(pathToFileURL(path.join(ROOT, "src/mechanics/loop-wagon/game.js")).href);
const game = globalThis.loop_wagon_game;
const internals = loadInternals();
const GRAVITY = 9.81;
const FRAME_RATE = 60;

/* loadInternals: a second evaluation of game.js exposing its private stepState */
function loadInternals() {
    const source = fs.readFileSync(path.join(ROOT, "src/mechanics/loop-wagon/game.js"), "utf8").replace("        const api = {", "        globalThis.internals = { stepState, bucketCenter };\n        const api = {");
    const context = vm.createContext({ structuredClone });
    vm.runInContext(source, context);
    return { ...context.internals, game: context.loop_wagon_game };
}

/* writeCsv: header + rows, numbers with 5 significant digits */
function writeCsv(name, header, rows) {
    const lines = [header.join(","), ...rows.map((row) => row.map((value) => (typeof value === "number" ? Number(value.toPrecision(5)) : value)).join(","))];
    fs.writeFileSync(path.join(OUTPUT, name), `${lines.join("\n")}\n`);
    console.log(`${name}: ${rows.length} rows`);
}

/* centerAngle: angle of the filled bucket's centre of mass around the pivot, from the lowest point */
function centerAngle(frame) {
    return Math.atan2(frame.center[0], game.PIVOT_HEIGHT - frame.center[1]);
}

/* restCheck: hanging system held at rest for 2 s (bar tip fixed, 2400
   substeps/s) — mean rope tension of the last second and distance pivot →
   centre of mass against (m + μL) g and bucketRadius */
function restCheck() {
    const rows = [];
    for (const mass of [0.6, 2, 5, 8]) {
        const state = internals.game.initialState({ gravity: GRAVITY, rope_length: 0.4, mass });
        let sum = 0;
        for (let step = 0; step < 2 * game.SUBSTEP_RATE; step++) {
            const tension = internals.stepState(state, GRAVITY, 1 / game.SUBSTEP_RATE, 0);
            sum += step >= game.SUBSTEP_RATE ? tension : 0;
        }
        const center = internals.bucketCenter(state);
        rows.push([mass, state.drops.length, sum / game.SUBSTEP_RATE, (mass + game.ROPE_LINEAR_DENSITY * 0.4) * GRAVITY,
            game.PIVOT_HEIGHT - center.y, game.bucketRadius(0.4, mass)]);
    }
    writeCsv("repos.csv", ["m", "gouttes", "T_simulee", "T_theorie", "R_simule", "R_formule"], rows);
}

/* shootingAndTension: one successful attempt (Earth, L = 0.4 m, m = 2 kg,
   v₀ = 1.15 √(5 g R)) — its shots (target energy over ½ v₀², v over v₀) and the tension of its
   free turns against m (v₀²/R + g (3 cos(θ) − 2)) with the energy of the
   centre of mass at the release */
function shootingAndTension() {
    const parameters = { gravity: GRAVITY, rope_length: 0.4, mass: 2, tension_max: 1e9 };
    const radius = game.bucketRadius(parameters.rope_length, parameters.mass);
    parameters.launch_speed = 1.15 * Math.sqrt(5 * GRAVITY * radius);
    const run = game.simulateRun(parameters);
    writeCsv("tirs.csv", ["tir", "E_sur_E0", "v_sur_v0"], run.shots.map((shot, index) => [index + 1, shot.target / (parameters.launch_speed ** 2 / 2), shot.speed / parameters.launch_speed]));
    const rows = run.frames.filter((frame) => frame.released && frame.time <= run.event_time).map((frame) => [
        frame.time - run.release_time, frame.tension, parameters.mass * game.tensionPerMass(GRAVITY, radius, parameters.launch_speed, centerAngle(frame)),
    ]);
    writeCsv("tension_seau.csv", ["t", "simulee", "ideale"], rows);
    const free = run.frames.filter((frame) => frame.released && frame.time <= run.event_time);
    const speeds = [];
    for (let i = 1; i + 1 < free.length; i++) {
        const speed = Math.hypot(free[i + 1].center[0] - free[i - 1].center[0], free[i + 1].center[1] - free[i - 1].center[1]) * FRAME_RATE / 2;
        const theta = centerAngle(free[i]);
        speeds.push([free[i].time - run.release_time, speed, Math.sqrt(Math.max(run.launch_speed ** 2 - 2 * GRAVITY * radius * (1 - Math.cos(theta)), 0))]);
    }
    writeCsv("vitesse_seau.csv", ["t", "simulee", "attendue"], speeds);
    const bottom = game.bottomTension(parameters.rope_length, parameters.mass, parameters.launch_speed ** 2, GRAVITY);
    console.log(`  v0 = ${parameters.launch_speed.toFixed(4)} m/s, measured ${run.launch_speed.toFixed(4)} m/s (${((run.launch_speed / parameters.launch_speed - 1) * 100).toFixed(4)} %), ${run.shots.length} shots, R = ${radius.toFixed(4)} m`);
    console.log(`  ideal bottom tension ${bottom.toFixed(1)} N (bucket ${(parameters.mass * (parameters.launch_speed ** 2 / radius + GRAVITY)).toFixed(1)} N), peak ${run.max_tension.toFixed(1)} N, outcome ${run.outcome}`);
}

/* chainThreshold: k of a rigid rotating chain (bar m_b, I_b = m_b L_b²/3,
   rope μ, bucket m at R): ½ I ω₀² = ½ I ω_s² + 2 g S with S = Σ m_i r_i, and
   T ≥ 0 at the top, ω_s² R ≥ g ⇒ v₀² ≥ g R (1 + 4 S R / I), k = √((1 + 4 S R/I)/5) */
function chainThreshold(rope_length, mass) {
    const radius = game.bucketRadius(rope_length, mass);
    const inner = game.BAR_LENGTH;
    const outer = game.BAR_LENGTH + rope_length;
    const inertia = mass * radius ** 2 + game.BAR_MASS * inner ** 2 / 3 + game.ROPE_LINEAR_DENSITY * (outer ** 3 - inner ** 3) / 3;
    const moment = mass * radius + game.BAR_MASS * inner / 2 + game.ROPE_LINEAR_DENSITY * rope_length * (inner + rope_length / 2);
    return Math.sqrt((1 + 4 * moment * radius / inertia) / 5);
}

/* threshold: smallest k = v₀/√(5 g R) giving a success, by bisection on the simulation */
function threshold(gravity, rope_length, mass) {
    const ideal = Math.sqrt(5 * gravity * game.bucketRadius(rope_length, mass));
    let low = 0.9;
    let high = 1.15;
    for (let i = 0; i < 7; i++) {
        const middle = (low + high) / 2;
        const outcome = game.simulateRun({ gravity, rope_length, mass, tension_max: 1e9, launch_speed: middle * ideal }, false).outcome;
        if (outcome === "success") {
            high = middle;
        } else {
            low = middle;
        }
    }
    return high;
}

/* thresholdTable: simulated threshold over places, rope lengths and masses,
   against k = 1 (course) and k_chaîne */
function thresholdTable() {
    const rows = [];
    for (const [key, gravity, rope_length, mass] of [["earth", 9.81, 0.2, 1], ["earth", 9.81, 0.4, 2], ["earth", 9.81, 0.55, 5], ["mars", 3.71, 0.35, 2], ["moon", 1.62, 0.45, 3], ["venus", 8.87, 0.3, 3]]) {
        rows.push([key, gravity, rope_length, mass, game.bucketRadius(rope_length, mass), threshold(gravity, rope_length, mass), chainThreshold(rope_length, mass)]);
    }
    writeCsv("seuil_seau.csv", ["lieu", "g", "L", "m", "R", "k_simule", "k_chaine"], rows);
}

/* timing: time of one attempt and of one challenge (seeded) on this machine */
function timing() {
    let start = performance.now();
    const run = game.simulateRun({ gravity: GRAVITY, rope_length: 0.4, mass: 2, tension_max: 1e9, launch_speed: 10 }, false);
    console.log(`  one attempt: ${((performance.now() - start) / 1000).toFixed(2)} s (${run.shots.length} shots)`);
    let seed = 7;
    const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    start = performance.now();
    const count = 4;
    for (let i = 0; i < count; i++) {
        game.randomChallenge(rng);
    }
    console.log(`  challenge generation: ${((performance.now() - start) / count / 1000).toFixed(1)} s per challenge`);
}

fs.mkdirSync(OUTPUT, { recursive: true });
restCheck();
shootingAndTension();

thresholdTable();
timing();
