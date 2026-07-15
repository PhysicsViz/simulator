/*
 * game.test.js — Unit tests for the shield-grazing game logic: the monotonic
 * closest-approach gap, challenge generation bounds, Monte-Carlo feasibility
 * (a 0.1 m/s slider-grid speed always turns around inside the ring) and the
 * checker's rejections. game.js exits before any DOM access under Node, so a
 * side-effect import (after calcul.js, which it reads) only exposes
 * globalThis.sphere_approach_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/sphere-approach/calcul.js";
import "../../../src/electromagnetism/sphere-approach/game.js";

const {
    gapFor,
    winningSpeeds,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    BAND_HALF_WIDTH,
} = globalThis.sphere_approach_game;

const FALLBACK = {
    sphere_charge: 8e-6,
    ball_charge: 1e-6,
    mass: 60e-6,
    sphere_radius: 0.12,
    band_low: 0.06,
    band_high: 0.08,
};

test("the gap decreases monotonically with the launch speed", () => {
    let previous = Infinity;
    for (const speed of [60, 90, 112.3, 150, 250]) {
        const gap = gapFor(FALLBACK, speed);
        assert.ok(gap < previous, `v = ${speed} turns closer`);
        previous = gap;
    }
});

test("the fallback mission is feasible and the course speed wins it", () => {
    assert.equal(isSituationFeasible(FALLBACK), true, "fallback feasible");
    const winners = winningSpeeds(FALLBACK);
    assert.ok(winners.length > 0, "winners exist");
    assert.ok(winners.some((speed) => Math.abs(speed - 112.3) < 4), "≈ the course answer is among them");
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 100; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.sphere_charge >= 1e-6 && challenge.sphere_charge <= 20e-6, "Q range");
        assert.ok(challenge.ball_charge >= 0.1e-6 && challenge.ball_charge <= 5e-6, "q range");
        assert.ok(challenge.mass >= 5e-6 && challenge.mass <= 500e-6, "m range");
        assert.ok(challenge.sphere_radius >= 0.02 && challenge.sphere_radius <= 0.3, "R range");
        assert.ok(challenge.band_high - challenge.band_low >= 2 * BAND_HALF_WIDTH - 0.0021, "ring width");
        assert.ok(challenge.band_low >= 0.005, "ring above the surface");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("every winning speed really turns around inside the ring (Monte-Carlo)", () => {
    for (let i = 0; i < 50; i++) {
        const challenge = randomChallenge(Math.random);
        const winners = winningSpeeds(challenge);
        assert.ok(winners.length > 0, "at least one winning speed");
        for (const speed of winners) {
            const gap = gapFor(challenge, speed);
            assert.ok(
                gap >= challenge.band_low - 1e-12 && gap <= challenge.band_high + 1e-12,
                `v = ${speed} turns at ${gap}`,
            );
        }
    }
});

test("isSituationFeasible rejects out-of-range or impossible missions", () => {
    assert.equal(isSituationFeasible({ ...FALLBACK, sphere_charge: 50e-6 }), false, "Q out of range");
    assert.equal(isSituationFeasible({ ...FALLBACK, band_low: 0.001, band_high: 0.002 }), false, "ring too thin and low");
    assert.equal(
        isSituationFeasible({ ...FALLBACK, band_low: 3, band_high: 3.02 }),
        false,
        "ring beyond any reachable turnaround",
    );
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
