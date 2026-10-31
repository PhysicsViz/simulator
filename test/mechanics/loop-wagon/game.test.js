/*
 * game.test.js — Unit tests for the pure logic of the wagon-loop "bucket on a
 * rope" game mode (game.js): hand-computed ideal theory (T/m = v₀²/R + g (3 cos(θ) − 2),
 * v₀ ≥ √(5 g R), T ≤ T_max) against tensionPerMass, idealWindow and winningWindow
 * for the three free variables, cross-check with the wagon's normalPerMass from
 * calcul.js, the one-sided chain projection solveChain on hand-made chains, the
 * outcomes of the full XPBD simulation (success, spill, snap, swing), determinism,
 * the motor model (phase sequence swing → throw → align → free, kinematic bar tip
 * until the release, lead geometry, critically damped bar, joint friction, substep
 * rate), the cached pumping phase (cold = warm = from scratch, T_max below its
 * peak), drop_count (count, radius, water volume, containment, no back-action on
 * the bucket), evaluate / fillThreshold, the feasibility checker on fallback and
 * impossible challenges, seeded Monte-Carlo solvability of randomChallenge,
 * anti-repeat, variable frequencies and milestones.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import "../../../src/mechanics/loop-wagon/calcul.js";
import "../../../src/mechanics/loop-wagon/game.js";
import { loadGameInternals } from "./helpers/game_internals.js";

const { buildTrack, pointAt, normalPerMass } = globalThis.loop_wagon_calcul;
const {
    MILESTONES,
    VARIABLES,
    FALLBACK_CHALLENGES,
    ROPE_LINKS,
    HANDLE,
    CENTER,
    DROP_COUNT,
    DROP_RADIUS,
    BUCKET,
    bucketRadius,
    tensionPerMass,
    idealWindow,
    resolveParameters,
    winningWindow,
    initialState,
    solveChain,
    simulateRun,
    frameAt,
    fillThreshold,
    evaluate,
    isChallengeFeasible,
    drawVariable,
    randomChallenge,
    nextMilestone,
    BAR_LENGTH,
    PIVOT_HEIGHT,
    SUBSTEP_RATE,
} = globalThis.loop_wagon_game;
const { api: motor_api, internals } = loadGameInternals();

const EARTH = 9.81;
const MOON = 1.62;
const FIXED_LENGTH = BAR_LENGTH + BUCKET.center_of_mass;
const LOW = 1.06 ** 2;
const TENSION_SHARE = 0.8;
const ROPE_DENSITY = 0.15;
const MONTE_CARLO_COUNT = 96;
const MONTE_CARLO_WORKERS = 8;
const REPLAYED_WORKERS = 4;
const DRAW_COUNT = 5000;

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

/* seededRandom: reproducible uniform generator (mulberry32) */
function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
}

/* makeChallenge: challenge with the free variable left null */
function makeChallenge(variable, gravity, launch_speed, rope_length, mass, tension_max) {
    return {
        variable,
        place: "test",
        gravity,
        launch_speed: variable === "launch_speed" ? null : launch_speed,
        rope_length: variable === "rope_length" ? null : rope_length,
        mass: variable === "mass" ? null : mass,
        tension_max,
    };
}

/* makeWorkspace: solver arrays for a chain of link_count links (as the game allocates them) */
function makeWorkspace(link_count) {
    return {
        unit_x: new Float64Array(link_count),
        unit_y: new Float64Array(link_count),
        violation: new Float64Array(link_count),
        active: new Uint8Array(link_count),
        diagonal: new Float64Array(link_count),
        upper: new Float64Array(link_count),
        right: new Float64Array(link_count),
        delta: new Float64Array(link_count),
        lambdas: new Float64Array(link_count),
        shift_x: new Float64Array(link_count + 1),
        shift_y: new Float64Array(link_count + 1),
    };
}

/* verticalChain: nodes hanging down from the origin at the given depths, inverse masses w */
function verticalChain(depths, inverse_masses) {
    return depths.map((depth, i) => ({ x: 0, y: -depth, inverse_mass: inverse_masses[i] }));
}

/* distanceBetween: Euclidean distance of two nodes */
function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/* runParameters: simulateRun parameters with a generous breaking tension */
function runParameters(gravity, rope_length, mass, speed_factor, tension_max = 1e4) {
    const radius = bucketRadius(rope_length);
    return { gravity, rope_length, mass, tension_max, launch_speed: speed_factor * Math.sqrt(5 * gravity * radius) };
}

test("bucketRadius is R = L_b + L + d", () => {
    assertClose(bucketRadius(0.4), 0.9 + 0.4 + 0.19, 1e-15, "R for L = 0.4");
    assertClose(bucketRadius(0.15), 1.24, 1e-15, "R for L = 0.15");
    assertClose(bucketRadius(0.6), 1.69, 1e-15, "R for L = 0.6");
});

test("tensionPerMass: bottom, side, top and energy form v²/R + g cos(θ)", () => {
    const radius = 1.49;
    const speed = 9;
    assertClose(tensionPerMass(EARTH, radius, speed, 0), 81 / 1.49 + EARTH, 1e-12, "bottom v₀²/R + g");
    assertClose(tensionPerMass(EARTH, radius, speed, Math.PI / 2), 81 / 1.49 - 2 * EARTH, 1e-12, "θ = 90°: v₀²/R − 2 g");
    assertClose(tensionPerMass(EARTH, radius, speed, Math.PI), 81 / 1.49 - 5 * EARTH, 1e-12, "top v₀²/R − 5 g");
    for (const theta of [0.3, 1.1, 2.4, 3]) {
        const speed_squared = speed * speed - 2 * EARTH * radius * (1 - Math.cos(theta));
        assertClose(tensionPerMass(EARTH, radius, speed, theta), speed_squared / radius + EARTH * Math.cos(theta), 1e-12, `energy form at θ = ${theta}`);
    }
});

test("tensionPerMass equals the wagon's N/m on a loop of radius R released at h = v₀²/(2 g)", () => {
    const cases = [
        { gravity: EARTH, radius: 1.49, speed: 9 },
        { gravity: MOON, radius: 1.24, speed: 2.9 },
        { gravity: 3.71, radius: 1.2, speed: 5 },
    ];
    for (const { gravity, radius, speed } of cases) {
        const start_height = speed * speed / (2 * gravity);
        assert.ok(start_height <= 3 * radius, "h must not be capped by buildTrack");
        const track = buildTrack(radius, start_height);
        assertClose(track.start_height, start_height, 1e-12, "h kept");
        for (const theta of [1e-9, 0.7, Math.PI / 2, 2.5, Math.PI]) {
            assert.ok(radius * (1 - Math.cos(theta)) <= start_height, "point reachable");
            const point = pointAt(track, track.loop_start + theta * radius);
            assertClose(tensionPerMass(gravity, radius, speed, theta), normalPerMass(gravity, start_height, point), 1e-9, `g = ${gravity}, θ = ${theta}`);
        }
    }
});

test("idealWindow: √(5 g R) and √((T_max/m − g) R), upper end zero when the rope cannot carry m g", () => {
    const radius = 0.9 + 0.4 + 0.19;
    const window = idealWindow(EARTH, 0.4, 2, 180);
    assertClose(window.minimum, Math.sqrt(5 * 9.81 * 1.49), 1e-12, "minimum");
    assertClose(window.maximum, Math.sqrt((90 - 9.81) * 1.49), 1e-12, "maximum");
    const moon = idealWindow(MOON, 0.15, 1, 40);
    assertClose(moon.minimum, Math.sqrt(5 * 1.62 * 1.24), 1e-12, "moon minimum");
    assertClose(moon.maximum, Math.sqrt((40 - 1.62) * 1.24), 1e-12, "moon maximum");
    const weak = idealWindow(EARTH, 0.4, 2, 15);
    assert.equal(weak.maximum, 0, "T_max < m g");
    assertClose(weak.minimum, Math.sqrt(5 * EARTH * radius), 1e-12, "minimum unaffected");
});

test("resolveParameters substitutes the value of the free variable only", () => {
    const base = { launch_speed: 7, rope_length: 0.4, mass: 2 };
    assert.deepEqual(resolveParameters({ ...base, variable: "launch_speed", launch_speed: null }, 9), { launch_speed: 9, rope_length: 0.4, mass: 2 });
    assert.deepEqual(resolveParameters({ ...base, variable: "rope_length", rope_length: null }, 0.5), { launch_speed: 7, rope_length: 0.5, mass: 2 });
    assert.deepEqual(resolveParameters({ ...base, variable: "mass", mass: null }, 3), { launch_speed: 7, rope_length: 0.4, mass: 3 });
});

/* bottomTension: hand formula of the bar-end tension at the bottom, m (v₀²/R + g) + μ L (ω² (L_b + L/2) + g), ω = v₀/R */
function bottomTension(gravity, rope_length, mass, speed) {
    const radius = bucketRadius(rope_length);
    return mass * (speed * speed / radius + gravity) + ROPE_DENSITY * rope_length * ((speed / radius) ** 2 * (BAR_LENGTH + rope_length / 2) + gravity);
}

test("winningWindow (v₀): 1.06 √(5 g R) up to the speed whose bottom tension (rope included) is 0.8 T_max", () => {
    const challenge = makeChallenge("launch_speed", EARTH, null, 0.4, 2, 180);
    const window = winningWindow(challenge);
    assertClose(window.minimum, 1.06 * Math.sqrt(5 * 9.81 * 1.49), 1e-12, "minimum = 1.06 √(5 g R)");
    assertClose(window.maximum, 9.4988, 1e-3, "hand value of the maximum");
    assertClose(bottomTension(EARTH, 0.4, 2, window.maximum), TENSION_SHARE * 180, 1e-9, "tension at the maximum");
    assert.ok(window.maximum < Math.sqrt((TENSION_SHARE * 90 - 9.81) * 1.49) + 1e-9, "the rope's own load lowers the massless limit");
    const moon = winningWindow(makeChallenge("launch_speed", MOON, null, 0.5, 3, 110));
    assertClose(moon.minimum, 1.06 * Math.sqrt(5 * 1.62 * 1.59), 1e-12, "moon minimum");
    assertClose(bottomTension(MOON, 0.5, 3, moon.maximum), TENSION_SHARE * 110, 1e-9, "moon: tension at the maximum");
});

test("winningWindow (L): minimum is the rope whose bottom tension is 0.8 T_max, maximum the one whose water limit is the given v₀", () => {
    const speed = 9;
    const challenge = makeChallenge("rope_length", EARTH, speed, null, 2, 180);
    const window = winningWindow(challenge);
    assertClose(window.minimum, 0.2337, 1e-3, "hand value of the minimum");
    assertClose(window.maximum, 0.3797, 1e-3, "hand value of the maximum");
    assertClose(bottomTension(EARTH, window.minimum, 2, speed), TENSION_SHARE * 180, 1e-6, "minimum L: rope at its limit");
    assertClose(window.maximum, speed * speed / (5 * EARTH * LOW) - FIXED_LENGTH, 1e-12, "maximum L: water at its limit");
    assert.ok(window.minimum < window.maximum);
    const at_minimum = winningWindow(makeChallenge("launch_speed", EARTH, null, window.minimum, 2, 180));
    assertClose(at_minimum.maximum, speed, 1e-6, "v₀ window upper end at L_min");
    const at_maximum = winningWindow(makeChallenge("launch_speed", EARTH, null, window.maximum, 2, 180));
    assertClose(at_maximum.minimum, speed, 1e-9, "v₀ window lower end at L_max");
});

test("winningWindow (m): [0.9 m_max, m_max], m_max = (0.8 T_max − μ L (ω² r_mid + g)) / (v₀²/R + g)", () => {
    const challenge = makeChallenge("mass", EARTH, 9.3, 0.4, null, 300);
    const window = winningWindow(challenge);
    assertClose(window.maximum, 3.4903, 1e-3, "hand value of m_max");
    assertClose(bottomTension(EARTH, 0.4, window.maximum, 9.3), TENSION_SHARE * 300, 1e-9, "tension at m_max");
    assertClose(window.minimum, 0.9 * window.maximum, 1e-12, "0.9 m_max");
});

test("winningWindow is empty when the challenge is infeasible", () => {
    const empty = { minimum: Infinity, maximum: -Infinity };
    assert.deepEqual(winningWindow(makeChallenge("rope_length", EARTH, 9, null, 2, 15)), empty, "L: T_max/m ≤ g");
    assert.deepEqual(winningWindow(makeChallenge("rope_length", EARTH, 9, null, 2, 2 * EARTH)), empty, "L: T_max/m = g");
    assert.deepEqual(winningWindow(makeChallenge("mass", EARTH, 8.9, 0.4, null, 300)), empty, "m: v₀ < 1.06 √(5 g R) (8.9 < 9.06)");
    const water_only = winningWindow(makeChallenge("mass", EARTH, 9.07, 0.4, null, 300));
    assert.ok(water_only.minimum <= water_only.maximum, "m: v₀ just above 1.06 √(5 g R) is not empty");
    const crossed = winningWindow(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 15));
    assert.ok(crossed.maximum < crossed.minimum, "v₀: 0.8 T_max < (m + μ L) g gives crossed bounds");
});

test("solveChain projects a stretched bilateral link back to its length, λ < 0 when pulling", () => {
    const nodes = verticalChain([0, 1.5], [0, 1]);
    const lambdas = solveChain(nodes, [1], [false], -1, makeWorkspace(1));
    assertClose(distanceBetween(nodes[0], nodes[1]), 1, 1e-12, "length restored");
    assertClose(nodes[1].y, -1, 1e-12, "free node pulled up");
    assertClose(nodes[0].y, 0, 1e-15, "fixed node stays");
    assertClose(lambdas[0], -0.5, 1e-12, "λ = −stretch / w");
});

test("solveChain: a stretched rope link is restored like a bilateral one", () => {
    const nodes = verticalChain([0, 1.5], [0, 1]);
    const lambdas = solveChain(nodes, [1], [true], -1, makeWorkspace(1));
    assertClose(distanceBetween(nodes[0], nodes[1]), 1, 1e-12, "length restored");
    assertClose(lambdas[0], -0.5, 1e-12, "rope pulls: λ < 0");
});

test("solveChain: a compressed rope link is not pushed apart, a compressed bilateral link is", () => {
    const rope = verticalChain([0, 0.5], [0, 1]);
    const rope_lambdas = solveChain(rope, [1], [true], -1, makeWorkspace(1));
    assertClose(rope[1].y, -0.5, 1e-15, "rope node untouched");
    assert.equal(rope_lambdas[0], 0, "no force in a slack rope");
    const bar = verticalChain([0, 0.5], [0, 1]);
    const bar_lambdas = solveChain(bar, [1], [false], -1, makeWorkspace(1));
    assertClose(bar[1].y, -1, 1e-12, "bilateral link restored to its length");
    assertClose(bar_lambdas[0], 0.5, 1e-12, "bilateral link pushes: λ > 0");
});

test("solveChain on a coupled chain: bilateral link then slack rope link", () => {
    const rope_chain = verticalChain([0, 1.5, 1.8], [0, 1, 1]);
    const rope_lambdas = solveChain(rope_chain, [1, 1], [false, true], -1, makeWorkspace(2));
    assertClose(rope_chain[1].y, -1, 1e-12, "first link restored");
    assertClose(rope_chain[2].y, -1.8, 1e-12, "slack rope link leaves its node alone");
    assertClose(rope_lambdas[0], -0.5, 1e-12, "λ of the bilateral link");
    assert.equal(rope_lambdas[1], 0, "λ of the slack rope link");
    const rigid_chain = verticalChain([0, 1.5, 1.8], [0, 1, 1]);
    const rigid_lambdas = solveChain(rigid_chain, [1, 1], [false, false], -1, makeWorkspace(2));
    assertClose(distanceBetween(rigid_chain[0], rigid_chain[1]), 1, 1e-12, "bilateral chain: link 0");
    assertClose(distanceBetween(rigid_chain[1], rigid_chain[2]), 1, 1e-12, "bilateral chain: link 1");
    assertClose(rigid_lambdas[0], -0.3, 1e-12, "coupled λ₀");
    assertClose(rigid_lambdas[1], 0.2, 1e-12, "coupled λ₁");
});

test("solveChain ignores a broken link", () => {
    const nodes = verticalChain([0, 1.5, 3.2], [0, 1, 1]);
    const lambdas = solveChain(nodes, [1, 1], [true, true], 0, makeWorkspace(2));
    assert.equal(lambdas[0], 0, "no force through the broken link");
    assertClose(nodes[0].y, 0, 1e-15, "pivot untouched");
    assertClose(distanceBetween(nodes[1], nodes[2]), 1, 1e-12, "next link still projected");
    assertClose(nodes[1].y, -1.85, 1e-12, "node 1 moved by link 1 only (0.35 toward node 2)");
    assertClose(nodes[2].y, -2.85, 1e-12, "node 2 moved by 0.35 toward node 1");
    assertClose(lambdas[1], -0.35, 1e-12, "link 1 pulls its neighbours together (equal masses)");
});

test("solveChain at rest on the initial state leaves the hanging chain unchanged", () => {
    const state = initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    const before = state.nodes.map((node) => [node.x, node.y]);
    solveChain(state.nodes, state.link_lengths, state.rope_flags, -1, state.work);
    state.nodes.forEach((node, i) => {
        assertClose(node.x, before[i][0], 1e-12, `node ${i} x`);
        assertClose(node.y, before[i][1], 1e-12, `node ${i} y`);
    });
    assert.equal(state.drops.length, DROP_COUNT);
    assert.equal(state.nodes.length, ROPE_LINKS + 3);
    assert.equal(state.nodes[1].inverse_mass, 0, "bar tip driven by the motor");
    assert.equal(state.released, false);
});

const EARTH_CASE = { gravity: EARTH, rope_length: 0.4, mass: 2 };
const MOON_CASE = { gravity: MOON, rope_length: 0.3, mass: 1 };

test("simulateRun: success at 1.08 √(5 g R), 2 turns, no drop lost, rope never stretched, bar and bucket links rigid", () => {
    for (const { gravity, rope_length, mass } of [EARTH_CASE, MOON_CASE]) {
        const parameters = runParameters(gravity, rope_length, mass, 1.08);
        const run = simulateRun(parameters);
        assert.equal(run.outcome, "success", `g = ${gravity}`);
        const last = run.frames[run.frames.length - 1];
        assertClose(last.turns, 2, 0.05, "two full turns");
        assert.ok(last.drops.every((drop) => drop[2] === false), "no spilled drop at the end");
        assert.equal(last.drops.length, DROP_COUNT);
        assert.ok(run.min_tension > 0, "rope taut over the whole free phase");
        assert.equal(run.duration, run.event_time, "a success ends the run at the second turn");
        const link_length = rope_length / ROPE_LINKS;
        let worst_stretch = -Infinity;
        let worst_bar = 0;
        let worst_bucket = 0;
        for (const frame of run.frames) {
            assert.ok(frame.drops.every((drop) => drop[2] === false), `no spill at t = ${frame.time}`);
            for (let i = 1; i < HANDLE; i++) {
                const a = frame.nodes[i];
                const b = frame.nodes[i + 1];
                worst_stretch = Math.max(worst_stretch, Math.hypot(a[0] - b[0], a[1] - b[1]) - link_length);
            }
            worst_bar = Math.max(worst_bar, Math.abs(Math.hypot(frame.nodes[1][0], frame.nodes[1][1] - PIVOT_HEIGHT) - BAR_LENGTH));
            worst_bucket = Math.max(worst_bucket, Math.abs(Math.hypot(frame.nodes[CENTER][0] - frame.nodes[HANDLE][0], frame.nodes[CENTER][1] - frame.nodes[HANDLE][1]) - BUCKET.center_of_mass));
        }
        assert.ok(worst_stretch < 1e-3, `rope stretched by ${worst_stretch} m`);
        assert.ok(worst_bar < 1e-6, `bar length error ${worst_bar} m`);
        assert.ok(worst_bucket < 1e-6, `bucket arm error ${worst_bucket} m`);
    }
});

test("simulateRun: the peak tension is the bottom tension m (v₀²/R + g) + μ L (ω² r_mid + g) within +0 / +25 % (the throw overshoots the energy ½ v₀² by about 12 %)", () => {
    for (const { gravity, rope_length, mass } of [EARTH_CASE, { gravity: EARTH, rope_length: 0.25, mass: 4 }, { gravity: MOON, rope_length: 0.5, mass: 5 }, { gravity: 3.71, rope_length: 0.3, mass: 1 }]) {
        const parameters = runParameters(gravity, rope_length, mass, 1.1);
        const expected = bottomTension(gravity, rope_length, mass, parameters.launch_speed);
        const run = simulateRun(parameters);
        assert.equal(run.outcome, "success");
        const release_frame = run.frames.findIndex((frame) => frame.released);
        assert.ok(release_frame > 0, "the run has a free phase");
        assert.ok(run.frames[release_frame - 1].tension < expected, "the tension is below the bottom value just before the release");
        const peak = Math.max(...run.frames.filter((frame) => frame.released && frame.turns > 0.4).map((frame) => frame.tension));
        assert.ok(peak >= expected && peak <= 1.25 * expected, `g = ${gravity}: peak ${peak} vs ideal ${expected}`);
        assert.ok(run.max_tension >= peak - 1e-9, "the run maximum covers the bottom passage");
        assert.ok(run.max_tension <= 1.25 * expected, `run maximum ${run.max_tension} vs ideal ${expected}`);
    }
});

test("simulateRun: spill at 0.92 √(5 g R) with at least one lost drop", () => {
    for (const { gravity, rope_length, mass } of [EARTH_CASE, MOON_CASE]) {
        const run = simulateRun(runParameters(gravity, rope_length, mass, 0.92));
        assert.equal(run.outcome, "spill", `g = ${gravity}`);
        const last = run.frames[run.frames.length - 1];
        assert.ok(last.drops.some((drop) => drop[2] === true), "a drop is flagged spilled");
        assert.ok(run.event_time > 0 && run.event_time < run.duration, "aftermath recorded after the event");
        assert.ok(run.release_time <= run.event_time + 1e-9, "the motor has let go at the latest when the water falls");
    }
});

test("simulateRun: 0.92 √(5 g R) is never a success, whatever the place, rope length and mass", () => {
    for (const { gravity, rope_length, mass } of [{ gravity: MOON, rope_length: 0.15, mass: 1 }, { gravity: 3.71, rope_length: 0.6, mass: 3 }]) {
        const outcome = simulateRun(runParameters(gravity, rope_length, mass, 0.92), false).outcome;
        assert.ok(outcome === "spill" || outcome === "swing", `g = ${gravity}: ${outcome}`);
    }
});

test("simulateRun: snap exactly when T_max is below the run's own peak tension, and the rope is cut afterwards", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const peak = simulateRun(parameters).max_tension;
    const snapped = simulateRun({ ...parameters, tension_max: 0.95 * peak });
    assert.equal(snapped.outcome, "snap");
    assert.equal(snapped.frames[snapped.frames.length - 1].snapped, true);
    assert.equal(snapped.frames[snapped.frames.length - 1].tension, 0);
    assert.ok(snapped.event_time < snapped.duration);
    assert.equal(simulateRun({ ...parameters, tension_max: 1.05 * peak }, false).outcome, "success");
});

test("simulateRun: swing for v₀² < 2 g R, for a v₀ below the pumping energy and for v₀ = 0", () => {
    const parameters = { gravity: EARTH, rope_length: 0.4, mass: 2, tension_max: 1e4 };
    const below_horizontal = simulateRun({ ...parameters, launch_speed: 0.9 * Math.sqrt(2 * EARTH * 1.49) });
    assert.equal(below_horizontal.outcome, "swing");
    assert.ok(below_horizontal.frames[below_horizontal.frames.length - 1].turns < 1, "no full turn");
    assert.equal(simulateRun({ ...parameters, launch_speed: 0.5 * Math.sqrt(5 * EARTH * 1.49) }, false).outcome, "swing");
    const resting = simulateRun({ ...parameters, launch_speed: 0 });
    assert.equal(resting.outcome, "swing");
    assert.equal(resting.event_time, 0);
    assert.equal(resting.release_time, null);
    assert.equal(resting.frames[0].turns, 0);
    assert.ok(resting.frames.every((frame) => frame.motor_phase === "rest"));
});

test("simulateRun is deterministic: identical runs give identical frames", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const first = simulateRun(parameters);
    const second = simulateRun({ ...parameters });
    assert.deepEqual(second.frames, first.frames);
    assert.equal(second.outcome, first.outcome);
    assert.equal(second.max_tension, first.max_tension);
});

test("simulateRun without recording gives the same outcome and an empty frame list tail", () => {
    for (const factor of [0.92, 1.08]) {
        const parameters = runParameters(EARTH, 0.4, 2, factor);
        const recorded = simulateRun(parameters);
        const quick = simulateRun(parameters, false);
        assert.equal(quick.outcome, recorded.outcome, `factor ${factor}`);
        assertClose(quick.event_time, recorded.event_time, 1e-9, `event time at factor ${factor}`);
        assert.ok(quick.frames.length <= 2, "no frames recorded");
    }
});

test("frameAt returns the last frame at or before t and clamps both ends", () => {
    const run = simulateRun(runParameters(EARTH, 0.4, 2, 1.08));
    assert.equal(frameAt(run, -3), run.frames[0]);
    assert.equal(frameAt(run, 0), run.frames[0]);
    assert.equal(frameAt(run, 0.5 / 60), run.frames[0]);
    assert.equal(frameAt(run, 1 / 60), run.frames[1]);
    assert.equal(frameAt(run, 3 / 60), run.frames[3]);
    assert.equal(frameAt(run, 3.9 / 60), run.frames[3]);
    assert.equal(frameAt(run, 1e9), run.frames[run.frames.length - 1]);
    assert.equal(run.frames[0].nodes.length, CENTER + 1);
});

/* distinctPhases: motor_phase of the frames, consecutive duplicates removed */
function distinctPhases(run) {
    const phases = [];
    for (const frame of run.frames) {
        if (phases[phases.length - 1] !== frame.motor_phase) {
            phases.push(frame.motor_phase);
        }
    }
    return phases;
}

test("motor phases: a successful run goes swing → throw → align → free, release flag and release_time agree", () => {
    for (const { gravity, rope_length, mass } of [EARTH_CASE, MOON_CASE]) {
        const run = simulateRun(runParameters(gravity, rope_length, mass, 1.08));
        assert.equal(run.outcome, "success");
        assert.deepEqual(distinctPhases(run), ["swing", "throw", "align", "free"], `g = ${gravity}`);
        assert.equal(run.frames[0].motor_phase, "swing");
        for (const frame of run.frames) {
            assert.equal(frame.released, frame.motor_phase === "free", `released flag at t = ${frame.time}`);
        }
        const first_free = run.frames.find((frame) => frame.released);
        assert.ok(first_free.time - 1 / 60 - 1e-9 <= run.release_time && run.release_time <= first_free.time + 1e-9, "release_time falls in the first free frame interval");
        assert.ok(run.launch_speed > 0, "bucket speed at the release");
    }
});

test("motor phases: a v₀ small enough for a release at the lowest point also starts with the swing and ends free", () => {
    const radius = bucketRadius(0.4);
    const run = simulateRun({ gravity: EARTH, rope_length: 0.4, mass: 2, tension_max: 1e4, launch_speed: 1.45 * Math.sqrt(EARTH * radius) });
    const phases = distinctPhases(run);
    assert.equal(phases[0], "swing");
    assert.equal(phases[phases.length - 1], "free");
});

test("motor phases: a failure during the drive releases the bar at the event (phase free from then on)", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const peak = simulateRun(parameters).max_tension;
    const run = simulateRun({ ...parameters, tension_max: 0.95 * peak });
    const phases = distinctPhases(run);
    assert.equal(phases[phases.length - 1], "free");
    assert.ok(run.frames.filter((frame) => frame.released).every((frame) => frame.motor_phase === "free"));
});

test("bar tip: inverse mass 0 (kinematic) at the start and during the pumping, m_b/3 inverse mass after the release", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const pumped = internals.pumpedAttempt(parameters, false);
    assert.notEqual(pumped, null, "the pumping reaches the throw");
    assert.equal(pumped.state.nodes[1].inverse_mass, 0, "tip kinematic at the end of the pumping");
    assert.equal(pumped.state.released, false);
    assert.equal(pumped.motor.phase, "swing");
    assertClose(Math.hypot(pumped.state.nodes[1].x, pumped.state.nodes[1].y - PIVOT_HEIGHT), BAR_LENGTH, 1e-9, "tip on the bar circle");
    assert.ok(Math.abs(pumped.motor.bucket_angle) > 0, "the bucket has been pumped");
    internals.advanceAttempt(pumped, parameters, false);
    assert.equal(pumped.state.released, true);
    assert.equal(pumped.motor.phase, "free");
    assertClose(pumped.state.nodes[1].inverse_mass, 3 / 0.3, 1e-12, "effective bar mass m_b/3 after the release");
    assertClose(Math.hypot(pumped.state.nodes[1].x, pumped.state.nodes[1].y - PIVOT_HEIGHT), BAR_LENGTH, 1e-6, "tip still on the bar circle (rigid bar)");
});

test("releaseBar gives the tip its inverse mass back and restarts the turn count at the current bucket angle", () => {
    const state = motor_api.initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    state.turned = 7;
    state.nodes[12].x = 0.5;
    state.nodes[12].y = PIVOT_HEIGHT - 1.4;
    internals.releaseBar(state);
    assert.equal(state.released, true);
    assertClose(state.nodes[1].inverse_mass, 3 / 0.3, 1e-12, "inverse mass");
    assert.equal(state.turned, 0);
    assertClose(state.previous_angle, Math.atan2(0.5, 1.4), 1e-12, "turn count starts at the bucket angle");
});

test("stepState: the driven tip is placed exactly on the bar circle whatever the load, with the velocity Δx/Δt", () => {
    const state = motor_api.initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    const dt = 1 / 2400;
    for (const angle of [0.1, 0.4, -0.6]) {
        const before_x = state.nodes[1].x;
        const before_y = state.nodes[1].y;
        internals.stepState(state, EARTH, dt, angle);
        assertClose(state.nodes[1].x, BAR_LENGTH * Math.sin(angle), 1e-15, `tip x at ${angle}`);
        assertClose(state.nodes[1].y, PIVOT_HEIGHT - BAR_LENGTH * Math.cos(angle), 1e-15, `tip y at ${angle}`);
        assertClose(state.nodes[1].velocity_x, (state.nodes[1].x - before_x) / dt, 1e-9, "tip velocity x");
        assertClose(state.nodes[1].velocity_y, (state.nodes[1].y - before_y) / dt, 1e-9, "tip velocity y");
        assert.equal(state.nodes[1].inverse_mass, 0);
    }
});

test("no force on the bucket but the rope: with the tip held, the hanging system stays at rest and the rope carries exactly its weight", () => {
    const state = motor_api.initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    const start = state.nodes.map((node) => [node.x, node.y]);
    let raw = 0;
    for (let i = 0; i < 2400; i++) {
        raw = internals.stepState(state, EARTH, 1 / 2400, 0);
    }
    state.nodes.forEach((node, i) => {
        assertClose(node.x, start[i][0], 1e-6, `node ${i} x`);
        assertClose(node.y, start[i][1], 1e-6, `node ${i} y`);
    });
    const carried = (2 + 0.01 + ROPE_DENSITY * 0.4) * EARTH;
    assertClose(raw, carried, 0.02 * carried, "tension of the top link = weight of what hangs below");
    assert.ok(state.drops.every((drop) => drop.spilled === false));
});

test("no force on the bucket but the rope: with the rope cut, the bucket is in free fall with g", () => {
    const state = motor_api.initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    state.snapped = true;
    const start_y = state.nodes[CENTER].y;
    const steps = 480;
    for (let i = 0; i < steps; i++) {
        internals.stepState(state, EARTH, 1 / 2400, 0);
    }
    const time = steps / 2400;
    assertClose(start_y - state.nodes[CENTER].y, EARTH * time * time / 2, 0.02 * EARTH * time * time / 2, "free fall distance g t²/2");
});

test("drops do not act back on the bucket: the chain and the tension are identical for 10 and 40 drops", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const reference = simulateRun(parameters);
    const finer = simulateRun({ ...parameters, drop_count: 40 });
    assert.equal(finer.outcome, reference.outcome);
    assert.equal(finer.frames.length, reference.frames.length);
    assert.equal(finer.max_tension, reference.max_tension);
    reference.frames.forEach((frame, i) => {
        assert.deepEqual(finer.frames[i].nodes, frame.nodes, `frame ${i}`);
        assert.equal(finer.frames[i].tension, frame.tension);
    });
});

test("motorLead (align): the motor gives no lead while the bar accompanies the bucket", () => {
    const state = motor_api.initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    const motor = { phase: "align", bucket_angle: 1, previous_speed: 0 };
    assert.equal(internals.motorLead(motor, state, { gravity: EARTH, launch_speed: 9 }, 1.49, 3), 0);
});

test("motorLead (swing): the lead δ satisfies L_b sin(δ + ψ) = r sin(ψ) with tan(ψ) = 0.6 × 0.5 × min(tan limit, 0.35) in the kick", () => {
    for (const rope_length of [0.15, 0.4, 0.6]) {
        const radius = bucketRadius(rope_length);
        const parameters = { gravity: EARTH, launch_speed: 9, rope_length, mass: 2, tension_max: 1e4 };
        const state = motor_api.initialState(parameters);
        const kick = 1.3 * Math.sqrt(radius / EARTH);
        const motor = { phase: "swing", bucket_angle: 0, previous_speed: 0 };
        const lead = internals.motorLead(motor, state, parameters, radius, kick / 2);
        const sine_limit = 0.85 * Math.min(BAR_LENGTH / radius, 1);
        const tangent = 0.6 * Math.min(sine_limit / Math.sqrt(1 - sine_limit ** 2), 0.35) * 0.5;
        const psi = Math.atan(tangent);
        assert.ok(lead > 0, `L = ${rope_length}: the bar leads the bucket`);
        assertClose(BAR_LENGTH * Math.sin(lead + psi), radius * Math.sin(psi), 1e-12, `L = ${rope_length}: triangle pivot–tip–bucket`);
        const later = internals.motorLead({ ...motor }, state, parameters, radius, kick);
        assertClose(later, 0, 1e-12, "after the kick, with the bucket at rest the push vanishes (tanh(0) = 0)");
    }
});

test("moveBar: critically damped follower, no overshoot, reaches the target, no jump on the first step", () => {
    const motor = { angle: 0, rate: 0 };
    const target = 0.5;
    const dt = 1 / 2400;
    const first = internals.moveBar(motor, target, 0, dt);
    assert.ok(first > 0 && first < 1e-3, `first step ${first}`);
    let highest = first;
    for (let i = 1; i < 2400; i++) {
        highest = Math.max(highest, internals.moveBar(motor, target, 0, dt));
    }
    assert.ok(highest <= target + 1e-4, `overshoot ${highest - target}`);
    assertClose(motor.angle, target, 1e-4, "settled on the target");
    assertClose(internals.moveBar({ angle: 0.3, rate: 2 }, 0.3, 2, dt), 0.3 + 2 * dt, 1e-12, "a moving target is tracked without lag by the feed-forward");
});

test("smootherstep: 0 → 1 with zero end slopes, value 1/2 and slope 15/8 in the middle, clamped outside", () => {
    assert.equal(JSON.stringify(internals.smootherstep(0)), JSON.stringify({ value: 0, slope: 0 }));
    assert.equal(JSON.stringify(internals.smootherstep(1)), JSON.stringify({ value: 1, slope: 0 }));
    const middle = internals.smootherstep(0.5);
    assertClose(middle.value, 0.5, 1e-15, "value");
    assertClose(middle.slope, 1.875, 1e-15, "slope");
    assert.equal(JSON.stringify(internals.smootherstep(-2)), JSON.stringify({ value: 0, slope: 0 }));
    assert.equal(JSON.stringify(internals.smootherstep(3)), JSON.stringify({ value: 1, slope: 0 }));
});

test("dampJoint: the bending of the joint decays at the given rate, the common rotation is untouched", () => {
    const joint = (a_velocity_y, c_velocity_y) => [
        { x: -1, y: 0, velocity_x: 0, velocity_y: a_velocity_y, inverse_mass: 1 },
        { x: 0, y: 0, velocity_x: 0, velocity_y: 0, inverse_mass: 0 },
        { x: 1, y: 0, velocity_x: 0, velocity_y: c_velocity_y, inverse_mass: 1 },
    ];
    const spin = (from, to) => (to.velocity_y - from.velocity_y) / (to.x - from.x);
    const rate = 8;
    const dt = 1 / 2400;
    const [rigid_a, rigid_b, rigid_c] = joint(-3, 3);
    internals.dampJoint(rigid_a, rigid_b, rigid_c, rate, dt);
    assert.equal(rigid_a.velocity_y, -3);
    assert.equal(rigid_c.velocity_y, 3);
    const [bent_a, bent_b, bent_c] = joint(0, 3);
    internals.dampJoint(bent_a, bent_b, bent_c, rate, dt);
    assertClose(spin(bent_b, bent_c) - spin(bent_a, bent_b), 3 * Math.exp(-rate * dt), 1e-12, "relative spin 3 e^(−rate Δt)");
    assertClose(bent_c.velocity_y - 3, bent_a.velocity_y, 1e-12, "equal masses share the correction equally and oppositely");
    const fixed = [{ x: -1, y: 0, velocity_x: 0, velocity_y: 0, inverse_mass: 0 }, { x: 0, y: 0, velocity_x: 0, velocity_y: 0, inverse_mass: 1 }, { x: 1, y: 0, velocity_x: 0, velocity_y: 3, inverse_mass: 0 }];
    internals.dampJoint(fixed[0], fixed[1], fixed[2], rate, dt);
    assert.equal(fixed[2].velocity_y, 3, "two infinitely heavy ends: nothing to correct");
});

/* jointNode: node with a mass (0 = infinite) and a velocity */
function jointNode(x, y, mass, velocity_x, velocity_y) {
    return { x, y, velocity_x, velocity_y, inverse_mass: mass === 0 ? 0 : 1 / mass };
}

/* jointInvariants: linear momentum, angular momentum about the origin, kinetic energy and relative spin of a, b, c */
function jointInvariants([a, b, c]) {
    const sums = { px: 0, py: 0, angular: 0, energy: 0 };
    for (const node of [a, b, c]) {
        const mass = 1 / node.inverse_mass;
        sums.px += mass * node.velocity_x;
        sums.py += mass * node.velocity_y;
        sums.angular += mass * (node.x * node.velocity_y - node.y * node.velocity_x);
        sums.energy += 0.5 * mass * (node.velocity_x ** 2 + node.velocity_y ** 2);
    }
    return sums;
}

/* relativeSpin: spin(b, c) − spin(b, a), spin(b, n) = (arm × Δv)/|arm|² */
function relativeSpin(a, b, c) {
    const spin = (node) => {
        const arm_x = node.x - b.x;
        const arm_y = node.y - b.y;
        return (arm_x * (node.velocity_y - b.velocity_y) - arm_y * (node.velocity_x - b.velocity_x)) / (arm_x ** 2 + arm_y ** 2);
    };
    return spin(c) - spin(a);
}

const JOINT_RATE = 8;
const JOINT_DT = 1 / 2400;

const JOINT_CASES = [
    ["bucket moving at 1 m/s", () => [jointNode(0, 0.04, 0.006, 0, 0), jointNode(0, 0, 0.016, 0, 0), jointNode(0, -0.19, 2, 1, 0)]],
    ["rope node moving at 2 m/s", () => [jointNode(0, 0.04, 0.006, 2, 0), jointNode(0, 0, 0.016, 0, 0), jointNode(0, -0.19, 2, 0, 0)]],
    ["oblique velocities on a bent joint", () => [jointNode(0.03, 0.03, 0.006, 1.5, -0.7), jointNode(0, 0, 0.016, -0.4, 0.9), jointNode(0.1, -0.16, 2, 0.8, 0.3)]],
];

for (const [label, build] of JOINT_CASES) {
    test(`dampJoint (${label}): conserves linear and angular momentum, never adds energy, relative spin × e^(−rate Δt)`, () => {
        const nodes = build();
        const before = jointInvariants(nodes);
        const spin_before = relativeSpin(...nodes);
        assert.notEqual(spin_before, 0);
        internals.dampJoint(...nodes, JOINT_RATE, JOINT_DT);
        const after = jointInvariants(nodes);
        assertClose(after.px, before.px, 1e-12, "px");
        assertClose(after.py, before.py, 1e-12, "py");
        assertClose(after.angular, before.angular, 1e-12, "angular momentum about the origin");
        assert.ok(after.energy <= before.energy, `energy ${after.energy} > ${before.energy}`);
        assert.ok(after.energy < before.energy, "a bent joint dissipates");
        assertClose(relativeSpin(...nodes) / spin_before, Math.exp(-JOINT_RATE * JOINT_DT), 1e-12, "decay factor");
    });
}

test("dampJoint with a fixed pivot as a and a light bar tip as b: the tip-joint friction acts (relative spin decays, rope node velocity changes)", () => {
    const pivot = jointNode(0, 0.5, 0, 0, 0);
    const tip = jointNode(0.3, 0.1, 0.1, 0.5, 0.2);
    const rope = jointNode(0.3, -0.05, 0.006, -0.6, 0.4);
    const spin_before = relativeSpin(pivot, tip, rope);
    const rope_before = [rope.velocity_x, rope.velocity_y];
    internals.dampJoint(pivot, tip, rope, JOINT_RATE, JOINT_DT);
    assertClose(relativeSpin(pivot, tip, rope) / spin_before, Math.exp(-JOINT_RATE * JOINT_DT), 1e-12, "decay factor");
    assert.ok(Math.hypot(rope.velocity_x - rope_before[0], rope.velocity_y - rope_before[1]) > 1e-6, "rope node velocity changed");
    assert.deepEqual([pivot.velocity_x, pivot.velocity_y], [0, 0]);
});

test("dampJoint leaves a rigid common rotation untouched, also with unequal masses", () => {
    const omega = 3;
    const centre = [0.2, -0.1];
    const rotating = (x, y, mass) => jointNode(x, y, mass, -omega * (y - centre[1]), omega * (x - centre[0]));
    const nodes = [rotating(0, 0.04, 0.006), rotating(0, 0, 0.016), rotating(0, -0.19, 2)];
    const velocities = nodes.map((node) => [node.velocity_x, node.velocity_y]);
    internals.dampJoint(...nodes, JOINT_RATE, JOINT_DT);
    nodes.forEach((node, i) => {
        assertClose(node.velocity_x, velocities[i][0], 1e-12, "vx");
        assertClose(node.velocity_y, velocities[i][1], 1e-12, "vy");
    });
});

test("windupRate: at least 1200, multiple of 120, independent of v₀ and T_max, at least 1.3 c/ℓ at T = 1.3 m g (3 − 2 cos(70°))", () => {
    const cases = [
        { gravity: EARTH, rope_length: 0.6, mass: 0.5 },
        { gravity: MOON, rope_length: 0.3, mass: 1 },
        { gravity: EARTH, rope_length: 0.15, mass: 8 },
        { gravity: 24.8, rope_length: 0.15, mass: 20 },
    ];
    for (const base of cases) {
        const rate = internals.windupRate({ ...base, launch_speed: 3, tension_max: 50 });
        const tension = 1.3 * base.mass * base.gravity * (3 - 2 * Math.cos(70 * Math.PI / 180));
        const wave = Math.sqrt(tension / ROPE_DENSITY) / (base.rope_length / ROPE_LINKS);
        assert.ok(rate >= 1200);
        assert.equal(rate % 120, 0);
        assert.ok(rate >= 1.3 * wave, `rate ${rate} < ${1.3 * wave}`);
        assert.equal(internals.windupRate({ ...base, launch_speed: 40, tension_max: 1e9 }), rate);
    }
    assert.ok(internals.windupRate(cases[2]) > 1200, "heavy bucket on a short rope needs more than the floor");
});

test("simulateRun: a heavy bucket on a short rope with an unbreakable rope pumps without spilling and succeeds", () => {
    const radius = bucketRadius(0.15);
    const run = simulateRun({ gravity: EARTH, rope_length: 0.15, mass: 5, tension_max: 1e9, launch_speed: 1.3 * Math.sqrt(5 * EARTH * radius) }, false);
    assert.notEqual(run.release_time, null);
    assert.equal(run.outcome, "success");
});

test("chainWobble: 0 for the hanging chain, the larger bend at the bar tip or at the handle otherwise", () => {
    const state = motor_api.initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    assertClose(internals.chainWobble(state), 0, 1e-12, "straight chain");
    state.nodes[CENTER].x += 0.1;
    assertClose(internals.chainWobble(state), Math.atan2(0.1, BUCKET.center_of_mass), 1e-12, "bucket bent against the rope");
    state.nodes[CENTER].x -= 0.1;
    const angle = 0.2;
    state.nodes[1].x = BAR_LENGTH * Math.sin(angle);
    state.nodes[1].y = PIVOT_HEIGHT - BAR_LENGTH * Math.cos(angle);
    const rope = Math.atan2(-state.nodes[1].x, state.nodes[1].y - state.nodes[HANDLE].y);
    assertClose(internals.chainWobble(state), Math.abs(rope - angle), 1e-12, "rope bent against the bar");
});

test("substepRate: at least 2400 Hz, a multiple of 120, and about 1.3 c/ℓ for a heavy bucket on a short rope", () => {
    const light = internals.substepRate({ gravity: MOON, rope_length: 0.6, mass: 0.5, launch_speed: 3 });
    assert.equal(light, SUBSTEP_RATE);
    const heavy = { gravity: EARTH, rope_length: 0.15, mass: 8, launch_speed: 20 };
    const tension = 1.3 * 8 * (400 / bucketRadius(0.15) + EARTH);
    const wave = Math.sqrt(tension / ROPE_DENSITY) / (0.15 / ROPE_LINKS);
    const rate = internals.substepRate(heavy);
    assert.equal(rate % 120, 0);
    assert.ok(rate >= 1.3 * wave && rate < 1.3 * wave + 120, `rate ${rate} vs ${1.3 * wave}`);
    assert.ok(rate > SUBSTEP_RATE);
});

/* sameJson: structural equality across realms (frames from the vm copy of game.js carry foreign prototypes) */
function sameJson(actual, expected, message) {
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

/* scratchRun: the attempt run from t = 0 without the pumping cache, as runAttempt does after a cache miss */
function scratchRun(parameters) {
    const attempt = internals.newAttempt(parameters, true);
    internals.advanceAttempt(attempt, parameters, false);
    return attempt;
}

/* pumpKey: key of the pumping cache for recorded runs of default drop count */
function pumpKey(parameters, record = true) {
    return [parameters.gravity, parameters.rope_length, parameters.mass, DROP_COUNT, record].join("|");
}

test("pumping cache: a cold run, a warm run and a run from scratch are identical", () => {
    internals.PUMP_CACHE.clear();
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const cold = motor_api.simulateRun(parameters);
    assert.equal(internals.PUMP_CACHE.size, 1, "one pumping stored");
    assert.ok(internals.PUMP_CACHE.has(pumpKey(parameters)));
    const warm = motor_api.simulateRun({ ...parameters });
    sameJson(warm, cold, "warm cache");
    const scratch = scratchRun(parameters);
    sameJson(scratch.frames, cold.frames.slice(0, -1), "frames of the run from scratch (runAttempt appends one closing frame)");
    assert.equal(scratch.outcome, cold.outcome);
    assert.equal(scratch.event_time, cold.event_time);
    assert.equal(scratch.release_time, cold.release_time);
    assert.equal(scratch.launch_speed, cold.launch_speed);
    assert.equal(scratch.max_tension, cold.max_tension);
    assert.equal(scratch.min_tension, cold.min_tension);
});

test("pumping cache: the same pumping serves another v₀ and still matches a run from scratch", () => {
    const first = runParameters(EARTH, 0.4, 2, 1.08);
    const second = runParameters(EARTH, 0.4, 2, 1.3);
    motor_api.simulateRun(first);
    const size = internals.PUMP_CACHE.size;
    const cached = motor_api.simulateRun(second);
    assert.equal(internals.PUMP_CACHE.size, size, "no new pumping for another v₀");
    const scratch = scratchRun(second);
    sameJson(scratch.frames, cached.frames.slice(0, -1), "frames");
    assert.equal(scratch.outcome, cached.outcome);
    assert.equal(scratch.max_tension, cached.max_tension);
});

test("pumping cache: the cached pumping is cloned, a run never changes it; recording and non-recording runs use separate entries", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    const first = internals.pumpedAttempt(parameters, true);
    const reference_time = first.time;
    first.time += 5;
    first.state.nodes[12].x = 99;
    const second = internals.pumpedAttempt(parameters, true);
    assert.equal(second.time, reference_time);
    assert.notEqual(second.state.nodes[12].x, 99);
    motor_api.simulateRun(parameters, false);
    assert.ok(internals.PUMP_CACHE.has(pumpKey(parameters, true)));
    assert.ok(internals.PUMP_CACHE.has(pumpKey(parameters, false)));
});

test("pumping cache: T_max below the pumping peak bypasses the cache and still equals a run from scratch (snap during the pumping)", () => {
    const parameters = runParameters(EARTH, 0.4, 2, 1.08);
    motor_api.simulateRun(parameters);
    const peak = internals.PUMP_CACHE.get(pumpKey(parameters)).peak_tension;
    assert.ok(peak > (2 + 0.01 + ROPE_DENSITY * 0.4) * EARTH, "the swinging loads the rope beyond its static weight");
    const weak = { ...parameters, tension_max: 0.7 * peak };
    assert.equal(internals.pumpedAttempt(weak, true), null, "cache refused");
    assert.notEqual(internals.pumpedAttempt({ ...parameters, tension_max: 1.01 * peak }, true), null, "cache used just above the peak");
    const run = motor_api.simulateRun(weak);
    assert.equal(run.outcome, "snap");
    assert.ok(!distinctPhases(run).includes("throw"), "the rope snapped before the throw");
    const scratch = scratchRun(weak);
    sameJson(scratch.frames, run.frames.slice(0, -1), "frames");
    assert.equal(scratch.outcome, "snap");
    assert.equal(scratch.event_time, run.event_time);
});

test("pumping cache: the pumping depends on g, L, m and the drop count, not on v₀ or T_max", () => {
    internals.PUMP_CACHE.clear();
    const base = runParameters(MOON, 0.3, 1, 1.08);
    internals.pumpedAttempt(base, false);
    internals.pumpedAttempt({ ...base, launch_speed: 7, tension_max: 50 }, false);
    assert.equal(internals.PUMP_CACHE.size, 1, "v₀ and T_max are not part of the key");
    internals.pumpedAttempt({ ...base, mass: 1.5 }, false);
    internals.pumpedAttempt({ ...base, drop_count: 20 }, false);
    assert.equal(internals.PUMP_CACHE.size, 3);
    assert.ok(internals.PUMP_CACHE.has(pumpKey({ ...base, mass: 1.5 }, false)));
    assert.ok(internals.PUMP_CACHE.has([base.gravity, base.rope_length, base.mass, 20, false].join("|")));
});

test("initialState honours drop_count: count, radius DROP_RADIUS √(10/n), same water volume, drops settled inside the bucket without overlap", () => {
    assert.equal(initialState({ ...EARTH_CASE }).drops.length, DROP_COUNT, "default count");
    assertClose(initialState({ ...EARTH_CASE }).drop_radius, DROP_RADIUS, 1e-15, "default radius");
    assert.equal(initialState({ ...EARTH_CASE, drop_count: undefined }).drops.length, DROP_COUNT);
    for (const count of [1, 4, 10, 25, 40, 100]) {
        const state = initialState({ ...EARTH_CASE, drop_count: count });
        assert.equal(state.drops.length, count, `count ${count}`);
        assertClose(state.drop_radius, DROP_RADIUS * Math.sqrt(DROP_COUNT / count), 1e-15, `radius for ${count} drops`);
        assertClose(count * state.drop_radius ** 2, DROP_COUNT * DROP_RADIUS ** 2, 1e-15, `water volume for ${count} drops`);
        const handle = state.nodes[HANDLE];
        for (const drop of state.drops) {
            const along = handle.y - drop.y;
            assert.ok(along >= BUCKET.rim, `count ${count}: drop above the rim plane`);
            assert.ok(along <= BUCKET.bottom - state.drop_radius + 1e-12, `count ${count}: drop below the bottom`);
            assert.ok(Math.abs(drop.x - handle.x) <= BUCKET.half_width - state.drop_radius + 1e-12, `count ${count}: drop through the side wall`);
            assert.equal(drop.spilled, false);
        }
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                assert.ok(Math.hypot(state.drops[i].x - state.drops[j].x, state.drops[i].y - state.drops[j].y) >= 2 * state.drop_radius - 1e-9, `count ${count}: drops ${i} and ${j} overlap`);
            }
        }
    }
});

test("initialState: drop_count is rounded and clamped to at least one drop", () => {
    assert.equal(initialState({ ...EARTH_CASE, drop_count: 0 }).drops.length, 1);
    assert.equal(initialState({ ...EARTH_CASE, drop_count: 3.6 }).drops.length, 4);
    assert.equal(initialState({ ...EARTH_CASE, drop_count: -5 }).drops.length, 1);
});

test("simulateRun with drop_count: frames carry the drop count and radius, and the run still succeeds with 40 small drops", () => {
    const run = simulateRun({ ...runParameters(EARTH, 0.4, 2, 1.08), drop_count: 40 });
    assert.equal(run.outcome, "success");
    for (const frame of run.frames) {
        assert.equal(frame.drops.length, 40);
        assertClose(frame.drop_radius, DROP_RADIUS / 2, 1e-15, "radius of 40 drops");
    }
    const default_run = simulateRun(runParameters(EARTH, 0.4, 2, 1.08));
    assertClose(default_run.frames[0].drop_radius, DROP_RADIUS, 1e-15, "default radius in the frames");
});


test("solveTridiagonal: a straight chain between two fixed nodes gives no NaN (singular row decoupled)", () => {
    for (const rope_flag of [false, true]) {
        for (const stretch of [0, 0.05]) {
            const nodes = verticalChain([0, 1, 2], [0, 1, 0]);
            const lengths = [1 - stretch / 2, 1 - stretch / 2];
            const lambdas = solveChain(nodes, lengths, [rope_flag, rope_flag], -1, makeWorkspace(2));
            const context = `rope = ${rope_flag}, stretch = ${stretch}`;
            assert.ok(nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), `finite nodes: ${context}`);
            assert.ok(Array.from(lambdas).every(Number.isFinite), `finite multipliers: ${context}`);
            assertClose(nodes[0].y, 0, 1e-15, "fixed end 0");
            assertClose(nodes[2].y, -2, 1e-15, "fixed end 2");
        }
    }
    const work = makeWorkspace(2);
    work.active.fill(1);
    work.unit_y.fill(-1);
    work.violation.fill(0.05);
    internals.solveTridiagonal(verticalChain([0, 1, 2], [0, 1, 0]), work);
    assert.ok(Array.from(work.delta).every(Number.isFinite), "direct call: finite Δλ");
});

test("fillThreshold is 0 unless the mass is free, then the lower end of the window", () => {
    assert.equal(fillThreshold(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 180)), 0);
    assert.equal(fillThreshold(makeChallenge("rope_length", EARTH, 9, null, 2, 180)), 0);
    const mass_challenge = makeChallenge("mass", EARTH, 9.3, 0.4, null, 300);
    assert.equal(fillThreshold(mass_challenge), winningWindow(mass_challenge).minimum);
});

test("evaluate: underfilled below the threshold, success inside, snap above the rope limit", () => {
    const challenge = makeChallenge("mass", EARTH, 9.3, 0.4, null, 300);
    const window = winningWindow(challenge);
    assert.equal(evaluate(challenge, 0.8 * window.minimum), "underfilled");
    assert.equal(evaluate(challenge, window.minimum), "success");
    assert.equal(evaluate(challenge, window.maximum), "success");
    assert.equal(evaluate(challenge, 1.4 * 300 / (9.3 * 9.3 / 1.49 + EARTH)), "snap");
});

test("evaluate passes the simulation outcome through for the v₀ and L variables", () => {
    const speed_challenge = makeChallenge("launch_speed", EARTH, null, 0.4, 2, 250);
    const window = winningWindow(speed_challenge);
    assert.equal(evaluate({ ...speed_challenge, tension_max: 2000 }, 0.92 * Math.sqrt(5 * EARTH * 1.49)), "spill");
    assert.equal(evaluate(speed_challenge, (window.minimum + window.maximum) / 2), "success");
    assert.equal(evaluate(speed_challenge, 0), "swing");
    assert.equal(evaluate(speed_challenge, 1.4 * window.maximum), "snap");
    const length_challenge = makeChallenge("rope_length", EARTH, 9, null, 2, 180);
    const length_window = winningWindow(length_challenge);
    assert.equal(evaluate(length_challenge, (length_window.minimum + length_window.maximum) / 2), "success");
});

test("isChallengeFeasible: both fallback challenges are feasible", () => {
    assert.equal(FALLBACK_CHALLENGES.length, 2);
    for (const challenge of FALLBACK_CHALLENGES) {
        assert.equal(isChallengeFeasible(challenge), true, `${challenge.place}`);
    }
});

test("isChallengeFeasible refuses impossible demands", () => {
    assert.equal(isChallengeFeasible(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 15)), false, "T_max < m g: empty window");
    assert.equal(isChallengeFeasible(makeChallenge("rope_length", EARTH, 9, null, 2, 15)), false, "L: T_max/m < g");
    assert.equal(isChallengeFeasible(makeChallenge("mass", EARTH, 5, 0.4, null, 300)), false, "m: v₀ too low for the water");
    assert.equal(isChallengeFeasible(makeChallenge("launch_speed", EARTH, null, 0.4, 1, 5000)), false, "v₀ window beyond the 20 m/s input range");
    assert.equal(isChallengeFeasible(makeChallenge("rope_length", EARTH, 9, null, 1, 2000)), false, "L window below the 0.15 m input range");
    assert.equal(isChallengeFeasible(makeChallenge("mass", EARTH, 9.3, 0.4, null, 10)), false, "m window below the 0.5 kg input range");
});

test("isChallengeFeasible refuses a window narrower than 5 %", () => {
    const narrow_speed = 1.03 * 1.06 * Math.sqrt(5 * EARTH * 1.49);
    const challenge = makeChallenge("launch_speed", EARTH, null, 0.4, 1, bottomTension(EARTH, 0.4, 1, narrow_speed) / TENSION_SHARE);
    const window = winningWindow(challenge);
    const width = window.maximum - window.minimum;
    assertClose(window.maximum, narrow_speed, 1e-6, "window top");
    assert.ok(width > 0 && width < 0.05 * window.minimum, `window ${width} must be positive but narrow`);
    assert.ok(window.minimum >= VARIABLES.launch_speed.min && window.maximum <= VARIABLES.launch_speed.max);
    assert.equal(isChallengeFeasible(challenge), false);
});

const MONTE_CARLO_SEED = 20260726;
const per_worker = MONTE_CARLO_COUNT / MONTE_CARLO_WORKERS;

/* inWorkers: seeded batches drawn on parallel worker threads (helpers/generate_worker.js), batches concatenated in worker order */
function inWorkers() {
    const url = new URL("./helpers/generate_worker.js", import.meta.url);
    return Promise.all(Array.from({ length: MONTE_CARLO_WORKERS }, (_, k) => new Promise((resolve, reject) => {
        const worker = new Worker(url, { workerData: { seed: MONTE_CARLO_SEED + k, count: per_worker, replay_count: k < REPLAYED_WORKERS ? 1 : 0 } });
        worker.once("message", resolve);
        worker.once("error", reject);
    }))).then((batches) => batches.flat());
}

const generated_promise = inWorkers();
generated_promise.catch(() => {});

test("Monte-Carlo: every randomChallenge has its window inside the input range, replayed windows are successes", async () => {
    const generated = await generated_promise;
    assert.equal(generated.length, MONTE_CARLO_COUNT);
    const counts = { launch_speed: 0, rope_length: 0, mass: 0 };
    let replayed = 0;
    generated.forEach(({ challenge, replay }, index) => {
        const context = `seed ${MONTE_CARLO_SEED}+${Math.floor(index / per_worker)}, index ${index}, ${JSON.stringify(challenge)}`;
        assert.ok(challenge.variable in VARIABLES, context);
        counts[challenge.variable] += 1;
        const spec = VARIABLES[challenge.variable];
        const window = winningWindow(challenge);
        assert.ok(window.minimum >= spec.min && window.maximum <= spec.max, `window [${window.minimum}, ${window.maximum}] outside range: ${context}`);
        assert.ok(window.maximum - window.minimum >= 3 * spec.step, `window too narrow: ${context}`);
        assert.equal(challenge[challenge.variable], null, context);
        assert.ok(challenge.tension_max > 0 && Number.isFinite(challenge.tension_max), context);
        if (replay !== null) {
            replayed += 1;
            assert.deepEqual(replay, ["success", "success", "success"], `replay at both ends and in the middle: ${context}`);
        }
    });
    assert.equal(replayed, REPLAYED_WORKERS);
    for (const key of Object.keys(counts)) {
        assert.ok(counts[key] > 0, `variable ${key} never drawn`);
    }
    const fallbacks = generated.filter(({ challenge }) => FALLBACK_CHALLENGES.some((fallback) => JSON.stringify(fallback) === JSON.stringify(challenge)));
    assert.ok(fallbacks.length < 0.1 * MONTE_CARLO_COUNT, `${fallbacks.length} fallbacks: rejection sampling rarely succeeds`);
});

test("anti-repeat: over the same Monte-Carlo draws, the excluded value never lies inside the new window of the same variable", async () => {
    const generated = await generated_promise;
    let same_variable = 0;
    generated.forEach(({ challenge, excluded }, index) => {
        if (excluded === null || excluded.variable !== challenge.variable) {
            return;
        }
        same_variable += 1;
        const window = winningWindow(challenge);
        const is_fallback = FALLBACK_CHALLENGES.some((fallback) => JSON.stringify(fallback) === JSON.stringify(challenge));
        if (!is_fallback) {
            assert.ok(excluded.value < window.minimum || excluded.value > window.maximum, `index ${index}: excluded ${excluded.value} inside [${window.minimum}, ${window.maximum}]`);
        }
    });
    assert.ok(same_variable >= 15, `only ${same_variable} same-variable steps, the check is too weak`);
});

test("randomChallenge is reproducible with the same seed and falls back on a hostile rng", () => {
    const first = randomChallenge(seededRandom(99));
    const second = randomChallenge(seededRandom(99));
    assert.deepEqual(second, first);
    const constant = randomChallenge(() => 0.999999);
    assert.ok(constant.variable in VARIABLES);
    assert.equal(isChallengeFeasible(constant), true);
});

test("drawVariable frequencies are 4 : 3 : 3", () => {
    const rng = seededRandom(31337);
    const counts = { launch_speed: 0, rope_length: 0, mass: 0 };
    for (let i = 0; i < DRAW_COUNT; i++) {
        counts[drawVariable(rng)] += 1;
    }
    assertClose(counts.launch_speed / DRAW_COUNT, 0.4, 0.025, "launch_speed share");
    assertClose(counts.rope_length / DRAW_COUNT, 0.3, 0.025, "rope_length share");
    assertClose(counts.mass / DRAW_COUNT, 0.3, 0.025, "mass share");
    assert.equal(drawVariable(() => 0), "launch_speed");
    assert.equal(drawVariable(() => 0.399999), "launch_speed");
    assert.equal(drawVariable(() => 0.4), "rope_length");
    assert.equal(drawVariable(() => 0.7), "mass");
    assert.equal(drawVariable(() => 0.999999), "mass");
});

test("nextMilestone gives the next tier above the score, null after the last", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
    const expectations = [[0, 1], [1, 5], [4, 5], [5, 10], [19, 20], [20, 40], [69, 70], [70, 100], [99, 100], [100, null], [250, null]];
    for (const [score, expected] of expectations) {
        assert.equal(nextMilestone(score), expected, `score ${score}`);
    }
});
