/*
 * game_internals.js — Test helper: evaluates game.js in an isolated vm context
 * with one extra statement, inserted inside physicsModule just before its returned
 * api object, exposing the private motor, water and simulation functions
 * (stepState, solveTridiagonal, releaseBar, motorLead, moveBar, dampJoint,
 * dampEars, settleWater, buildComposite, bodyFrame, collideWithBucket, bisect,
 * shootTarget, pumpedAttempt, PUMP_CACHE, ...), without touching the production
 * file. Returns { api, internals } from that context.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE_URL = new URL("../../../../src/mechanics/loop-wagon/game.js", import.meta.url);
const EXPORT_MARKER = "        const api = {";
const INTERNAL_NAMES = [
    "stepState", "solveTridiagonal", "releaseBar", "motorLead", "moveBar", "dampJoint", "dampEars", "chainWobble",
    "substepRate", "windupRate", "waveRate", "smootherstep", "newAttempt", "advanceAttempt", "pumpedAttempt", "PUMP_CACHE",
    "shootTarget", "settleWater", "buildComposite", "carryComposite", "bodyFrame", "collideWithBucket", "bisect",
    "heaviestBucket", "shortestRope", "bucketMotion", "bucketAngle", "dropPositions", "rowLength", "captureFrame",
    "ropeLinks", "separateDrops", "moveComposite", "applyReaction", "predictedEnergy",
];

/* loadGameInternals: fresh evaluation of game.js exposing its private functions */
export function loadGameInternals() {
    const source = readFileSync(SOURCE_URL, "utf8");
    assertMarker(source);
    const patched = source.replace(EXPORT_MARKER, `        globalThis.loop_wagon_internals = { ${INTERNAL_NAMES.join(", ")} };\n${EXPORT_MARKER}`);
    const context = vm.createContext({ structuredClone });
    vm.runInContext(patched, context);
    return { api: context.loop_wagon_game, internals: context.loop_wagon_internals };
}

/* assertMarker: fail loudly when game.js no longer has the export statement the patch relies on */
function assertMarker(source) {
    if (!source.includes(EXPORT_MARKER)) {
        throw new Error("game_internals: export marker not found in game.js");
    }
}
