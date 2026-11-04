/*
 * donnees.mjs — Generates the numbers and CSV data of the bucket-game report
 * from the real code of the site (src/mechanics/loop-wagon/game.js): rope
 * tension after the release against the ideal formula, rope stretch with a
 * one-pass Gauss–Seidel projection versus the direct tridiagonal solve, the
 * simulated water threshold k = v₀ / √(5 g R) at the success threshold, and the bottom speed and peak
 * tension of the free turns compared with v₀ and m (v₀²/R + g).
 * Run from the repository root:
 *   node memoire/rapport-jeu-seau/outils/donnees.mjs
 * Output: memoire/rapport-jeu-seau/figures/donnees/*.csv (+ summary on stdout)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const OUTPUT = path.resolve(HERE, "../figures/donnees");
await import(pathToFileURL(path.join(ROOT, "src/mechanics/loop-wagon/game.js")).href);
const game = globalThis.loop_wagon_game;
const GRAVITY = 9.81;
const FRAME_RATE = 60;

/* writeCsv: header + rows, numbers with 5 significant digits */
function writeCsv(name, header, rows) {
    const lines = [header.join(","), ...rows.map((row) => row.map((value) => (typeof value === "number" ? Number(value.toPrecision(5)) : value)).join(","))];
    fs.writeFileSync(path.join(OUTPUT, name), `${lines.join("\n")}\n`);
    console.log(`${name}: ${rows.length} rows`);
}

/* bucketAngle: angle of the bucket centre around the pivot, from the lowest point */
function bucketAngle(frame) {
    const center = frame.nodes[frame.nodes.length - 1];
    return Math.atan2(center[0], game.PIVOT_HEIGHT - center[1]);
}

/* tensionVersusIdeal: simulated rope tension after the release against
   m (v₀²/R + g (3 cos(θ) − 2)), time counted from the release */
function tensionVersusIdeal() {
    const parameters = { gravity: GRAVITY, rope_length: 0.4, mass: 2, tension_max: 1e9 };
    const radius = game.bucketRadius(parameters.rope_length);
    parameters.launch_speed = 1.15 * Math.sqrt(5 * GRAVITY * radius);
    const run = game.simulateRun(parameters);
    const rows = run.frames.filter((frame) => frame.released && frame.time <= run.event_time).map((frame) => {
        const theta = bucketAngle(frame);
        return [frame.time - run.release_time, frame.tension, parameters.mass * game.tensionPerMass(GRAVITY, radius, parameters.launch_speed, theta)];
    });
    writeCsv("tension_seau.csv", ["t", "simulee", "ideale"], rows);
    console.log(`  v0 = ${parameters.launch_speed.toFixed(3)} m/s, R = ${radius.toFixed(3)} m, release ${run.release_time.toFixed(2)} s, outcome ${run.outcome}`);
}

/* freeTurns: first passage at the lowest point after the release — bucket speed
   from the 60 Hz frames (central difference) against v₀ — and peak tension of
   the free turns against m (v₀²/R + g), for a few set-ups at k = 1.2 */
function freeTurns() {
    const rows = [];
    for (const [gravity, rope_length, mass] of [[9.81, 0.2, 5], [9.81, 0.4, 2], [9.81, 0.6, 0.5], [3.71, 0.4, 2], [1.62, 0.6, 1]]) {
        const radius = game.bucketRadius(rope_length);
        const launch_speed = 1.2 * Math.sqrt(5 * gravity * radius);
        const run = game.simulateRun({ gravity, rope_length, mass, tension_max: 1e9, launch_speed });
        const frames = run.frames;
        let bottom_speed = null;
        for (let i = 1; i + 1 < frames.length; i++) {
            if (frames[i].released && frames[i - 1].released && bucketAngle(frames[i - 1]) < 0 && bucketAngle(frames[i]) >= 0) {
                const before = frames[i - 1].nodes[frames[i - 1].nodes.length - 1];
                const after = frames[i + 1].nodes[frames[i + 1].nodes.length - 1];
                bottom_speed = Math.hypot(after[0] - before[0], after[1] - before[1]) * FRAME_RATE / 2;
                break;
            }
        }
        rows.push([gravity, rope_length, mass, launch_speed, bottom_speed / launch_speed, run.max_tension / (mass * (launch_speed ** 2 / radius + gravity)), run.outcome]);
    }
    writeCsv("tours_libres.csv", ["g", "L", "m", "v0", "v_bas_sur_v0", "T_max_sur_ideal", "issue"], rows);
}

/* freeChain: the chain of the game straight down, every point in rigid rotation
   so that the bucket moves at v₀ — the common start of both solvers below */
function freeChain(parameters) {
    const state = game.initialState(parameters);
    const radius = game.bucketRadius(parameters.rope_length);
    const link = parameters.rope_length / game.ROPE_LINKS;
    state.nodes[game.HANDLE].inverse_mass = state.nodes[game.HANDLE - 1].inverse_mass;
    state.nodes.forEach((node, index) => {
        const distance = index === 0 ? 0 : (index === game.CENTER ? radius : game.BAR_LENGTH + (index - 1) * link);
        node.x = 0;
        node.y = game.PIVOT_HEIGHT - distance;
        node.velocity_x = parameters.launch_speed / radius * distance;
        node.velocity_y = 0;
    });
    state.nodes[1].inverse_mass = 3 / 0.3;
    return state;
}

/* ropeLength: Σ link lengths of the rope between the bar tip and the handle */
function ropeLength(nodes) {
    let total = 0;
    for (let i = 1; i <= game.ROPE_LINKS; i++) {
        total += Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].y - nodes[i].y);
    }
    return total;
}

/* ropeStretch: total stretch of the rope with the direct tridiagonal solve of
   game.js and with a one-pass Gauss–Seidel projection, same chain, same start */
function ropeStretch() {
    const parameters = { gravity: GRAVITY, rope_length: 0.3, mass: 5, tension_max: 1e9 };
    parameters.launch_speed = 1.05 * Math.sqrt(5 * GRAVITY * game.bucketRadius(parameters.rope_length));
    const dt = 1 / game.SUBSTEP_RATE;
    const runs = ["gauss_seidel", "direct"].map((method) => {
        const state = freeChain(parameters);
        const series = [];
        for (let step = 0; step <= 0.8 * game.SUBSTEP_RATE; step++) {
            if (step % (game.SUBSTEP_RATE / FRAME_RATE) === 0) {
                series.push(1000 * (ropeLength(state.nodes) - parameters.rope_length));
            }
            for (const node of state.nodes.slice(1)) {
                node.previous_x = node.x;
                node.previous_y = node.y;
                node.velocity_y -= GRAVITY * dt;
                node.x += node.velocity_x * dt;
                node.y += node.velocity_y * dt;
            }
            if (method === "direct") {
                game.solveChain(state.nodes, state.link_lengths, state.rope_flags, -1, state.work);
            } else {
                state.link_lengths.forEach((length, i) => {
                    const a = state.nodes[i];
                    const b = state.nodes[i + 1];
                    const distance = Math.hypot(b.x - a.x, b.y - a.y);
                    const violation = distance - length;
                    if (a.inverse_mass + b.inverse_mass === 0 || (state.rope_flags[i] && violation <= 0)) {
                        return;
                    }
                    const lambda = -violation / (a.inverse_mass + b.inverse_mass);
                    a.x -= a.inverse_mass * lambda * (b.x - a.x) / distance;
                    a.y -= a.inverse_mass * lambda * (b.y - a.y) / distance;
                    b.x += b.inverse_mass * lambda * (b.x - a.x) / distance;
                    b.y += b.inverse_mass * lambda * (b.y - a.y) / distance;
                });
            }
            for (const node of state.nodes.slice(1)) {
                node.velocity_x = (node.x - node.previous_x) / dt;
                node.velocity_y = (node.y - node.previous_y) / dt;
            }
        }
        return series;
    });
    writeCsv("allongement_corde.csv", ["t", "gauss_seidel", "directe"], runs[0].map((value, index) => [index / FRAME_RATE, value, runs[1][index]]));
    console.log(`  final stretch: Gauss–Seidel ${runs[0].at(-1).toFixed(2)} mm, direct ${runs[1].at(-1).toFixed(4)} mm`);
}

/* threshold: smallest k = v₀/√(5 g R) giving a success, by bisection on the simulation */
function threshold(gravity, rope_length, mass) {
    const ideal = Math.sqrt(5 * gravity * game.bucketRadius(rope_length));
    let low = 0.8;
    let high = 1.15;
    for (let i = 0; i < 10; i++) {
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

/* thresholdTable: simulated threshold over places, rope lengths and masses */
function thresholdTable() {
    const rows = [];
    for (const place of game.PLACES) {
        for (const rope_length of [0.2, 0.4, 0.6]) {
            for (const mass of [1, 5]) {
                rows.push([place.key, place.gravity, rope_length, mass, threshold(place.gravity, rope_length, mass)]);
            }
        }
    }
    writeCsv("seuil_seau.csv", ["lieu", "g", "L", "m", "k"], rows);
    const values = rows.map((row) => row[4]);
    console.log(`  k in [${Math.min(...values).toFixed(3)}, ${Math.max(...values).toFixed(3)}]`);
}

/* generationTime: mean time to draw one solvable challenge (seeded) */
function generationTime() {
    let seed = 7;
    const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const start = performance.now();
    const count = 20;
    for (let i = 0; i < count; i++) {
        game.randomChallenge(rng);
    }
    console.log(`  challenge generation: ${((performance.now() - start) / count / 1000).toFixed(2)} s per challenge`);
}

fs.mkdirSync(OUTPUT, { recursive: true });
tensionVersusIdeal();
freeTurns();
ropeStretch();
thresholdTable();
generationTime();
