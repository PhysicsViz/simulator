/*
 * generate_worker.js — Worker thread of game.test.js: draws seeded batches of
 * randomChallenge results (each one runs several full simulations) so the
 * Monte-Carlo tests can spread them over the CPU cores. Each draw excludes the
 * middle of the previous window (anti-repeat), the first replay_count draws of
 * the batch are replayed through the simulation at both ends and in the middle of
 * their winning window. Does nothing when run as a plain script (node --test
 * also picks this file up).
 */
import { isMainThread, parentPort, workerData } from "node:worker_threads";
import "../../../../src/mechanics/loop-wagon/game.js";

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

/* generateBatch: sequential draws, each one excluding the middle of the previous window (anti-repeat);
   the first replay_count draws are replayed through the simulation (outcomes at the low end, the middle and the high end) */
function generateBatch(rng, count, replay_count) {
    const { randomChallenge, winningWindow, evaluate } = globalThis.loop_wagon_game;
    const entries = [];
    let excluded = null;
    for (let i = 0; i < count; i++) {
        const challenge = randomChallenge(rng, excluded);
        const window = winningWindow(challenge);
        const middle = (window.minimum + window.maximum) / 2;
        const replay = i < replay_count ? [window.minimum, middle, window.maximum].map((value) => evaluate(challenge, value)) : null;
        entries.push({ challenge, excluded, replay });
        excluded = { variable: challenge.variable, value: middle };
    }
    return entries;
}

if (!isMainThread) {
    const rng = seededRandom(workerData.seed);
    parentPort.postMessage(generateBatch(rng, workerData.count, workerData.replay_count));
}
