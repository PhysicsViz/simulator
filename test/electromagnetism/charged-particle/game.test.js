/*
 * game.test.js — Unit tests for the ring-flight game logic: ring generation
 * bounds, Monte-Carlo feasibility, and ring-plane crossing classification.
 * game.js exits before any DOM access under Node, so a side-effect import only
 * exposes globalThis.charged_particle_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/charged-particle/game.js";

const { randomRing, isSituationFeasible, isRingCrossing, MILESTONES } = globalThis.charged_particle_game;

test("randomRing stays within its documented bounds", () => {
    const low = randomRing(() => 0);
    assert.equal(low.x, 3);
    assert.ok(Math.abs(low.y - 0.6) < 1e-12);
    assert.equal(low.radius, 0.15);
    const high = randomRing(() => 0.999999);
    assert.ok(high.x < 8.001);
    assert.ok(high.y < 3.400001);
    assert.ok(high.radius < 0.450001);
});

test("every generated ring is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const ring = randomRing(Math.random);
        assert.equal(isSituationFeasible(ring), true, JSON.stringify(ring));
    }
});

test("isSituationFeasible rejects rings outside the reachable start heights", () => {
    assert.equal(isSituationFeasible({ x: 5, y: 4.5, radius: 0.3 }), false, "above the range");
    assert.equal(isSituationFeasible({ x: 5, y: 0.1, radius: 0.3 }), false, "below the range");
});

test("isSituationFeasible rejects rings touching a plate", () => {
    assert.equal(isSituationFeasible({ x: 5, y: 0.25, radius: 0.3 }), false, "clips the bottom plate");
    assert.equal(isSituationFeasible({ x: 5, y: 3.79, radius: 0.3 }), false, "clips the top plate");
});

test("isRingCrossing classifies crossings of the ring plane", () => {
    const ring = { x: 5, y: 2, radius: 0.3 };
    assert.equal(isRingCrossing({ x: 4.9, y: 2.1 }, { x: 5.1, y: 1.9 }, ring), "through", "inside the opening");
    assert.equal(isRingCrossing({ x: 4.9, y: 3 }, { x: 5.1, y: 3.1 }, ring), "missed", "above the opening");
    assert.equal(isRingCrossing({ x: 4.5, y: 2 }, { x: 4.9, y: 2 }, ring), null, "no crossing yet");
});

test("isRingCrossing interpolates the crossing height", () => {
    const ring = { x: 5, y: 2, radius: 0.3 };
    assert.equal(isRingCrossing({ x: 4, y: 3 }, { x: 6, y: 1 }, ring), "through", "steep segment through center");
    assert.equal(isRingCrossing({ x: 4, y: 3.4 }, { x: 6, y: 1.4 }, ring), "missed", "steep segment offset");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
