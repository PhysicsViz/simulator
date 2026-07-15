/*
 * game.test.js — Unit tests for the descent-brake game logic: the first-swing
 * depth 2·(F − f)/k as the (monotonic) target of the friction choice,
 * challenge generation bounds, Monte-Carlo feasibility (a 0.01 slider-grid µ
 * always turns the load around inside the zone) and the checker's rejections.
 * game.js exits before any DOM access under Node, so a side-effect import
 * (after calcul.js, which it reads) only exposes globalThis.spring_pulley_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/spring-pulley/calcul.js";
import "../../../src/mechanics/spring-pulley/game.js";

const calc = globalThis.spring_pulley_calcul;
const {
    firstDropFor,
    winningFrictions,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    ZONE_HALF_WIDTH,
} = globalThis.spring_pulley_game;

/* fallbackChallenge: the course setup with a zone around µ = 0.11 */
function fallbackChallenge() {
    const base = { mass_1: 1, mass_2: 3, incline_degrees: 25, stiffness: 16, zone_low: 0, zone_high: 0 };
    const depth = firstDropFor(base, 0.11);
    base.zone_low = Math.round((depth - ZONE_HALF_WIDTH) * 100) / 100;
    base.zone_high = Math.round((depth + ZONE_HALF_WIDTH) * 100) / 100;
    return base;
}

test("the first-swing depth decreases monotonically with the friction", () => {
    const base = { mass_1: 1, mass_2: 3, incline_degrees: 25, stiffness: 16 };
    let previous = Infinity;
    for (const friction of [0.02, 0.1, 0.2, 0.4, 0.6, 0.8]) {
        const depth = firstDropFor(base, friction);
        assert.ok(depth < previous, `µ = ${friction} turns around higher`);
        previous = depth;
    }
});

test("the target is the course's energy theorem with v = 0", () => {
    const base = { mass_1: 1, mass_2: 3, incline_degrees: 25, stiffness: 16 };
    const depth = firstDropFor(base, 0.11);
    assert.ok(Math.abs(depth - 3.038) < 1e-2, "2·(F − f)/k ≈ 3.04 m for the course numbers");
    assert.ok(
        calc.speedAfterDrop(1, 3, 16, 25 * Math.PI / 180, 0.11, 9.81, depth) < 1e-6,
        "the speed vanishes exactly at the first-swing depth",
    );
});

test("the fallback mission is feasible and µ = 0.11 wins it", () => {
    const challenge = fallbackChallenge();
    assert.equal(isSituationFeasible(challenge), true, "fallback feasible");
    assert.ok(winningFrictions(challenge).includes(0.11), "the reference friction is a winner");
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.mass_1 >= 0.5 && challenge.mass_1 <= 3, "m1 range");
        assert.ok(challenge.mass_2 >= 1.5 && challenge.mass_2 <= 8, "m2 range");
        assert.ok(challenge.incline_degrees >= 15 && challenge.incline_degrees <= 45, "angle range");
        assert.ok(challenge.stiffness >= 8 && challenge.stiffness <= 60, "stiffness range");
        assert.ok(challenge.zone_high - challenge.zone_low >= 2 * ZONE_HALF_WIDTH - 0.011, "zone width");
        assert.ok(challenge.zone_low >= 0.3, "zone visibly below the start");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 300; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("every winning friction really turns around inside the zone (Monte-Carlo)", () => {
    for (let i = 0; i < 100; i++) {
        const challenge = randomChallenge(Math.random);
        const winners = winningFrictions(challenge);
        assert.ok(winners.length > 0, "at least one winning µ");
        for (const friction of winners) {
            const depth = firstDropFor(challenge, friction);
            assert.ok(
                depth >= challenge.zone_low - 1e-9 && depth <= challenge.zone_high + 1e-9,
                `µ = ${friction} turns at ${depth} inside [${challenge.zone_low}, ${challenge.zone_high}]`,
            );
        }
    }
});

test("isSituationFeasible rejects out-of-range or impossible missions", () => {
    const challenge = fallbackChallenge();
    assert.equal(isSituationFeasible({ ...challenge, mass_1: 10 }), false, "mass out of range");
    assert.equal(isSituationFeasible({ ...challenge, zone_low: 0.1, zone_high: 0.2 }), false, "zone too high");
    assert.equal(
        isSituationFeasible({ ...challenge, zone_low: 20, zone_high: 20.3 }),
        false,
        "zone deeper than any reachable turnaround",
    );
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
