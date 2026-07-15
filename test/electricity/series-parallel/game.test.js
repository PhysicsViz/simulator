/*
 * game.test.js — Unit tests for the brightest-bulb prediction game: challenge
 * generation bounds, Monte-Carlo feasibility (a unique brightest bulb with a
 * 1.3× power margin), the expected winner of each topology, label
 * permutations and the checker's rejections. game.js exits before any DOM
 * access under Node, so a side-effect import (after calcul.js, which it
 * reads) only exposes globalThis.series_parallel_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/series-parallel/calcul.js";
import "../../../src/electricity/series-parallel/game.js";

const {
    bulbPowers,
    brightestPosition,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    POWER_MARGIN,
    RESISTOR_CHOICES,
} = globalThis.series_parallel_game;

test("series topology: the largest resistance wins", () => {
    const challenge = { topology: "series", resistances: [5, 47, 22], labels: ["A", "B", "C"] };
    assert.equal(brightestPosition(challenge), 1, "47 Ω dissipates the most in series");
    assert.equal(isSituationFeasible(challenge), true);
});

test("parallel topology: the smallest resistance wins", () => {
    const challenge = { topology: "parallel", resistances: [22, 5, 47], labels: ["A", "B", "C"] };
    assert.equal(brightestPosition(challenge), 1, "5 Ω dissipates the most in parallel");
    assert.equal(isSituationFeasible(challenge), true);
});

test("mixed topology: the lone bulb wins with a 4× margin", () => {
    const challenge = { topology: "mixed", resistances: [10, 10, 10], labels: ["C", "A", "B"] };
    assert.equal(brightestPosition(challenge), 0, "the series bulb carries twice the current");
    const powers = bulbPowers(challenge);
    assert.ok(powers[0] / powers[1] > POWER_MARGIN, "well above the required margin");
    assert.equal(isSituationFeasible(challenge), true);
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 300; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(["series", "parallel", "mixed"].includes(challenge.topology), "known topology");
        assert.equal(challenge.resistances.length, 3, "three bulbs");
        assert.equal([...challenge.labels].sort().join(""), "ABC", "labels are a permutation of A, B, C");
        if (challenge.topology === "mixed") {
            assert.deepEqual(challenge.resistances, [10, 10, 10], "mixed uses identical bulbs");
        } else {
            for (const resistance of challenge.resistances) {
                assert.ok(RESISTOR_CHOICES.includes(resistance), "resistances from the documented set");
            }
            assert.equal(new Set(challenge.resistances).size, 3, "distinct resistances");
        }
    }
});

test("every generated challenge is feasible with a unique winner (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
        const powers = bulbPowers(challenge);
        const sorted = [...powers].sort((a, b) => b - a);
        assert.ok(sorted[0] >= POWER_MARGIN * sorted[1], "clear margin over the runner-up");
    }
});

test("isSituationFeasible rejects ties and malformed challenges", () => {
    assert.equal(
        isSituationFeasible({ topology: "series", resistances: [10, 10, 10], labels: ["A", "B", "C"] }),
        false,
        "identical bulbs in series all glow the same",
    );
    assert.equal(
        isSituationFeasible({ topology: "parallel", resistances: [10, 10, 10], labels: ["A", "B", "C"] }),
        false,
        "identical bulbs in parallel all glow the same",
    );
    assert.equal(
        isSituationFeasible({ topology: "series", resistances: [5, 22, 47], labels: ["A", "A", "C"] }),
        false,
        "labels must be a permutation",
    );
    assert.equal(
        isSituationFeasible({ topology: "ring", resistances: [5, 22, 47], labels: ["A", "B", "C"] }),
        false,
        "unknown topology",
    );
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
