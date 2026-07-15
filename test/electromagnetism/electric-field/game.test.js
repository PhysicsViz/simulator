/*
 * game.test.js — Unit tests for the hidden-charge game logic: generation
 * bounds, Monte-Carlo feasibility and the guess tolerance. game.js exits
 * before any DOM access under Node, so a side-effect import only exposes
 * globalThis.electric_field_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/electric-field/game.js";

const {
    randomHiddenCharge,
    isChallengeFeasible,
    isFound,
    MILESTONES,
    SEARCH_AREA,
    TOLERANCE,
} = globalThis.electric_field_game;

test("every hidden charge is inside the search area with a measurable value (Monte-Carlo)", () => {
    let positive_count = 0;
    for (let i = 0; i < 500; i++) {
        const hidden = randomHiddenCharge(Math.random);
        assert.equal(isChallengeFeasible(hidden), true, JSON.stringify(hidden));
        if (hidden.value > 0) {
            positive_count += 1;
        }
    }
    assert.ok(positive_count > 100 && positive_count < 400, "both signs occur");
});

test("isChallengeFeasible rejects charges outside the area or range", () => {
    assert.equal(isChallengeFeasible({ x: 10, y: 0, value: 3e-6 }), false, "outside the area");
    assert.equal(isChallengeFeasible({ x: 0, y: 0, value: 0.5e-6 }), false, "too weak to triangulate comfortably");
    assert.equal(isChallengeFeasible({ x: 0, y: 0, value: 20e-6 }), false, "outside the documented range");
});

test("isFound applies the documented tolerance", () => {
    const hidden = { x: 1, y: 1, value: 3e-6 };
    assert.equal(isFound(1.2, 1.2, hidden), true, "inside");
    assert.equal(isFound(1.4, 1, hidden, TOLERANCE), true, "on the edge");
    assert.equal(isFound(2, 1, hidden), false, "outside");
});

test("search area and milestones are the documented ones", () => {
    assert.deepEqual(SEARCH_AREA, { left: -4, right: 4, bottom: -2.5, top: 2.5 });
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
