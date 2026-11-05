/*
 * game.test.js — Unit tests for the pure logic of the wagon-loop "bucket on a
 * rope" game mode (game.js, rigid-bucket model): hand-computed ideal theory
 * (T/m = v₀²/R + g (3 cos(θ) − 2), v₀ ≥ √(5 g R), T ≤ T_max) against
 * tensionPerMass, idealWindow, winningWindow and bisect; the water layout
 * (complete hexagonal rows, mass, geometry) and bucketRadius against the
 * simulated centre of mass at rest; the one-sided chain projection solveChain
 * on hand-made chains, with and without the rigid composite; the momentum
 * conservation of the joint and ears friction; wall contact and landing kicks
 * of the water; the static hanging state (filtered tension (m + μ L) g, no drop
 * motion); the motor model (lead geometry, critically damped bar, shooting
 * secant); the full simulation (exact v₀, success above and failure below
 * √(5 g R), snap, swing, determinism, cached pumping); evaluate / fillThreshold,
 * the feasibility checker (fallback and impossible challenges), a small seeded
 * Monte-Carlo of randomChallenge in worker threads, variable frequencies and
 * milestones.
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
    MIN_ROPE_LINKS,
    MAX_ROPE_LINKS,
    HANDLE,
    ATTACH,
    DROP_RADIUS,
    BUCKET,
    EMPTY_MASS,
    SHELL_CENTER,
    SHELL_INERTIA,
    BAR_LENGTH,
    BAR_MASS,
    PIVOT_HEIGHT,
    ROPE_LINEAR_DENSITY,
    WINDOW_MARGIN,
    TENSION_SHARE,
    MASS_FILL_RATIO,
    waterMass,
    fillHeight,
    waterLayout,
    bucketRadius,
    tensionPerMass,
    idealWindow,
    resolveParameters,
    winningWindow,
    bottomTension,
    initialState,
    restFrame,
    solveChain,
    bucketCenter,
    simulateRun,
    frameAt,
    fillThreshold,
    evaluate,
    isChallengeFeasible,
    drawVariable,
    randomChallenge,
    nextMilestone,
} = globalThis.loop_wagon_game;
const { api: cached_api, internals } = loadGameInternals();

const EARTH = 9.81;
const MOON = 1.62;
const MARS = 3.71;
const LOW = (1 + WINDOW_MARGIN) ** 2;
const TIP = 1;
const DRAW_COUNT = 5000;
const MONTE_CARLO_SEED = 20260811;
const MONTE_CARLO_WORKERS = 4;
const DRAWS_PER_WORKER = 2;
const REPLAYED_WORKERS = 2;

/* assertClose: numeric comparison within an absolute tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual} (tolerance ${tolerance})`);
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

/* distanceBetween: Euclidean distance of two points */
function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/* waterLimit: speed √(5 g R) of the water limit for a setup */
function waterLimit(gravity, rope_length, mass) {
    return Math.sqrt(5 * gravity * bucketRadius(rope_length, mass));
}

/* runParameters: simulateRun parameters */
function runParameters(gravity, rope_length, mass, speed, tension_max) {
    return { gravity, rope_length, mass, tension_max, launch_speed: speed };
}

/* ---------- theory ---------- */

test("constants: bucket geometry, empty mass, shell centre and inertia of a thin cylinder shell plus disc", () => {
    assert.deepEqual(BUCKET, { radius: 0.13, depth: 0.24, bail: 0.15, shell_mass: 0.45, bail_mass: 0.05 });
    assertClose(EMPTY_MASS, 0.5, 1e-15, "empty bucket 0.5 kg");
    const side_share = 0.48 / 0.61;
    assertClose(SHELL_CENTER, side_share * 0.12 + (1 - side_share) * 0.24, 1e-15, "centre from the lateral and bottom shares");
    assertClose(SHELL_CENTER, 0.145573770, 1e-8, "hand value of s_c");
    assertClose(SHELL_INERTIA, 0.006183663, 1e-8, "hand value of I_s");
    assertClose(DROP_RADIUS, 0.13 / 9.1, 1e-15, "drop radius a/9.1 (clearance at the walls)");
    assert.equal(BAR_LENGTH, 0.9);
    assert.equal(BAR_MASS, 0.3);
    assert.equal(ROPE_LINEAR_DENSITY, 0.15);
    assert.equal(HANDLE, ROPE_LINKS + 1);
    assert.equal(ATTACH, ROPE_LINKS + 2);
});

test("VARIABLES: ranges, weights and defaults of the three free variables", () => {
    assert.deepEqual(VARIABLES.launch_speed, { weight: 4, min: 0, max: 20, step: 0.01, default_value: 5 });
    assert.deepEqual(VARIABLES.rope_length, { weight: 3, min: 0.15, max: 0.6, step: 0.01, default_value: 0.4 });
    assert.deepEqual(VARIABLES.mass, { weight: 3, min: 0.6, max: 8, step: 0.01, default_value: 2 });
    assert.ok(VARIABLES.mass.min > EMPTY_MASS, "the lightest filled bucket still holds water");
});

test("waterMass and fillHeight: water of a filled bucket m − 0.5 kg at 1 kg/L in a cylinder of radius a", () => {
    assert.equal(waterMass(0.5), 0);
    assert.equal(waterMass(0.3), 0);
    assertClose(waterMass(2), 1.5, 1e-15, "m = 2 kg");
    assertClose(waterMass(8), 7.5, 1e-15, "m = 8 kg");
    assert.equal(fillHeight(0.5), 0);
    assertClose(fillHeight(2), 1.5 / (1000 * Math.PI * 0.13 ** 2), 1e-15, "f = V/(π a²)");
    assertClose(fillHeight(2), 0.028252, 1e-6, "hand value for 1.5 L");
    assertClose(fillHeight(8) / fillHeight(2), 5, 1e-12, "depth proportional to the water mass");
});

test("waterLayout: complete hexagonal rows alternating 10-wide (9 drops here) and 8, each drop carrying m_eau / n", () => {
    const row_cases = [[0.6, 1, 9], [1, 1, 9], [2, 1, 9], [3, 2, 17], [5, 3, 26], [6, 4, 34], [8, 6, 51]];
    for (const [mass, rows, count] of row_cases) {
        const layout = waterLayout(mass);
        const context = `m = ${mass}`;
        assert.equal(layout.count, count, `count: ${context}`);
        assert.equal(layout.positions.length, count, `positions: ${context}`);
        assertClose(layout.drop_mass * layout.count, mass - 0.5, 1e-12, `water mass conserved: ${context}`);
        assert.equal(layout.radius, DROP_RADIUS, `drop radius a/9: ${context}`);
        const per_depth = new Map();
        for (const [across, depth] of layout.positions) {
            const key = depth.toFixed(9);
            per_depth.set(key, (per_depth.get(key) ?? 0) + 1);
            assert.ok(Math.abs(across) + layout.radius <= BUCKET.radius + 1e-12, `inside the side walls: ${context}`);
            assert.ok(depth >= layout.radius - 1e-12 && depth <= BUCKET.depth - layout.radius + 1e-12, `inside the bottom and below the ears: ${context}`);
        }
        assert.deepEqual(Array.from(per_depth.values()), Array.from({ length: rows }, (_, row) => (row % 2 === 0 ? 9 : 8)), `rows: ${context}`);
        for (let i = 0; i < layout.count; i++) {
            for (let j = i + 1; j < layout.count; j++) {
                const [xi, yi] = layout.positions[i];
                const [xj, yj] = layout.positions[j];
                assert.ok(Math.hypot(xi - xj, yi - yj) >= 2 * layout.radius - 1e-12, `no overlap: ${context}`);
            }
        }
        const mean_depth = layout.positions.reduce((sum, [, depth]) => sum + depth, 0) / count;
        assertClose(layout.along, mean_depth, 1e-15, `mean depth: ${context}`);
        let hand_depth = 0;
        for (let row = 0; row < rows; row++) {
            hand_depth += (row % 2 === 0 ? 9 : 8) * (BUCKET.depth - layout.radius - row * Math.sqrt(3) * layout.radius);
        }
        assertClose(layout.along, hand_depth / count, 1e-12, `drop-weighted mean depth of the rows: ${context}`);
    }
});

test("waterLayout: empty bucket has no drop, an explicit drop count keeps the cross-section and halves at most the width", () => {
    const empty = waterLayout(0.5);
    assert.equal(empty.count, 0);
    assert.equal(empty.along, BUCKET.depth);
    assert.deepEqual(waterLayout(2, null), waterLayout(2));
    assert.deepEqual(waterLayout(2, 0), waterLayout(2));
    const forty = waterLayout(2, 40);
    assert.equal(forty.count, 40);
    assert.equal(forty.positions.length, 40);
    assertClose(forty.drop_mass * 40, 1.5, 1e-12, "water mass");
    assertClose(2 * Math.sqrt(3) * 40 * forty.radius ** 2, 2 * BUCKET.radius * fillHeight(2), 1e-12, "cross-section 2 a f");
    assert.ok(forty.radius <= BUCKET.radius / 2);
    const few = waterLayout(8, 2);
    assert.equal(few.count, 2);
    assert.equal(few.radius, BUCKET.radius / 2, "radius capped at a/2");
});

test("bucketRadius: hand-computed distance from the pivot to the centre of mass of the filled bucket", () => {
    const handle = 0.9 + 0.4;
    const ears = handle + 0.15;
    const hand = (0.05 * handle + 0.45 * (ears + SHELL_CENTER) + 1.5 * (ears + 0.24 - 0.13 / 9.1)) / 2;
    assertClose(bucketRadius(0.4, 2), hand, 1e-12, "L = 0.4, m = 2 (one row of 9 drops on the bottom)");
    assertClose(bucketRadius(0.4, 2), 1.648290, 1e-6, "hand value");
    assertClose(bucketRadius(0.4, 0.5), (0.05 * handle + 0.45 * (ears + SHELL_CENTER)) / 0.5, 1e-12, "empty bucket: no water term");
    for (const mass of [0.6, 2, 8]) {
        assertClose(bucketRadius(0.5, mass) - bucketRadius(0.3, mass), 0.2, 1e-12, `R grows with L one for one, m = ${mass}`);
    }
    assertClose(bucketRadius(0.4, 2, 40), bucketRadius(0.4, 2), 2e-3, "an explicit drop count hardly moves the centre of mass");
});

test("bucketRadius equals the simulated centre-of-mass distance of the bucket at rest within 1e-4 m", () => {
    for (const rope_length of [0.15, 0.4, 0.6]) {
        for (const mass of [0.6, 1, 2, 3.7, 5, 8]) {
            for (const drop_count of [null, 30]) {
                const state = initialState({ gravity: EARTH, rope_length, mass, drop_count });
                const center = bucketCenter(state);
                assertClose(PIVOT_HEIGHT - center.y, bucketRadius(rope_length, mass, drop_count), 1e-4, `L = ${rope_length}, m = ${mass}, drops = ${drop_count}`);
                assertClose(center.x, 0, 1e-12, "centre below the pivot");
                assertClose(center.mass, mass, 1e-9, "bail + shell + water = m");
            }
        }
    }
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
        { gravity: MARS, radius: 1.2, speed: 5 },
    ];
    for (const { gravity, radius, speed } of cases) {
        const start_height = speed * speed / (2 * gravity);
        assert.ok(start_height <= 3 * radius, "h must not be capped by buildTrack");
        const track = buildTrack(radius, start_height);
        assertClose(track.start_height, start_height, 1e-12, "h kept");
        for (const theta of [1e-9, 0.7, Math.PI / 2, 2.5, Math.PI]) {
            const point = pointAt(track, track.loop_start + theta * radius);
            assertClose(tensionPerMass(gravity, radius, speed, theta), normalPerMass(gravity, start_height, point), 1e-9, `g = ${gravity}, θ = ${theta}`);
        }
    }
});

test("idealWindow: √(5 g R) and √((T_max/m − g) R), upper end zero when the rope cannot carry m g", () => {
    const radius = bucketRadius(0.4, 2);
    const window = idealWindow(EARTH, 0.4, 2, 180);
    assertClose(window.minimum, Math.sqrt(5 * EARTH * radius), 1e-12, "minimum");
    assertClose(window.maximum, Math.sqrt((90 - EARTH) * radius), 1e-12, "maximum");
    const moon = idealWindow(MOON, 0.15, 1, 40);
    assertClose(moon.minimum, Math.sqrt(5 * MOON * bucketRadius(0.15, 1)), 1e-12, "moon minimum");
    assertClose(moon.maximum, Math.sqrt((40 - MOON) * bucketRadius(0.15, 1)), 1e-12, "moon maximum");
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

test("bisect: largest true value of a falling-true predicate, smallest false value, null when the wanted side is empty", () => {
    assertClose(internals.bisect((x) => x <= 3, 0, 10, false), 3, 1e-12, "largest value still true");
    assertClose(internals.bisect((x) => x <= 3, 0, 10, true), 3, 1e-12, "smallest value false");
    assertClose(internals.bisect((x) => x * x <= 2, 0, 10, false), Math.SQRT2, 1e-12, "nonlinear");
    assert.equal(internals.bisect((x) => x <= 3, 5, 10, false), null, "true nowhere");
    assert.equal(internals.bisect((x) => x <= 30, 0, 10, true), null, "false nowhere");
    assertClose(internals.bisect((x) => x <= 3, 0, 2, false), 2, 1e-12, "true everywhere: the upper bound");
    assertClose(internals.bisect((x) => x <= -1, -5, 2, true), -1, 1e-12, "false from the boundary on, negative interval");
});

test("bottomTension: m (v²/R + g) + μ L (ω² (L_b + L/2) + g), ω = v/R, R from L and m", () => {
    const radius = bucketRadius(0.4, 2);
    const speed_squared = 81;
    const hand = 2 * (81 / radius + EARTH) + 0.15 * 0.4 * (81 / radius ** 2 * 1.1 + EARTH);
    assertClose(bottomTension(0.4, 2, speed_squared, EARTH), hand, 1e-9, "hand formula");
    assertClose(bottomTension(0.4, 2, 0, EARTH), (2 + 0.06) * EARTH, 1e-12, "at rest: (m + μ L) g");
    assert.ok(bottomTension(0.4, 3, speed_squared, EARTH) > bottomTension(0.4, 2, speed_squared, EARTH), "grows with m");
});

test("winningWindow (v₀): 1.04 √(5 g R) up to the speed whose bottom tension, rope included, is 0.7 T_max", () => {
    assert.equal(WINDOW_MARGIN, 0.04);
    assert.equal(TENSION_SHARE, 0.7);
    const challenge = makeChallenge("launch_speed", EARTH, null, 0.4, 2, 210);
    const window = winningWindow(challenge);
    assertClose(window.minimum, 1.04 * waterLimit(EARTH, 0.4, 2), 1e-12, "minimum = 1.04 √(5 g R)");
    assertClose(window.minimum, 9.351249, 1e-5, "hand value of the minimum");
    assertClose(bottomTension(0.4, 2, window.maximum ** 2, EARTH), 0.7 * 210, 1e-9, "tension at the maximum");
    assertClose(window.maximum, 10.121437, 1e-4, "hand value of the maximum");
    assert.ok(window.maximum < Math.sqrt((0.7 * 105 - EARTH) * bucketRadius(0.4, 2)) + 1e-9, "the rope's own load lowers the massless limit");
    const mars = winningWindow(makeChallenge("launch_speed", MARS, null, 0.5, 3, 150));
    assertClose(mars.minimum, 1.04 * waterLimit(MARS, 0.5, 3), 1e-12, "mars minimum");
    assertClose(bottomTension(0.5, 3, mars.maximum ** 2, MARS), 105, 1e-9, "mars tension at the maximum");
    const too_weak = winningWindow(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 15));
    assert.equal(too_weak.maximum, -Infinity, "0.7 T_max below (m + μ L) g: empty");
});

test("winningWindow (L): from the shortest rope that holds (clipped to 0.15) to the longest that keeps the water (clipped to 0.6)", () => {
    const loaded = winningWindow(makeChallenge("rope_length", EARTH, 10, null, 2, 210));
    assertClose(bottomTension(loaded.minimum, 2, 100, EARTH), 0.7 * 210, 1e-9, "shortest rope: bottom tension = 0.7 T_max");
    assertClose(loaded.minimum, 0.356645, 1e-4, "hand value of the minimum");
    assert.equal(loaded.maximum, 0.6, "water limit beyond the input range: clipped");
    const light = winningWindow(makeChallenge("rope_length", EARTH, 10, null, 2, 300));
    assert.equal(light.minimum, 0.15, "strong rope: clipped to the shortest input");
    const short = winningWindow(makeChallenge("rope_length", EARTH, 9, null, 2, 300));
    assertClose(9 * 9, 5 * EARTH * bucketRadius(short.maximum, 2) * LOW, 1e-9, "longest rope: v₀² = 5 g R (1.04)²");
    assertClose(short.maximum, 0.278500, 1e-4, "hand value of the maximum");
    assert.ok(short.maximum < 0.6);
    const none = winningWindow(makeChallenge("rope_length", EARTH, 10, null, 8, 100));
    assert.deepEqual(none, { minimum: Infinity, maximum: -Infinity }, "no rope holds this bucket: empty");
});

test("winningWindow (m): [0.9 m_max, m_max], m_max the heaviest bucket whose bottom tension is 0.7 T_max", () => {
    assert.equal(MASS_FILL_RATIO, 0.9);
    for (const [gravity, speed, rope_length, tension_max] of [[EARTH, 10, 0.4, 400], [EARTH, 10, 0.4, 250], [MOON, 4, 0.3, 60]]) {
        const window = winningWindow(makeChallenge("mass", gravity, speed, rope_length, null, tension_max));
        const context = `g = ${gravity}, T_max = ${tension_max}`;
        assertClose(bottomTension(rope_length, window.maximum, speed * speed, gravity), 0.7 * tension_max, 1e-9, `m_max: ${context}`);
        assertClose(window.minimum, 0.9 * window.maximum, 1e-12, `minimum = 0.9 m_max: ${context}`);
        assert.ok(speed * speed >= 5 * gravity * bucketRadius(rope_length, window.minimum) * LOW, `water kept at the light end: ${context}`);
        assert.ok(speed * speed >= 5 * gravity * bucketRadius(rope_length, window.maximum) * LOW, `water kept at the heavy end: ${context}`);
    }
    assertClose(winningWindow(makeChallenge("mass", EARTH, 10, 0.4, null, 400)).maximum, 3.912865, 1e-4, "hand value of m_max");
});

test("winningWindow (m) is empty when the water is lost or the empty bucket is already too heavy", () => {
    const slow = winningWindow(makeChallenge("mass", EARTH, 6, 0.4, null, 400));
    assert.deepEqual(slow, { minimum: Infinity, maximum: -Infinity }, "v₀ below the water limit");
    const heavy = winningWindow(makeChallenge("mass", EARTH, 10, 0.4, null, 5));
    assert.deepEqual(heavy, { minimum: Infinity, maximum: -Infinity }, "T_max below the empty bucket's tension");
});

test("heaviestBucket and shortestRope: the loaded bottom tension equals the allowed one", () => {
    const challenge = makeChallenge("mass", EARTH, 10, 0.4, null, 400);
    const mass_max = internals.heaviestBucket(challenge, 280);
    assertClose(bottomTension(0.4, mass_max, 100, EARTH), 280, 1e-9, "m_max");
    assert.equal(internals.heaviestBucket(challenge, 1), null);
    const rope = makeChallenge("rope_length", EARTH, 10, null, 2, 210);
    const shortest = internals.shortestRope(rope, 147);
    assertClose(bottomTension(shortest, 2, 100, EARTH), 147, 1e-9, "shortest L");
    assert.equal(internals.shortestRope(rope, 1), null, "even a 3 m rope is too loaded");
});

/* ---------- chain projection ---------- */

test("solveChain projects a stretched bilateral link back to its length, λ < 0 when pulling", () => {
    const nodes = verticalChain([0, 1.5], [0, 1]);
    const lambdas = solveChain(nodes, [1], [false], -1, makeWorkspace(1));
    assertClose(distanceBetween(nodes[0], nodes[1]), 1, 1e-12, "length restored");
    assertClose(nodes[1].y, -1, 1e-12, "free node pulled up");
    assertClose(nodes[0].y, 0, 1e-15, "fixed node stays");
    assertClose(lambdas[0], -0.5, 1e-12, "λ = −stretch / w");
});

test("solveChain: a stretched rope link is restored like a bilateral one, a compressed one is not pushed apart", () => {
    const stretched = verticalChain([0, 1.5], [0, 1]);
    assertClose(solveChain(stretched, [1], [true], -1, makeWorkspace(1))[0], -0.5, 1e-12, "rope pulls: λ < 0");
    assertClose(distanceBetween(stretched[0], stretched[1]), 1, 1e-12, "length restored");
    const rope = verticalChain([0, 0.5], [0, 1]);
    assert.equal(solveChain(rope, [1], [true], -1, makeWorkspace(1))[0], 0, "no force in a slack rope");
    assertClose(rope[1].y, -0.5, 1e-15, "rope node untouched");
    const bar = verticalChain([0, 0.5], [0, 1]);
    assertClose(solveChain(bar, [1], [false], -1, makeWorkspace(1))[0], 0.5, 1e-12, "bilateral link pushes: λ > 0");
    assertClose(bar[1].y, -1, 1e-12, "bilateral link restored to its length");
});

test("solveChain on a coupled chain: bilateral link then slack rope link, and the all-bilateral chain with coupled multipliers", () => {
    const rope_chain = verticalChain([0, 1.5, 1.8], [0, 1, 1]);
    const rope_lambdas = solveChain(rope_chain, [1, 1], [false, true], -1, makeWorkspace(2));
    assertClose(rope_chain[1].y, -1, 1e-12, "first link restored");
    assertClose(rope_chain[2].y, -1.8, 1e-12, "slack rope link leaves its node alone");
    assertClose(rope_lambdas[0], -0.5, 1e-12, "λ of the bilateral link");
    assert.equal(rope_lambdas[1], 0, "λ of the slack rope link");
    const rigid_chain = verticalChain([0, 1.5, 1.8], [0, 1, 1]);
    const rigid_lambdas = solveChain(rigid_chain, [1, 1], [false, false], -1, makeWorkspace(2));
    assertClose(distanceBetween(rigid_chain[0], rigid_chain[1]), 1, 1e-12, "link 0");
    assertClose(distanceBetween(rigid_chain[1], rigid_chain[2]), 1, 1e-12, "link 1");
    assertClose(rigid_lambdas[0], -0.3, 1e-12, "coupled λ₀");
    assertClose(rigid_lambdas[1], 0.2, 1e-12, "coupled λ₁");
});

test("solveChain ignores a broken link", () => {
    const nodes = verticalChain([0, 1.5, 3.2], [0, 1, 1]);
    const lambdas = solveChain(nodes, [1, 1], [true, true], 0, makeWorkspace(2));
    assert.equal(lambdas[0], 0, "no force through the broken link");
    assertClose(nodes[0].y, 0, 1e-15, "pivot untouched");
    assertClose(distanceBetween(nodes[1], nodes[2]), 1, 1e-12, "next link still projected");
    assertClose(nodes[1].y, -1.85, 1e-12, "node 1 moved by link 1 only");
    assertClose(nodes[2].y, -2.85, 1e-12, "node 2 moved by 0.35 toward node 1");
    assertClose(lambdas[1], -0.35, 1e-12, "equal masses");
});

test("solveChain with the rigid composite: the last link moves the shell with w = 1/M + (r × n)²/I, translation n Δλ/M and rotation (r × n) Δλ/I", () => {
    const mass = 2;
    const inertia = 0.1;
    const centered = { center_x: 0, center_y: -1.8, mass, inertia, attach_x: 0, attach_y: -1.5, shift_x: 0, shift_y: 0, turn: 0 };
    const straight = [{ x: 0, y: 0, inverse_mass: 0 }, { x: 0, y: -1.5, inverse_mass: 0 }];
    const lambdas = solveChain(straight, [1], [false], -1, makeWorkspace(1), centered);
    assertClose(lambdas[0], -0.5 * mass, 1e-12, "attach on the line through the centre of mass: w = 1/M");
    assertClose(centered.center_y, -1.3, 1e-12, "centre translated by n Δλ/M");
    assertClose(centered.attach_y, -1, 1e-12, "attach point on the circle");
    assertClose(centered.turn, 0, 1e-15, "no rotation");
    const offset = { center_x: 0.1, center_y: -1.55, mass, inertia, attach_x: 0, attach_y: -1.05, shift_x: 0, shift_y: 0, turn: 0 };
    const nodes = [{ x: 0, y: 0, inverse_mass: 0 }, { x: 0, y: -1.05, inverse_mass: 0 }];
    const offset_lambdas = solveChain(nodes, [1], [false], -1, makeWorkspace(1), offset);
    const arm_cross = (-0.1) * (-1) - (0.5) * 0;
    assertClose(arm_cross, 0.1, 1e-15, "hand (r × n)");
    const w = 1 / mass + arm_cross ** 2 / inertia;
    assertClose(offset_lambdas[0] / (-0.05 / w), 1, 0.1, "λ close to the first-order −stretch / w (two linearisations)");
    assertClose(distanceBetween(nodes[0], nodes[1]), 1, 1e-5, "length restored");
    assertClose(nodes[1].x, offset.attach_x, 1e-15, "last node follows the composite's attach point");
    assertClose(nodes[1].y, offset.attach_y, 1e-15, "last node follows the composite's attach point");
    assert.ok(offset.turn < 0 && offset.shift_y > 0, "pulled up and turned the way r × n Δλ says");
    assertClose(offset.turn / (arm_cross * offset_lambdas[0] / inertia), 1, 0.15, "rotation (r × n) Δλ/I");
    assertClose(offset.shift_y / (-offset_lambdas[0] / mass), 1, 0.15, "translation n Δλ/M");
    assertClose(distanceBetween({ x: offset.attach_x, y: offset.attach_y }, { x: offset.center_x, y: offset.center_y }), distanceBetween({ x: 0, y: -1.05 }, { x: 0.1, y: -1.55 }), 1e-12, "rigid: the attach arm keeps its length");
});

test("solveChain at rest on the initial state leaves the hanging chain unchanged, with and without the composite", () => {
    const state = initialState({ launch_speed: 9, rope_length: 0.4, mass: 2, gravity: EARTH });
    const before = state.nodes.map((node) => [node.x, node.y]);
    solveChain(state.nodes, state.link_lengths, state.rope_flags, -1, state.work);
    state.nodes.forEach((node, i) => {
        assertClose(node.x, before[i][0], 1e-12, `node ${i} x`);
        assertClose(node.y, before[i][1], 1e-12, `node ${i} y`);
    });
    const composite = internals.buildComposite(state);
    const lambdas = solveChain(state.nodes, state.link_lengths, state.rope_flags, -1, state.work, composite);
    assertClose(composite.shift_x, 0, 1e-12, "composite not moved");
    assertClose(composite.shift_y, 0, 1e-12, "composite not moved");
    assertClose(composite.turn, 0, 1e-12, "composite not turned");
    assert.ok(Array.from(lambdas).every((lambda) => Math.abs(lambda) < 1e-12), "no multiplier at rest");
});

test("solveTridiagonal: Thomas solution of A Δλ = −C on the active links, an inactive link decoupled, a singular row decoupled", () => {
    const work = makeWorkspace(2);
    work.active.fill(1);
    work.unit_y.fill(-1);
    work.violation.set([0.1, 0.1]);
    internals.solveTridiagonal(verticalChain([0, 1, 2], [1, 1, 1]), work);
    assertClose(work.delta[0], -0.1, 1e-12, "Δλ₀ of A = [[2, −1], [−1, 2]]");
    assertClose(work.delta[1], -0.1, 1e-12, "Δλ₁");
    const decoupled = makeWorkspace(3);
    decoupled.active.set([1, 0, 1]);
    decoupled.unit_y.fill(-1);
    decoupled.violation.set([0.2, 0.3, 0.4]);
    internals.solveTridiagonal(verticalChain([0, 1, 2, 3], [1, 2, 1, 4]), decoupled);
    assertClose(decoupled.delta[0], -0.2 / 3, 1e-12, "link 0 alone: −C/(w₀ + w₁)");
    assert.equal(decoupled.delta[1], 0, "inactive link: Δλ = 0");
    assertClose(decoupled.delta[2], -0.4 / 5, 1e-12, "link 2 alone: −C/(w₂ + w₃)");
    for (const rope_flag of [false, true]) {
        for (const stretch of [0, 0.05]) {
            const nodes = verticalChain([0, 1, 2], [0, 1, 0]);
            const lengths = [1 - stretch / 2, 1 - stretch / 2];
            const result = solveChain(nodes, lengths, [rope_flag, rope_flag], -1, makeWorkspace(2));
            const context = `rope = ${rope_flag}, stretch = ${stretch}`;
            assert.ok(nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), `finite nodes: ${context}`);
            assert.ok(Array.from(result).every(Number.isFinite), `finite multipliers: ${context}`);
            assertClose(nodes[0].y, 0, 1e-15, "fixed end 0");
            assertClose(nodes[2].y, -2, 1e-15, "fixed end 2");
        }
    }
});

/* ---------- initial state and rest frame ---------- */

test("initialState: chain pivot, tip, ten rope nodes, ears; link lengths, masses, rest tension and settled drops", () => {
    const parameters = { gravity: EARTH, rope_length: 0.4, mass: 2 };
    const state = initialState(parameters);
    assert.equal(state.nodes.length, ROPE_LINKS + 3);
    assert.equal(HANDLE, state.nodes.length - 2);
    assert.equal(ATTACH, state.nodes.length - 1);
    assert.equal(state.link_lengths.length, ROPE_LINKS + 2);
    assert.deepEqual(state.rope_flags, [false, ...new Array(ROPE_LINKS).fill(true), false]);
    assertClose(state.link_lengths.reduce((sum, length) => sum + length, 0), 0.9 + 0.4 + 0.15, 1e-12, "bar + rope + bail");
    assertClose(state.link_lengths[0], 0.9, 1e-15, "bar");
    assertClose(state.link_lengths[1], 0.04, 1e-15, "rope link L/10");
    assertClose(state.link_lengths[ATTACH - 1], 0.15, 1e-15, "bail");
    assert.equal(state.nodes[0].inverse_mass, 0, "pivot fixed");
    assert.equal(state.nodes[TIP].inverse_mass, 0, "tip held by the motor");
    assertClose(state.nodes[2].inverse_mass, 1 / (0.15 * 0.04), 1e-9, "rope node mass μ ℓ");
    assertClose(state.nodes[HANDLE].inverse_mass, 1 / (0.15 * 0.04 + 0.05), 1e-9, "handle carries the bail mass");
    assertClose(state.nodes[ATTACH].y, PIVOT_HEIGHT - 1.45, 1e-12, "ears");
    assertClose(state.body.y, PIVOT_HEIGHT - 1.45 - SHELL_CENTER, 1e-12, "shell centre below the ears");
    assertClose(state.mass, 2, 1e-12, "m");
    assertClose(state.tension, (2 + 0.06) * EARTH, 1e-12, "rest tension (m + μ L) g");
    assert.equal(state.drops.length, 9);
    assert.ok(state.drops.every((drop) => drop.supported && !drop.spilled && !drop.resting));
    assertClose(state.drop_mass * state.drops.length, 1.5, 1e-12, "water");
    assert.equal(state.released, false);
    assert.equal(state.snapped, false);
});

test("initialState: rope_links is rounded and clamped to [2, 40], rope mass independent of the link count, drop_count honoured", () => {
    assert.equal(MIN_ROPE_LINKS, 2);
    assert.equal(MAX_ROPE_LINKS, 40);
    const base = { gravity: EARTH, rope_length: 0.4, mass: 2 };
    for (const [asked, expected] of [[1, 2], [2, 2], [3.4, 3], [25, 25], [40, 40], [99, 40]]) {
        const state = initialState({ ...base, rope_links: asked });
        assert.equal(state.nodes.length, expected + 3, `rope_links = ${asked}`);
        assertClose(state.link_lengths[1], 0.4 / expected, 1e-12, `link length, rope_links = ${asked}`);
        const rope_mass = state.nodes.slice(2, expected + 2).reduce((sum, node) => sum + 1 / node.inverse_mass, 0);
        assertClose(rope_mass, 0.06 + 0.05, 1e-12, `rope + bail mass, rope_links = ${asked}`);
    }
    const forty = initialState({ ...base, drop_count: 40 });
    assert.equal(forty.drops.length, 40);
    assertClose(forty.drop_mass * 40, 1.5, 1e-12, "water");
});

test("restFrame: drawable frame of the hanging system", () => {
    const frame = restFrame({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    assert.equal(frame.time, 0);
    assert.equal(frame.motor_phase, "rest");
    assert.equal(frame.released, false);
    assert.equal(frame.snapped, false);
    assert.equal(frame.turns, 0);
    assert.equal(frame.nodes.length, ROPE_LINKS + 3);
    assert.equal(frame.drops.length, 9);
    assert.ok(frame.drops.every((drop) => drop[2] === false));
    assertClose(frame.bucket[2], 0, 1e-15, "bucket angle");
    assertClose(frame.center[0], 0, 1e-12, "centre of mass below the pivot");
    assertClose(PIVOT_HEIGHT - frame.center[1], bucketRadius(0.4, 2), 1e-4, "R");
});

test("frameAt returns the last frame at or before t and clamps both ends", () => {
    const run = { frames: [0, 1, 2, 3].map((index) => ({ index })) };
    assert.equal(frameAt(run, 0).index, 0);
    assert.equal(frameAt(run, 0.5 / 60).index, 0);
    assert.equal(frameAt(run, 1 / 60).index, 1);
    assert.equal(frameAt(run, 2.99 / 60).index, 2);
    assert.equal(frameAt(run, 3 / 60).index, 3);
    assert.equal(frameAt(run, 10).index, 3);
    assert.equal(frameAt(run, -1).index, 0);
});

/* ---------- friction pairs ---------- */

/* jointSpin: spin of the segment from → to relative to the node `from`, (arm × Δv)/|arm|² */
function jointSpin(from, to) {
    const arm_x = to.x - from.x;
    const arm_y = to.y - from.y;
    return (arm_x * (to.velocity_y - from.velocity_y) - arm_y * (to.velocity_x - from.velocity_x)) / (arm_x * arm_x + arm_y * arm_y);
}

/* nodeAt: point mass with velocity */
function nodeAt(x, y, velocity_x, velocity_y, inverse_mass) {
    return { x, y, velocity_x, velocity_y, inverse_mass };
}

/* momenta: [Σ m v_x, Σ m v_y, Σ m (x v_y − y v_x), Σ ½ m v²] of nodes with inverse_mass > 0 */
function momenta(nodes) {
    const total = [0, 0, 0, 0];
    for (const node of nodes) {
        const mass = 1 / node.inverse_mass;
        total[0] += mass * node.velocity_x;
        total[1] += mass * node.velocity_y;
        total[2] += mass * (node.x * node.velocity_y - node.y * node.velocity_x);
        total[3] += 0.5 * mass * (node.velocity_x ** 2 + node.velocity_y ** 2);
    }
    return total;
}

test("dampJoint: the relative rotation decays at the given rate, momenta conserved, energy only removed", () => {
    const rate = 8;
    const dt = 1 / 600;
    const a = nodeAt(0, 0, 0.3, -0.2, 1 / 0.7);
    const b = nodeAt(1, 0.1, -0.4, 0.5, 1 / 1.3);
    const c = nodeAt(1.2, 1, 1.1, 0.2, 1 / 0.4);
    const relative = (first, second, third) => jointSpin(second, third) - jointSpin(second, first);
    const before = relative(a, b, c);
    const momentum_before = momenta([a, b, c]);
    assert.ok(Math.abs(before) > 0.1, "the joint is bending at the start");
    internals.dampJoint(a, b, c, rate, dt);
    assertClose(relative(a, b, c), before * Math.exp(-rate * dt), 1e-12, "relative spin × e^(−rate Δt)");
    const momentum_after = momenta([a, b, c]);
    for (let k = 0; k < 3; k++) {
        assertClose(momentum_after[k], momentum_before[k], 1e-12, `momentum ${["P_x", "P_y", "L_z"][k]}`);
    }
    assert.ok(momentum_after[3] < momentum_before[3], "energy decreases");
});

test("dampJoint with a fixed pivot as a: the bending still decays and the pivot does not move; a rigid common rotation is untouched", () => {
    const pivot = nodeAt(0, 0, 0, 0, 0);
    const tip = nodeAt(0, -0.9, 0.5, 0, 1 / 0.1);
    const rope = nodeAt(0.05, -1, -0.3, 0.2, 1 / 0.06);
    const before = jointSpin(tip, rope) - jointSpin(tip, pivot);
    internals.dampJoint(pivot, tip, rope, 8, 1 / 2400);
    assertClose(jointSpin(tip, rope) - jointSpin(tip, pivot), before * Math.exp(-8 / 2400), 1e-12, "decay");
    assert.equal(pivot.velocity_x, 0);
    assert.equal(pivot.velocity_y, 0);
    const omega = 2.5;
    const spin = (x, y, inverse_mass) => nodeAt(x, y, -omega * y, omega * x, inverse_mass);
    const nodes = [spin(1, 0, 1), spin(0.5, 0.5, 3), spin(0, 1, 0.5)];
    const velocities = nodes.map((node) => [node.velocity_x, node.velocity_y]);
    internals.dampJoint(nodes[0], nodes[1], nodes[2], 8, 1 / 600);
    nodes.forEach((node, i) => {
        assertClose(node.velocity_x, velocities[i][0], 1e-12, `v_x ${i}`);
        assertClose(node.velocity_y, velocities[i][1], 1e-12, `v_y ${i}`);
    });
});

test("dampEars: the shell-to-bail relative rotation decays at the given rate, linear and angular momentum conserved", () => {
    const state = initialState({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    state.body.angle = 0.3;
    state.body.x = 0.02;
    state.nodes[HANDLE].x = 0.05;
    state.nodes[HANDLE].velocity_x = 0.8;
    state.nodes[HANDLE].velocity_y = -0.3;
    state.body.velocity_x = -0.2;
    state.body.velocity_y = 0.4;
    state.body.angular_velocity = 1.7;
    const handle = state.nodes[HANDLE];
    const body = state.body;
    const frame = internals.bodyFrame(body);
    const handle_mass = 1 / handle.inverse_mass;
    const relative = () => {
        const arm_x = handle.x - frame.x;
        const arm_y = handle.y - frame.y;
        const ears_vx = body.velocity_x - body.angular_velocity * (frame.y - body.y);
        const ears_vy = body.velocity_y + body.angular_velocity * (frame.x - body.x);
        const bail_spin = (arm_x * (handle.velocity_y - ears_vy) - arm_y * (handle.velocity_x - ears_vx)) / (arm_x * arm_x + arm_y * arm_y);
        return body.angular_velocity - bail_spin;
    };
    const totals = () => [
        handle_mass * handle.velocity_x + BUCKET.shell_mass * body.velocity_x,
        handle_mass * handle.velocity_y + BUCKET.shell_mass * body.velocity_y,
        handle_mass * (handle.x * handle.velocity_y - handle.y * handle.velocity_x)
            + BUCKET.shell_mass * (body.x * body.velocity_y - body.y * body.velocity_x) + SHELL_INERTIA * body.angular_velocity,
    ];
    const before = relative();
    const totals_before = totals();
    assert.ok(Math.abs(before) > 0.5);
    internals.dampEars(state, 8, 1 / 2400);
    assertClose(relative(), before * Math.exp(-8 / 2400), 1e-12, "relative rotation × e^(−rate Δt)");
    totals().forEach((total, k) => assertClose(total, totals_before[k], 1e-10, `momentum ${k}`));
});

/* ---------- rigid bucket and water ---------- */

test("bodyFrame: ears point, axis ears → bottom and across direction of the bucket at angle φ", () => {
    const hanging = internals.bodyFrame({ x: 1, y: 2, angle: 0 });
    assertClose(hanging.x, 1, 1e-15, "ears x");
    assertClose(hanging.y, 2 + SHELL_CENTER, 1e-15, "ears above the shell centre");
    assert.deepEqual([hanging.axis_x, hanging.axis_y], [0, -1]);
    assert.deepEqual([hanging.across_x, hanging.across_y], [1, 0]);
    const sideways = internals.bodyFrame({ x: 0, y: 0, angle: Math.PI / 2 });
    assertClose(sideways.axis_x, 1, 1e-15, "axis along +x");
    assertClose(sideways.axis_y, 0, 1e-15, "axis");
    assertClose(sideways.x, -SHELL_CENTER, 1e-15, "ears behind the shell centre");
    assertClose(sideways.across_y, 1, 1e-15, "across");
    const upside_down = internals.bodyFrame({ x: 0, y: 0, angle: Math.PI });
    assertClose(upside_down.axis_y, 1, 1e-15, "bottom up");
    assertClose(upside_down.y, -SHELL_CENTER, 1e-15, "ears below the centre");
});

/* waterFixture: hanging state with the walls' frame and a probe drop */
function waterFixture() {
    const state = initialState({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    const frame = internals.bodyFrame(state.body);
    return { state, frame, radius: state.drop_radius };
}

test("collideWithBucket: a drop through the bottom or a side wall is projected back, with the wall's opposite impulse on the shell", () => {
    const { state, frame, radius } = waterFixture();
    const bottom = { x: 0, y: frame.y - (BUCKET.depth - radius) - 0.005, spilled: false };
    assert.equal(internals.collideWithBucket(bottom, state, frame, true), true);
    assertClose(bottom.y, frame.y - (BUCKET.depth - radius), 1e-12, "back on the floor");
    assertClose(state.work.reaction.y, -state.drop_mass * 0.005, 1e-12, "−m_d Δx on the shell, pushed down");
    assertClose(state.work.reaction.x, 0, 1e-15, "no sideways reaction");
    state.work.reaction.y = 0;
    const side = { x: BUCKET.radius - radius + 0.004, y: frame.y - 0.1, spilled: false };
    assert.equal(internals.collideWithBucket(side, state, frame, false), true);
    assertClose(side.x, BUCKET.radius - radius, 1e-12, "back on the right wall");
    assert.equal(state.work.reaction.x, 0, "react = false: no reaction");
    const left = { x: -(BUCKET.radius - radius) - 0.004, y: frame.y - 0.1, spilled: false };
    internals.collideWithBucket(left, state, frame, true);
    assertClose(left.x, -(BUCKET.radius - radius), 1e-12, "back on the left wall");
    assertClose(state.work.reaction.x, -state.drop_mass * 0.004, 1e-12, "the left wall pushes the drop right, the shell takes the opposite impulse");
});

test("collideWithBucket: inside is untouched (false), within the 5 % gap touches without moving, above the rim plane the drop is spilled", () => {
    const { state, frame, radius } = waterFixture();
    const inside = { x: 0.01, y: frame.y - 0.1, spilled: false };
    assert.equal(internals.collideWithBucket(inside, state, frame, true), false);
    assert.deepEqual([inside.x, inside.y], [0.01, frame.y - 0.1]);
    const resting = { x: 0, y: frame.y - (BUCKET.depth - radius) + 0.02 * radius, spilled: false };
    const y_before = resting.y;
    assert.equal(internals.collideWithBucket(resting, state, frame, true), true, "contact");
    assert.equal(resting.y, y_before, "not moved");
    const lost = { x: 0, y: frame.y + 0.01, spilled: false };
    internals.collideWithBucket(lost, state, frame, true);
    assert.equal(lost.spilled, true, "centre above the rim plane");
    assert.equal(state.work.reaction.moment, 0, "no moment from these contacts");
});

test("separateDrops: two overlapping drops are pushed apart symmetrically to exactly 2ρ, their midpoint kept", () => {
    const { state, frame, radius } = waterFixture();
    const first = { x: -0.005, y: frame.y - 0.1, spilled: false };
    const second = { x: 0.005, y: frame.y - 0.1, spilled: false };
    state.drops = [first, second];
    internals.separateDrops(state);
    assertClose(distanceBetween(first, second), 2 * radius, 1e-12, "touching");
    assertClose((first.x + second.x) / 2, 0, 1e-15, "midpoint x");
    assertClose(first.y, second.y, 1e-15, "pushed along the line of centres");
});

test("settleWater: water at rest in the hanging bucket does not move, stays supported and gives no reaction", () => {
    const { state, frame } = waterFixture();
    const before = state.drops.map((drop) => [drop.x, drop.y]);
    for (let pass = 0; pass < 3; pass++) {
        internals.settleWater(state, frame, true);
    }
    state.drops.forEach((drop, i) => {
        assertClose(drop.x, before[i][0], 1e-12, `drop ${i} x`);
        assertClose(drop.y, before[i][1], 1e-12, `drop ${i} y`);
        assert.equal(drop.supported, true, `drop ${i} supported`);
    });
    assert.equal(state.work.reaction.x, 0);
    assert.equal(state.work.reaction.y, 0);
});

test("settleWater: a drop landing from flight kicks the shell (− m_d Δx) only when react is set; resting water gives none", () => {
    for (const react of [true, false]) {
        const { state, frame } = waterFixture();
        const landing = state.drops[4];
        landing.supported = false;
        const rest_y = landing.y;
        landing.y -= 0.002;
        internals.settleWater(state, frame, react);
        assertClose(landing.y, rest_y, 1e-9, `back on the floor, react = ${react}`);
        assertClose(state.work.reaction.y, react ? -state.drop_mass * 0.002 : 0, 1e-9, `reaction, react = ${react}`);
        assert.equal(landing.supported, true);
    }
});

test("buildComposite: shell and supported drops as one rigid body — mass, centre of mass, inertia about it, attach point at the ears", () => {
    const { state } = waterFixture();
    const composite = internals.buildComposite(state);
    assertClose(composite.mass, 0.45 + 1.5, 1e-12, "M = shell + water");
    const mean_y = state.drops.reduce((sum, drop) => sum + drop.y, 0) / state.drops.length;
    assertClose(composite.center_y, (0.45 * state.body.y + 1.5 * mean_y) / 1.95, 1e-12, "centre of mass");
    let inertia = SHELL_INERTIA + 0.45 * (state.body.y - composite.center_y) ** 2;
    for (const drop of state.drops) {
        inertia += state.drop_mass * ((drop.x - composite.center_x) ** 2 + (drop.y - composite.center_y) ** 2);
    }
    assertClose(composite.inertia, inertia, 1e-12, "I about the centre of mass");
    assertClose(composite.attach_y, state.body.y + SHELL_CENTER, 1e-12, "attach point at the ears");
    state.drops[0].supported = false;
    state.drops[1].supported = false;
    assertClose(internals.buildComposite(state).mass, 0.45 + 7 * state.drop_mass, 1e-12, "drops in flight are left out");
});

test("static hanging state: filtered tension (m + μ L) g exactly, no drop motion, bucket and chain at rest", () => {
    const dt = 1 / 2400;
    for (const mass of [0.6, 8]) {
        const parameters = { gravity: EARTH, rope_length: 0.4, mass };
        const state = initialState(parameters);
        const drops_before = state.drops.map((drop) => [drop.x, drop.y]);
        const body_before = [state.body.x, state.body.y, state.body.angle];
        const expected = (mass + 0.06) * EARTH;
        let raw = 0;
        for (let step = 0; step < 360; step++) {
            raw = internals.stepState(state, EARTH, dt, 0);
            state.tension += (raw - state.tension) * dt / 0.02;
        }
        const context = `m = ${mass}`;
        assertClose(state.tension, expected, 1e-3 * expected, `filtered tension: ${context}`);
        assertClose(raw, expected, 5e-3 * expected, `raw tension: ${context}`);
        state.drops.forEach((drop, i) => {
            assertClose(drop.x, drops_before[i][0], 3e-3, `drop ${i} x: ${context}`);
            assertClose(drop.y, drops_before[i][1], 3e-3, `drop ${i} y: ${context}`);
            assert.equal(drop.spilled, false);
        });
        assertClose(state.body.x, body_before[0], 1e-4, `shell x: ${context}`);
        assertClose(state.body.y, body_before[1], 1e-4, `shell y: ${context}`);
        assertClose(state.body.angle, body_before[2], 1e-4, `shell angle: ${context}`);
        assertClose(PIVOT_HEIGHT - bucketCenter(state).y, bucketRadius(0.4, mass), 5e-4, `centre of mass distance: ${context}`);
    }
});

test("stepState: the driven tip is placed exactly on the bar circle with velocity Δx/Δt", () => {
    const state = initialState({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    const dt = 1 / 1200;
    internals.stepState(state, EARTH, dt, 0.7);
    assertClose(state.nodes[TIP].x, BAR_LENGTH * Math.sin(0.7), 1e-15, "x on the circle");
    assertClose(state.nodes[TIP].y, PIVOT_HEIGHT - BAR_LENGTH * Math.cos(0.7), 1e-15, "y on the circle");
    assertClose(state.nodes[TIP].velocity_x, BAR_LENGTH * Math.sin(0.7) / dt, 1e-9, "v = Δx/Δt");
});

test("stepState with the rope cut: bucket, rope and water fall together with g, the raw tension is 0", () => {
    const state = initialState({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    state.snapped = true;
    const dt = 1 / 2400;
    let raw = 1;
    for (let step = 0; step < 240; step++) {
        raw = internals.stepState(state, EARTH, dt, 0);
    }
    assert.equal(raw, 0);
    assertClose(state.body.velocity_y, -EARTH * 0.1, 0.02 * EARTH * 0.1, "shell in free fall");
    assertClose(state.drops[4].velocity_y, -EARTH * 0.1, 0.05 * EARTH * 0.1, "water falls with it");
    assertClose(state.body.angular_velocity, 0, 1e-6, "no rotation");
    assert.ok(state.drops.every((drop) => !drop.spilled), "the water stays in the falling bucket");
});

/* ---------- motor ---------- */

test("smootherstep: 0 → 1 with zero end slopes, value 1/2 and slope 15/8 in the middle, clamped outside", () => {
    const plain = (u) => ({ ...internals.smootherstep(u) });
    assert.deepEqual(plain(0), { value: 0, slope: 0 });
    assert.deepEqual(plain(1), { value: 1, slope: 0 });
    assertClose(internals.smootherstep(0.5).value, 0.5, 1e-15, "middle");
    assertClose(internals.smootherstep(0.5).slope, 15 / 8, 1e-15, "slope in the middle");
    assertClose(internals.smootherstep(0.25).value, 0.103515625, 1e-12, "hand value at 1/4");
    assert.deepEqual(plain(-3), { value: 0, slope: 0 });
    assert.deepEqual(plain(7), { value: 1, slope: 0 });
});

test("moveBar: critically damped follower — no jump on the first step, no overshoot, reaches the target, no lag on a ramp", () => {
    const motor = { angle: 0, rate: 0 };
    const dt = 1 / 1000;
    assertClose(internals.moveBar(motor, 1, 0, dt), 400 * dt * dt, 1e-15, "first step: no jump");
    let peak = motor.angle;
    for (let step = 0; step < 1000; step++) {
        peak = Math.max(peak, internals.moveBar(motor, 1, 0, dt));
    }
    assert.ok(peak <= 1 + 1e-9, `overshoot ${peak}`);
    assertClose(motor.angle, 1, 1e-6, "target reached after 1 s");
    const ramp = { angle: 0, rate: 0 };
    let error = 0;
    for (let step = 1; step <= 2000; step++) {
        error = 3 * step * dt - internals.moveBar(ramp, 3 * step * dt, 3, dt);
    }
    assertClose(error, -3 * dt, 1e-6, "velocity feed-forward: steady error of one integration step, no lag");
});

test("releaseBar gives the tip its inverse mass 3/m_b back, resets the turn count and takes the bucket angle as origin", () => {
    const state = initialState({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    state.turned = 5;
    assert.equal(state.nodes[TIP].inverse_mass, 0);
    internals.releaseBar(state);
    assert.equal(state.released, true);
    assertClose(state.nodes[TIP].inverse_mass, 3 / 0.3, 1e-12, "effective mass m_b/3");
    assert.equal(state.turned, 0);
    assertClose(state.previous_angle, 0, 1e-12, "hanging bucket: angle 0");
});

test("chainWobble: 0 for the hanging chain, the larger bend at the bar tip or between the rope and the bucket axis otherwise", () => {
    const state = initialState({ gravity: EARTH, rope_length: 0.4, mass: 2 });
    assertClose(internals.chainWobble(state), 0, 1e-12, "hanging");
    const phi = 0.1;
    const tip = state.nodes[TIP];
    const handle = state.nodes[HANDLE];
    handle.x = tip.x + 0.4 * Math.sin(phi);
    handle.y = tip.y - 0.4 * Math.cos(phi);
    assertClose(internals.chainWobble(state), phi, 1e-12, "rope bent by φ at the tip, shell still");
    state.body.angle = 0.35;
    assertClose(internals.chainWobble(state), 0.25, 1e-12, "shell turned 0.25 rad relative to the rope");
    state.body.angle = 2 * Math.PI;
    assertClose(internals.chainWobble(state), phi, 1e-9, "a full turn of the shell does not count");
});

test("motorLead: no lead in the aligned release-at-bottom phase, none when the rope would go slack, geometry L_b sin(δ + ψ) = r sin(ψ) during the kick", () => {
    const parameters = { gravity: EARTH, rope_length: 0.4, mass: 2, launch_speed: 9 };
    const state = initialState(parameters);
    const radius = bucketRadius(0.4, 2);
    const motor = (fields) => ({ phase: "swing", bucket_angle: 0, previous_speed: 1, target_energy: 40, start_angle: 0, start_energy: 0, release_angle: Math.PI / 2, ...fields });
    assert.equal(internals.motorLead(motor({ phase: "align", release_angle: 0 }), state, parameters, radius, 1), 0, "align at θ = 0: no lead");
    assert.equal(internals.motorLead(motor({ bucket_angle: Math.PI }), state, parameters, radius, 0.1), 0, "θ = π at rest: inward part negative");
    const kick_time = 1.3 * Math.sqrt(radius / EARTH);
    const swinging = motor({});
    const lead = internals.motorLead(swinging, state, parameters, radius, kick_time / 2);
    assert.equal(swinging.previous_speed, 0, "angular speed recorded");
    const distance = internals.bucketMotion(state, EARTH, radius).distance;
    const tangent = 0.6 * 0.35 * 0.5;
    const psi = Math.atan(tangent);
    assertClose(lead, Math.asin(distance * Math.sin(psi) / BAR_LENGTH) - psi, 1e-12, "δ = asin(r sin ψ / L_b) − ψ");
    assertClose(BAR_LENGTH * Math.sin(lead + psi), distance * Math.sin(psi), 1e-12, "L_b sin(δ + ψ) = r sin(ψ)");
    assert.ok(lead > 0, "bar ahead of the bucket");
    assert.equal(internals.motorLead(motor({}), state, parameters, radius, kick_time + 1), 0, "after the kick, at rest: tanh(0) = 0");
});

test("motorLead (throw): feed-forward from the energy curve plus feedback, tan ψ clamped to 0.35", () => {
    const parameters = { gravity: EARTH, rope_length: 0.4, mass: 2, launch_speed: 9 };
    const state = initialState(parameters);
    const radius = bucketRadius(0.4, 2);
    const gravity_radius = EARTH * radius;
    const distance = internals.bucketMotion(state, EARTH, radius).distance;
    const throwing = (target_energy) => ({
        phase: "throw", bucket_angle: Math.PI / 4, previous_speed: 1, target_energy, start_angle: 0, start_energy: 0, release_angle: Math.PI / 2,
    });
    const gentle = internals.motorLead(throwing(0.5), state, parameters, radius, 5);
    const capacity = Math.max(gravity_radius * (3 * Math.cos(Math.PI / 4) - 2), 0.1 * gravity_radius);
    const slope = 0.5 * (30 * 0.0625) / (Math.PI / 2);
    const tangent = slope / capacity + (0.25 - 0) / gravity_radius;
    assert.ok(tangent < 0.35, "unclamped case");
    const psi = Math.atan(tangent);
    assertClose(gentle, Math.asin(distance * Math.sin(psi) / BAR_LENGTH) - psi, 1e-9, "hand lead");
    const strong = internals.motorLead(throwing(400), state, parameters, radius, 5);
    const clamped = Math.atan(0.35);
    assertClose(strong, Math.asin(distance * Math.sin(clamped) / BAR_LENGTH) - clamped, 1e-9, "tan ψ = 0.35");
});

test("shootTarget: first step v ∝ √E*, then the secant on ln v against ln E*, slope kept in [0.05, 2]", () => {
    assertClose(internals.shootTarget([{ target: 50, speed: 10 }], 10), 50, 1e-12, "already on target");
    assertClose(internals.shootTarget([{ target: 50, speed: 10 }], 9), 50 * 0.81, 1e-9, "√E* law: E* ∝ v₀²");
    assertClose(internals.shootTarget([{ target: 50, speed: 8 }], 10), 50 * 1.5625, 1e-9, "from below");
    const shots = [{ target: 50, speed: 10 }, { target: 100, speed: 14.142135623730951 }];
    assertClose(internals.shootTarget(shots, 12), 100 * (12 / 14.142135623730951) ** 2, 1e-9, "measured slope 1/2");
    const shallow = [{ target: 50, speed: 10 }, { target: 100, speed: 10 * 2 ** 0.25 }];
    assertClose(internals.shootTarget(shallow, 10 * 2 ** 0.25 * 1.1), 100 * 1.1 ** 4, 1e-9, "slope 1/4");
    const flat = [{ target: 50, speed: 10 }, { target: 100, speed: 10 }];
    assertClose(internals.shootTarget(flat, 11), 100 * Math.exp(Math.log(1.1) / 0.05), 1e-6, "slope floored at 0.05");
    const steep = [{ target: 50, speed: 10 }, { target: 51, speed: 20 }];
    assertClose(internals.shootTarget(steep, 40), 51 * Math.exp(Math.log(2) / 2), 1e-9, "slope capped at 2");
    const degenerate = [{ target: 50, speed: 10 }, { target: 50, speed: 10 }];
    assertClose(internals.shootTarget(degenerate, 8), 50 * 0.64, 1e-9, "0/0 slope: back to 1/2");
});

test("windupRate and substepRate: at least 1200 / 2400 Hz, multiples of 120, fast enough for the rope's waves 1.3 c/ℓ, minimal", () => {
    const cases = [
        { gravity: EARTH, rope_length: 0.4, mass: 2, launch_speed: 9, tension_max: 200 },
        { gravity: EARTH, rope_length: 0.15, mass: 8, launch_speed: 15, tension_max: 900 },
        { gravity: MOON, rope_length: 0.6, mass: 0.6, launch_speed: 3, tension_max: 20 },
    ];
    for (const parameters of cases) {
        const context = JSON.stringify(parameters);
        const windup = internals.windupRate(parameters);
        const substeps = internals.substepRate(parameters);
        assert.ok(windup >= 1200 && windup % 120 === 0, `windup ${windup}: ${context}`);
        assert.ok(substeps >= 2400 && substeps % 120 === 0, `substeps ${substeps}: ${context}`);
        const link = parameters.rope_length / ROPE_LINKS;
        const windup_wave = 1.3 * Math.sqrt(1.3 * parameters.mass * parameters.gravity * (3 - 2 * Math.cos(70 * Math.PI / 180)) / 0.15) / link;
        assert.ok(windup >= windup_wave - 1e-9, `fast enough for the pumping waves: ${context}`);
        assert.ok(windup === 1200 || windup - 120 < windup_wave, `no faster than needed: ${context}`);
        const radius = bucketRadius(parameters.rope_length, parameters.mass);
        const free_wave = 1.3 * Math.sqrt(1.3 * parameters.mass * (parameters.launch_speed ** 2 / radius + parameters.gravity) / 0.15) / link;
        assert.ok(substeps >= free_wave - 1e-9, `fast enough for the free waves: ${context}`);
        assert.ok(substeps === 2400 || substeps - 120 < free_wave, `no faster than needed: ${context}`);
        assert.equal(internals.windupRate({ ...parameters, launch_speed: 1, tension_max: 1 }), windup, `windup independent of v₀ and T_max: ${context}`);
    }
    assert.ok(internals.substepRate(cases[1]) > internals.substepRate(cases[0]), "heavy bucket on a short rope: faster");
});

/* ---------- full simulation ---------- */

const EARTH_SETUP = { gravity: EARTH, rope_length: 0.4, mass: 2, tension_max: 210 };
const EARTH_LIMIT = waterLimit(EARTH, 0.4, 2);
const success_run = simulateRun({ ...EARTH_SETUP, launch_speed: 1.1 * EARTH_LIMIT }, true);

test("simulateRun: success at 1.1 √(5 g R) after 2 turns, no drop lost, measured v₀ equal to the chosen one within 0.5 %", () => {
    const speed = 1.1 * EARTH_LIMIT;
    assert.equal(success_run.outcome, "success");
    assert.ok(success_run.launch_speed !== null);
    assertClose(success_run.launch_speed / speed, 1, 5e-3, "measured v₀ / chosen v₀");
    assert.ok(success_run.launch_speed <= speed * (1 + 1e-3), "never a harder throw than asked");
    assert.ok(success_run.shots.length >= 1 && success_run.shots.length <= 8, `${success_run.shots.length} shots`);
    assertClose(success_run.shots[0].target, speed * speed / 2, 1e-12, "first shot at E* = ½ v₀²");
    assertClose(success_run.shots[success_run.shots.length - 1].speed, success_run.launch_speed, 1e-12, "the kept shot is the last");
    for (let k = 0; k + 1 < success_run.shots.length; k++) {
        assertClose(success_run.shots[k + 1].target, internals.shootTarget(success_run.shots.slice(0, k + 1), speed), 1e-9, `shot ${k + 1} follows shootTarget`);
    }
    assert.ok(success_run.release_time > 5, "pumping and throw take seconds");
    assert.ok(success_run.event_time > success_run.release_time);
    assertClose(success_run.duration, success_run.event_time, 1e-12, "a success ends at the second turn");
    const last = success_run.frames[success_run.frames.length - 1];
    assert.ok(last.turns >= 2 - 1e-6 && last.turns < 2.3, `turns ${last.turns}`);
    assert.ok(success_run.frames.every((frame) => frame.drops.every((drop) => drop[2] === false)), "no drop lost");
    assert.ok(success_run.frames.every((frame) => !frame.snapped));
});

test("simulateRun: frames at 60 Hz, motor phases swing → throw → align → free, release flag, rigid bar and bail, inextensible rope", () => {
    const frames = success_run.frames;
    for (let i = 0; i < frames.length - 2; i++) {
        assertClose(frames[i].time, i / 60, 1e-9, `frame ${i} time`);
    }
    const order = [];
    for (const frame of frames) {
        if (order[order.length - 1] !== frame.motor_phase) {
            order.push(frame.motor_phase);
        }
    }
    assert.deepEqual(order, ["swing", "throw", "align", "free"]);
    assert.ok(frames.every((frame) => frame.released === (frame.motor_phase === "free")), "released ⇔ phase free");
    const first_free = frames.find((frame) => frame.released);
    assert.ok(first_free.time >= success_run.release_time - 1 / 60 - 1e-9 && first_free.time <= success_run.release_time + 1 / 60, "release time");
    const link = 0.4 / ROPE_LINKS;
    for (const frame of frames.filter((_, i) => i % 7 === 0)) {
        assertClose(distanceBetween({ x: frame.nodes[0][0], y: frame.nodes[0][1] }, { x: frame.nodes[1][0], y: frame.nodes[1][1] }), BAR_LENGTH, 1e-4, "bar rigid");
        assertClose(distanceBetween({ x: frame.nodes[HANDLE][0], y: frame.nodes[HANDLE][1] }, { x: frame.nodes[ATTACH][0], y: frame.nodes[ATTACH][1] }), BUCKET.bail, 1e-3, "bail rigid");
        for (let i = 1; i < HANDLE; i++) {
            const length = distanceBetween({ x: frame.nodes[i][0], y: frame.nodes[i][1] }, { x: frame.nodes[i + 1][0], y: frame.nodes[i + 1][1] });
            assert.ok(length <= link * (1 + 1e-3), `rope link ${i} stretched to ${length} at t = ${frame.time}`);
        }
    }
    assertClose(frames[0].center[0], 0, 1e-12, "starts hanging");
    assertClose(PIVOT_HEIGHT - frames[0].center[1], bucketRadius(0.4, 2), 1e-4, "R at t = 0");
});

test("simulateRun: peak tension is the ideal bottom tension within 0.9 – 1.4 times, below T_max; a smaller T_max snaps the rope for good", () => {
    const speed = 1.1 * EARTH_LIMIT;
    const ideal = bottomTension(0.4, 2, speed * speed, EARTH);
    assert.ok(success_run.max_tension > 0.9 * ideal && success_run.max_tension < 1.4 * ideal, `peak ${success_run.max_tension} vs ideal ${ideal}`);
    assert.ok(success_run.max_tension < 210);
    assert.ok(success_run.min_tension >= 0, "tension never negative");
    const snapped = simulateRun({ ...EARTH_SETUP, tension_max: 0.8 * success_run.max_tension, launch_speed: speed }, true);
    assert.equal(snapped.outcome, "snap");
    const last = snapped.frames[snapped.frames.length - 1];
    assert.equal(last.snapped, true);
    assert.equal(last.tension, 0, "a cut rope carries nothing");
    assertClose(snapped.duration, snapped.event_time + 1.6, 0.02, "1.6 s of aftermath");
    assert.ok(last.turns < 2, "no success after the snap");
});

test("simulateRun: fails at 0.9 √(5 g R) — the water is lost, or the bucket does not go round", () => {
    const run = simulateRun({ ...EARTH_SETUP, tension_max: 1e4, launch_speed: 0.9 * EARTH_LIMIT }, true);
    assert.ok(["spill", "swing"].includes(run.outcome), `outcome ${run.outcome}`);
    const last = run.frames[run.frames.length - 1];
    if (run.outcome === "spill") {
        assert.ok(last.drops.some((drop) => drop[2] === true), "a drop has crossed the rim");
        assertClose(run.duration, run.event_time + 1.6, 0.02, "1.6 s of aftermath");
    }
    assert.ok(last.turns < 2);
});

test("simulateRun: 0.94 √(5 g R) is a failure (a harder throw than asked is never kept)", () => {
    const run = simulateRun({ ...EARTH_SETUP, launch_speed: 0.94 * EARTH_LIMIT }, false);
    assert.notEqual(run.outcome, "success");
});

test("simulateRun without recording gives the same outcome and shots, with a single frame list head", () => {
    const quiet = simulateRun({ ...EARTH_SETUP, launch_speed: 1.1 * EARTH_LIMIT }, false);
    assert.equal(quiet.outcome, "success");
    assert.equal(quiet.launch_speed, success_run.launch_speed, "same measured v₀");
    assert.deepEqual(quiet.shots, success_run.shots);
    assert.equal(quiet.release_time, success_run.release_time);
    assert.ok(quiet.frames.length < 3, "no frames recorded");
});

test("simulateRun: v₀ = 0 (or negative) — nobody launches the bucket, it hangs and the attempt is a swing", () => {
    for (const speed of [0, -3]) {
        const run = simulateRun({ ...EARTH_SETUP, launch_speed: speed });
        assert.equal(run.outcome, "swing");
        assert.equal(run.launch_speed, 0);
        assert.deepEqual(run.shots, []);
        assert.equal(run.release_time, null);
        assert.equal(run.frames.length, 2);
        assertClose(run.frames[1].time, 1.6, 1e-12, "aftermath");
        assertClose(run.max_tension, (2 + 0.06) * EARTH, 1e-9, "hangs");
    }
});

test("simulateRun: Mars, L = 0.5 m, m = 3 kg — success at 1.1 √(5 g R) with exact v₀, failure at 0.9 √(5 g R)", () => {
    const setup = { gravity: MARS, rope_length: 0.5, mass: 3, tension_max: 150 };
    const limit = waterLimit(MARS, 0.5, 3);
    const win = simulateRun({ ...setup, launch_speed: 1.1 * limit }, false);
    assert.equal(win.outcome, "success");
    assertClose(win.launch_speed / (1.1 * limit), 1, 5e-3, "measured v₀");
    assert.ok(win.launch_speed <= 1.1 * limit * (1 + 1e-3), "never a harder throw than asked");
    const loss = simulateRun({ ...setup, launch_speed: 0.9 * limit }, false);
    assert.notEqual(loss.outcome, "success");
});

test("simulateRun is deterministic: identical runs give identical frames", () => {
    const parameters = { ...EARTH_SETUP, launch_speed: 1.1 * EARTH_LIMIT };
    const again = simulateRun(parameters, true);
    assert.deepEqual(again, success_run);
});

test("evaluate: underfilled below 90 % of the heaviest bucket, swing for v₀ = 0; fillThreshold 0 unless m is free", () => {
    const challenge = makeChallenge("mass", EARTH, 10, 0.4, null, 400);
    const window = winningWindow(challenge);
    assert.equal(fillThreshold(challenge), window.minimum);
    assertClose(fillThreshold(challenge), 3.521579, 1e-4, "hand value");
    assert.equal(fillThreshold(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 210)), 0);
    assert.equal(fillThreshold(makeChallenge("rope_length", EARTH, 9, null, 2, 210)), 0);
    assert.equal(evaluate(challenge, 3), "underfilled", "light bucket that would otherwise succeed");
    assert.equal(evaluate(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 210), 0), "swing");
});

/* ---------- pumping cache (own evaluation of game.js, own cache) ---------- */

test("pumping cache: a cold run and a warm run are identical and equal a run from scratch elsewhere; the pumping is shared between v₀ and T_max, bypassed under its peak", () => {
    const { PUMP_CACHE, pumpedAttempt } = internals;
    const parameters = { ...EARTH_SETUP, launch_speed: 1.1 * EARTH_LIMIT };
    assert.equal(PUMP_CACHE.size, 0);
    const cold = cached_api.simulateRun(parameters, false);
    assert.equal(PUMP_CACHE.size, 1);
    const warm = cached_api.simulateRun(parameters, false);
    assert.equal(PUMP_CACHE.size, 1, "the same pumping is reused");
    assert.deepEqual(warm, cold);
    const scratch = globalThis.loop_wagon_game.simulateRun(parameters, false);
    assert.equal(cold.outcome, scratch.outcome);
    assert.equal(cold.launch_speed, scratch.launch_speed);
    assert.deepEqual(JSON.parse(JSON.stringify(cold.shots)), scratch.shots);
    const pumped = pumpedAttempt(parameters, false);
    assert.ok(pumped !== null);
    assert.equal(pumped.motor.phase, "swing");
    assert.ok(pumped.motor.bucket_angle < 0, "ready to throw from a backswing");
    assert.equal(pumped.state.released, false);
    assert.ok(pumped.time > 1, "seconds of pumping simulated");
    assert.equal(pumpedAttempt({ ...parameters, launch_speed: 7, tension_max: 5000 }, false), pumped, "same entry for another v₀ and another T_max");
    assert.equal(pumpedAttempt({ ...parameters, tension_max: 10 }, false), null, "T_max below the pumping peak: bypass");
    assert.equal(PUMP_CACHE.size, 1, "the bypass keeps the entry");
});

/* ---------- challenges ---------- */

test("FALLBACK_CHALLENGES: well-formed, windows inside the input range", () => {
    assert.equal(FALLBACK_CHALLENGES.length, 2);
    for (const challenge of FALLBACK_CHALLENGES) {
        const spec = VARIABLES[challenge.variable];
        const window = winningWindow(challenge);
        assert.equal(challenge[challenge.variable], null);
        assert.ok(window.minimum >= spec.min && window.maximum <= spec.max && window.maximum - window.minimum >= 3 * spec.step, JSON.stringify(window));
    }
});

const fallback_promise = new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./helpers/generate_worker.js", import.meta.url), { workerData: { challenges: FALLBACK_CHALLENGES } });
    worker.once("message", resolve);
    worker.once("error", reject);
});
fallback_promise.catch(() => {});

/* inWorkers: seeded batches drawn on parallel worker threads (helpers/generate_worker.js), batches concatenated in worker order;
   the last worker repeats the seed of the first one without replay (reproducibility) */
function inWorkers() {
    const url = new URL("./helpers/generate_worker.js", import.meta.url);
    const seeds = [...Array.from({ length: MONTE_CARLO_WORKERS }, (_, k) => MONTE_CARLO_SEED + k), MONTE_CARLO_SEED];
    return Promise.all(seeds.map((seed, k) => new Promise((resolve, reject) => {
        const worker = new Worker(url, { workerData: { seed, count: DRAWS_PER_WORKER, replay_count: k < REPLAYED_WORKERS ? 1 : 0 } });
        worker.once("message", resolve);
        worker.once("error", reject);
    })));
}

const generated_promise = inWorkers();
generated_promise.catch(() => {});

test("isChallengeFeasible: both fallback challenges are feasible (full simulation at five points of the window)", async () => {
    assert.deepEqual(await fallback_promise, [true, true]);
});

test("isChallengeFeasible refuses impossible demands, a window outside the input range and a window narrower than 5 %", () => {
    assert.equal(isChallengeFeasible(makeChallenge("launch_speed", EARTH, null, 0.4, 2, 15)), false, "rope too weak: empty window");
    assert.equal(isChallengeFeasible(makeChallenge("launch_speed", EARTH, null, 0.15, 0.6, 1e6)), false, "window beyond 20 m/s");
    assert.equal(isChallengeFeasible(makeChallenge("mass", EARTH, 6, 0.4, null, 400)), false, "water lost: empty window");
    assert.equal(isChallengeFeasible(makeChallenge("rope_length", EARTH, 10, null, 8, 100)), false, "no rope holds it");
    const narrow_speed = 1.02 * 1.04 * waterLimit(EARTH, 0.4, 1);
    const narrow = makeChallenge("launch_speed", EARTH, null, 0.4, 1, bottomTension(0.4, 1, narrow_speed ** 2, EARTH) / 0.7);
    const window = winningWindow(narrow);
    assertClose(window.maximum, narrow_speed, 1e-6, "window top");
    assert.ok(window.maximum - window.minimum > 0 && window.maximum - window.minimum < 0.05 * window.minimum, "positive but narrower than 5 %");
    assert.equal(isChallengeFeasible(narrow), false);
});

test("randomChallenge falls back deterministically on a copy of FALLBACK_CHALLENGES[⌊rng × 2⌋] when no candidate is feasible", () => {
    const hostile = makeChallenge("launch_speed", MOON, null, 0.2, 1, 14);
    assert.equal(isChallengeFeasible(hostile), false, "premise: the constant-rng candidate is infeasible (empty window, no simulation)");
    const first = randomChallenge(() => 0);
    assert.deepEqual(first, FALLBACK_CHALLENGES[0]);
    assert.notEqual(first, FALLBACK_CHALLENGES[0], "a copy, not the shared object");
}); 

test("Monte-Carlo (seed 20260811): drawn challenges have their window inside the input range, replayed windows succeed at both ends and in the middle", async () => {
    const batches = await generated_promise;
    const generated = batches.slice(0, MONTE_CARLO_WORKERS).flat();
    assert.equal(generated.length, MONTE_CARLO_WORKERS * DRAWS_PER_WORKER);
    let replayed = 0;
    generated.forEach(({ challenge, replay }, index) => {
        const context = `seed ${MONTE_CARLO_SEED} + ${Math.floor(index / DRAWS_PER_WORKER)}, index ${index}, ${JSON.stringify(challenge)}`;
        assert.ok(challenge.variable in VARIABLES, context);
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
});

test("anti-repeat: in the Monte-Carlo draws, the excluded value never lies inside the next window of the same variable", async () => {
    const generated = (await generated_promise).slice(0, MONTE_CARLO_WORKERS).flat();
    generated.forEach(({ challenge, excluded }, index) => {
        if (excluded === null || excluded.variable !== challenge.variable) {
            return;
        }
        const window = winningWindow(challenge);
        const is_fallback = FALLBACK_CHALLENGES.some((fallback) => JSON.stringify(fallback) === JSON.stringify(challenge));
        if (!is_fallback) {
            assert.ok(excluded.value < window.minimum || excluded.value > window.maximum, `index ${index}: excluded ${excluded.value} inside [${window.minimum}, ${window.maximum}]`);
        }
    });
});

test("randomChallenge is reproducible: the same seed in two worker threads gives the same draws", async () => {
    const batches = await generated_promise;
    assert.deepEqual(batches[MONTE_CARLO_WORKERS].map((entry) => entry.challenge), batches[0].map((entry) => entry.challenge));
});

test("drawVariable frequencies are 4 : 3 : 3, with exact cut points", () => {
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
