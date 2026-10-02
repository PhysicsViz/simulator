/*
 * game.test.js — Unit tests for the water-bucket game logic (bucket swung in a
 * vertical circle, R = arm + rope, passing the horizontal position with speed v₀
 * after an arm-driven wind-up): the closed form T = m (v₀²/R + 3 g cos(θ))
 * cross-checked against calcul.js (same N = m (v²/r + g cos(φ)) on the loop),
 * RK4 energy conservation, event angles, the winning windows of the three free
 * variables (v₀, R, m — the mass challenge asks for ≥ 90 % of the largest mass)
 * and their 4.33 : 3.33 : 2.33 draw frequencies,
 * Monte-Carlo solvability over variables and places, the anti-repeat rule, the
 * wind-up boundary conditions and the unlucky bounce landing on its target.
 * calcul.js is imported for the cross-check; game.js exits before any DOM access
 * under Node.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/loop-the-loop/calcul.js";
import "../../../src/mechanics/loop-the-loop/game.js";

const { buildTrack, pointAt, normalPerMass } = globalThis.loop_calcul;
const {
    MILESTONES,
    GRAVITY,
    PLACES,
    VARIABLES,
    MASS_FILL_RATIO,
    FALLBACK_CHALLENGES,
    tensionPerMass,
    resolveParameters,
    winningWindow,
    isChallengeFeasible,
    randomChallenge,
    winsWith,
    evaluateSwing,
    simulateSwing,
    swingAt,
    swingTimeAtAngle,
    windupDuration,
    windupAt,
    bounceToward,
    nextMilestone,
} = globalThis.loop_game;

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

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

/* speedChallenge: v₀ is the free variable */
function speedChallenge(radius, mass, tension_max, gravity = GRAVITY) {
    return { variable: "launch_speed", place: "earth", gravity, launch_speed: null, radius, mass, tension_max };
}

/* middleOf: centre of the window, rounded to the input step */
function middleOf(challenge) {
    const window = winningWindow(challenge);
    return Math.round((window.minimum + window.maximum) / 2 * 100) / 100;
}

test("T = m (v₀²/R + 3 g cos(θ)) is the loop's N on a circle entered with h = v₀²/(2g) + R", () => {
    const radius = 1.1;
    const launch_speed = 6.3;
    const track = buildTrack("circle", radius, launch_speed ** 2 / (2 * GRAVITY) + radius);
    for (const theta of [0.3, Math.PI / 2, 2.4, Math.PI, 4.1, 5.9]) {
        const point = pointAt(track, track.loop_start + theta * radius);
        assertClose(tensionPerMass(radius, launch_speed, theta), normalPerMass(GRAVITY, track.start_height, point), 1e-6, `θ = ${theta}`);
    }
});

test("RK4 swing conserves energy: (R ω)² = v₀² + 2 g R cos(θ)", () => {
    const radius = 1.2;
    const launch_speed = 7;
    const swing = simulateSwing(radius, launch_speed);
    for (const time of [0, 0.125, 0.5, 1.7, 4.2]) {
        const { theta, omega } = swingAt(swing, time);
        assertClose((radius * omega) ** 2, launch_speed ** 2 + 2 * GRAVITY * radius * Math.cos(theta), 1e-6, `t = ${time}`);
    }
});

test("windows match the hand formulas for each free variable", () => {
    const speed = winningWindow(speedChallenge(1.2, 2, 160));
    assertClose(speed.minimum, Math.sqrt(3 * GRAVITY * 1.2), 1e-12, "v₀ ≥ √(3 g R)");
    assertClose(speed.maximum, Math.sqrt((80 - 3 * GRAVITY) * 1.2), 1e-12, "v₀ ≤ √((T_max/m − 3 g) R)");
    const length = winningWindow({ variable: "radius", gravity: GRAVITY, launch_speed: 6, radius: null, mass: 2, tension_max: 140 });
    assertClose(length.minimum, 36 / (70 - 3 * GRAVITY), 1e-12, "R ≥ v₀²/(T_max/m − 3 g)");
    assertClose(length.maximum, 36 / (3 * GRAVITY), 1e-12, "R ≤ v₀²/(3 g)");
    const mass = winningWindow({ variable: "mass", gravity: GRAVITY, launch_speed: 6, radius: 1, mass: null, tension_max: 150 });
    const mass_max = 150 / (36 + 3 * GRAVITY);
    assertClose(mass.maximum, mass_max, 1e-12, "m ≤ T_max/(v₀²/R + 3 g)");
    assertClose(mass.minimum, MASS_FILL_RATIO * mass_max, 1e-12, "m ≥ 90 % of the limit");
    const dry = winningWindow({ variable: "mass", gravity: GRAVITY, launch_speed: 4, radius: 1, mass: null, tension_max: 150 });
    assert.ok(dry.minimum > dry.maximum, "v₀² < 3 g R: no mass keeps the water in");
});

test("outcomes on each side of each window name the right physical reason", () => {
    const speed = speedChallenge(1.2, 2, 160);
    const speed_window = winningWindow(speed);
    assert.equal(evaluateSwing(speed, speed_window.minimum - 0.01).outcome, "water_fell");
    assert.equal(evaluateSwing(speed, speed_window.maximum + 0.01).outcome, "rope_broke");
    assert.equal(evaluateSwing(speed, 0).outcome, "too_slow");
    const length = { variable: "radius", gravity: GRAVITY, launch_speed: 6, radius: null, mass: 2, tension_max: 140 };
    const length_window = winningWindow(length);
    assert.equal(evaluateSwing(length, length_window.maximum + 0.01).outcome, "water_fell", "rope too long");
    assert.equal(evaluateSwing(length, length_window.minimum - 0.01).outcome, "rope_broke", "rope too short");
    assert.equal(evaluateSwing(length, (length_window.minimum + length_window.maximum) / 2).outcome, "success");
    const mass = { variable: "mass", gravity: GRAVITY, launch_speed: 6, radius: 1, mass: null, tension_max: 150 };
    const mass_window = winningWindow(mass);
    assert.equal(evaluateSwing(mass, mass_window.maximum + 0.01).outcome, "rope_broke", "too heavy");
    assert.equal(evaluateSwing(mass, mass_window.minimum - 0.01).outcome, "underfilled", "not filled enough");
    assert.equal(evaluateSwing(mass, (mass_window.minimum + mass_window.maximum) / 2).outcome, "success");
});

test("event angles: water leaves where T = 0, the rope snaps where T = T_max", () => {
    const challenge = speedChallenge(1, 2, 147);
    const slow = evaluateSwing(challenge, 4);
    assert.equal(slow.outcome, "water_fell");
    assert.ok(slow.theta > Math.PI / 2 && slow.theta < Math.PI, "between the horizontal and the top");
    assertClose(tensionPerMass(1, 4, slow.theta), 0, 1e-9, "T = 0");
    const fast = evaluateSwing(challenge, 7.5);
    assert.equal(fast.outcome, "rope_broke");
    assert.ok(fast.theta > Math.PI && fast.theta < 2 * Math.PI, "on the way down");
    assertClose(tensionPerMass(1, 7.5, fast.theta), 147 / 2, 1e-9, "T = T_max");
    const swing = simulateSwing(1, 4);
    assertClose(swingAt(swing, swingTimeAtAngle(swing, slow.theta)).theta, slow.theta, 1e-6, "time lookup");
});

test("lower speeds lose the water earlier, closer to the horizontal", () => {
    const challenge = speedChallenge(1, 2, 147);
    const angles = [1, 2, 3, 4, 5].map((speed) => evaluateSwing(challenge, speed).theta);
    for (let i = 1; i < angles.length; i++) {
        assert.ok(angles[i] > angles[i - 1], `θ grows with v₀: ${angles}`);
    }
});

test("randomChallenge: every variable and place is drawn, the free variable is not given", () => {
    const rng = seededRandom(7);
    const variables = new Set();
    const places = new Set();
    for (let i = 0; i < 600; i++) {
        const challenge = randomChallenge(rng);
        variables.add(challenge.variable);
        places.add(challenge.place);
        assert.equal(challenge[challenge.variable], null, "the free variable is not given");
        const place = PLACES.find((entry) => entry.key === challenge.place);
        assert.equal(place.gravity, challenge.gravity);
        assert.ok(Number.isInteger(challenge.tension_max), "T_max in whole newtons");
    }
    assert.deepEqual([...variables].sort(), Object.keys(VARIABLES).sort(), "v₀, R and m");
    assert.equal(places.size, PLACES.length, "every place");
});

test("free variable frequencies follow the weights 4.33 (v₀) : 3.33 (R) : 2.33 (m)", () => {
    const rng = seededRandom(31);
    const counts = { launch_speed: 0, radius: 0, mass: 0 };
    const draws = 4000;
    for (let i = 0; i < draws; i++) {
        counts[randomChallenge(rng).variable] += 1;
    }
    const total = VARIABLES.launch_speed.weight + VARIABLES.radius.weight + VARIABLES.mass.weight;
    for (const key of Object.keys(counts)) {
        assertClose(counts[key] / draws, VARIABLES[key].weight / total, 0.025, `share of ${key}`);
    }
});

test("every generated challenge is solvable from the middle of its window (Monte-Carlo)", () => {
    const rng = seededRandom(2026);
    for (let i = 0; i < 900; i++) {
        const challenge = randomChallenge(rng);
        assert.equal(isChallengeFeasible(challenge), true, JSON.stringify(challenge));
        const spec = VARIABLES[challenge.variable];
        const window = winningWindow(challenge);
        assert.ok(window.minimum >= spec.min && window.maximum <= spec.max, "inside the input range");
        const middle = middleOf(challenge);
        assert.equal(evaluateSwing(challenge, middle).outcome, "success", `${challenge.variable} = ${middle} in ${JSON.stringify(challenge)}`);
        if (i % 30 === 0) {
            const { launch_speed, radius, mass } = resolveParameters(challenge, middle);
            const swing = simulateSwing(radius, launch_speed, challenge.gravity);
            const lap_end = swingTimeAtAngle(swing, 2 * Math.PI);
            for (let time = 0; time <= lap_end; time += 0.01) {
                const { theta, omega } = swingAt(swing, time);
                const tension = mass * (radius * omega * omega + challenge.gravity * Math.cos(theta));
                assert.ok(tension >= 0 && tension <= challenge.tension_max + 1e-6, `T = ${tension} at θ = ${theta}`);
            }
        }
    }
});

test("anti-repeat: the value of the previous attempt never wins the next challenge", () => {
    const rng = seededRandom(99);
    let previous = randomChallenge(rng);
    for (let i = 0; i < 600; i++) {
        const used = middleOf(previous);
        const next = randomChallenge(rng, { variable: previous.variable, value: used });
        assert.equal(isChallengeFeasible(next), true, JSON.stringify(next));
        if (next.variable === previous.variable) {
            assert.notEqual(evaluateSwing(next, used).outcome, "success", `${next.variable} = ${used} wins again`);
            assert.equal(winsWith(next, used), false, "outside the window with margin");
        }
        previous = next;
    }
    const [earth, moon] = FALLBACK_CHALLENGES;
    assert.equal(isChallengeFeasible(earth) && isChallengeFeasible(moon), true, "fallbacks feasible");
    assert.equal(winsWith(moon, middleOf(earth)), false, "fallbacks are disjoint");
});

test("isChallengeFeasible rejects impossible or too narrow challenges", () => {
    assert.equal(isChallengeFeasible(speedChallenge(1, 2, 110)), false, "T_max below 6 m g");
    assert.equal(isChallengeFeasible(speedChallenge(1, 2, 119)), false, "window narrower than 3 %");
    assert.equal(isChallengeFeasible(speedChallenge(1.3, 1, 2000)), false, "v₀_max beyond the input");
    assert.equal(isChallengeFeasible({ variable: "radius", gravity: GRAVITY, launch_speed: 9, radius: null, mass: 2, tension_max: 140 }), false, "R beyond 1.3 m");
    assert.equal(isChallengeFeasible({ variable: "mass", gravity: GRAVITY, launch_speed: 4, radius: 1, mass: null, tension_max: 150 }), false, "water always falls");
});

test("wind-up: starts hanging at rest, swings back, arrives at π/2 with ω = v₀/R", () => {
    for (const [radius, speed] of [[1, 6], [1.3, 12], [0.9, 0], [1.1, 15]]) {
        const duration = windupDuration(radius, speed);
        const start = windupAt(radius, speed, 0);
        assertClose(start.theta, 0, 1e-12, "hanging");
        assertClose(start.omega, 0, 1e-12, "at rest");
        const end = windupAt(radius, speed, duration);
        assertClose(end.theta, Math.PI / 2, 1e-9, "horizontal");
        assertClose(end.omega, speed / radius, 1e-9, "ω = v₀/R");
        let previous = windupAt(radius, speed, 0.4 * duration).theta;
        assert.ok(previous < 0, "went back first");
        for (let k = 1; k <= 50; k++) {
            const theta = windupAt(radius, speed, 0.4 * duration + (0.6 * duration * k) / 50).theta;
            assert.ok(theta >= previous - 1e-12, "forward stroke is monotone");
            previous = theta;
        }
    }
});

test("the unlucky bounce is a true parabola ending exactly on its target", () => {
    const bounce = bounceToward(1.2, -0.3, -4, -0.2, 1.3);
    const x = 1.2 + bounce.velocity_x * bounce.flight_time;
    const y = -0.3 + bounce.velocity_y * bounce.flight_time - GRAVITY * bounce.flight_time ** 2 / 2;
    assertClose(x, -0.2, 1e-9, "target x");
    assertClose(y, 1.3, 1e-9, "target y");
    assert.ok(bounce.velocity_y - GRAVITY * bounce.flight_time < 0, "lands while falling");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
    assert.equal(nextMilestone(0), 1);
    assert.equal(nextMilestone(100), null);
});
