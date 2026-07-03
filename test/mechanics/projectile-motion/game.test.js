/*
 * game.test.js — Unit tests for the game mode's pure logic (scoring detection
 * and target generation). game.js exits before any DOM access under Node, so a
 * side-effect import only exposes globalThis.projectile_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/projectile-motion/game.js";

const { randomTarget, isScoringCrossing, nextMilestone, MILESTONES } = globalThis.projectile_game;

const target = { x: 10, radius: 0.5, height: 3.05 };

test("scores when descending through the rim center", () => {
    assert.equal(isScoringCrossing({ x: 9.8, y: 3.4 }, { x: 10.1, y: 2.8 }, target), true);
});

test("scores at the rim edge, within the radius tolerance", () => {
    assert.equal(isScoringCrossing({ x: 10.45, y: 3.2 }, { x: 10.45, y: 2.9 }, target), true);
});

test("does not score when crossing outside the rim opening", () => {
    assert.equal(isScoringCrossing({ x: 8.0, y: 3.4 }, { x: 8.3, y: 2.8 }, target), false);
});

test("does not score while ascending through the rim plane", () => {
    assert.equal(isScoringCrossing({ x: 9.9, y: 2.8 }, { x: 10.0, y: 3.4 }, target), false);
});

test("does not score when the segment stays above or below the rim plane", () => {
    assert.equal(isScoringCrossing({ x: 9.9, y: 4.0 }, { x: 10.0, y: 3.5 }, target), false);
    assert.equal(isScoringCrossing({ x: 9.9, y: 2.9 }, { x: 10.0, y: 2.4 }, target), false);
});

test("crossing point is interpolated, not taken from the endpoints", () => {
    const wide_segment_target = { x: 10, radius: 0.5, height: 3.05 };
    assert.equal(isScoringCrossing({ x: 6, y: 3.15 }, { x: 14, y: 2.95 }, wide_segment_target), true);
    assert.equal(isScoringCrossing({ x: 6, y: 3.06 }, { x: 14, y: 2.94 }, wide_segment_target), false);
});

test("nextMilestone returns the first tier strictly above the score", () => {
    assert.equal(nextMilestone(0), 1);
    assert.equal(nextMilestone(1), 5);
    assert.equal(nextMilestone(7), 10);
    assert.equal(nextMilestone(99), 100);
    assert.equal(nextMilestone(100), null);
    assert.equal(MILESTONES.length, 7);
});

test("randomTarget stays within its documented bounds", () => {
    const low = randomTarget(() => 0);
    assert.equal(low.x, 5);
    assert.equal(low.radius, 0.35);
    assert.equal(low.height, 2);
    const high = randomTarget(() => 0.999999);
    assert.ok(high.x < 18.001);
    assert.ok(high.radius < 0.900001);
    assert.ok(high.height < 4.500001);
});
