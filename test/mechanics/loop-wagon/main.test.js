/*
 * main.test.js — Unit tests for the wagon loop-the-loop physics (calcul.js):
 * exact rail geometry (continuity, tangency, loop entry at the origin, release
 * point at height h), energy speed and normal reaction against the hand
 * formulas N = m (v²/r + g cos(φ)), h_min = 5R/2, the take-off angle
 * cos(θ_d) = 2 (R − h)/(3 R) and the stop angle cos(θ) = 1 − h/R reproduced by
 * the RK4 run, energy conservation along the RK4 trajectory, the free flight
 * after take-off landing back on the circle, and the degenerate cases h = 0,
 * h ≤ R (return to the release point) and h = 3R.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/loop-wagon/calcul.js";

const {
    RAMP_ANGLE,
    buildTrack,
    pointAt,
    speedFromEnergy,
    normalPerMass,
    minimumHeight,
    topSpeed,
    topNormalPerMass,
    takeoffAngle,
    stopAngle,
    energies,
    simulate,
    sampleAt,
    releaseArcLength,
} = globalThis.loop_wagon_calcul;

const GRAVITY = 9.81;

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

/* run: RK4 trajectory with the page's sampling */
function run(loop_radius, start_height, gravity = GRAVITY) {
    return simulate(buildTrack(loop_radius, start_height), gravity, 240, 8, 30);
}

test("rail is continuous and tangent-continuous, loop entry at the origin", () => {
    const track = buildTrack(2, 5);
    for (let i = 1; i < track.segments.length; i++) {
        const segment = track.segments[i];
        const before = pointAt(track, segment.s_start - 1e-9);
        const after = pointAt(track, segment.s_start + 1e-9);
        assertClose(after.x, before.x, 1e-6, `${segment.name} x continuity`);
        assertClose(after.y, before.y, 1e-6, `${segment.name} y continuity`);
        assertClose(Math.cos(after.phi), Math.cos(before.phi), 1e-6, `${segment.name} tangent`);
    }
    const entry = pointAt(track, track.loop_start);
    assertClose(entry.x, 0, 1e-12, "entry x");
    assertClose(entry.y, 0, 1e-12, "entry y");
    assertClose(pointAt(track, 0).y, 6, 1e-12, "ramp top at 3R");
    assertClose(track.ramp_top_x, -(2 + 2 * Math.sin(RAMP_ANGLE) + (6 - 2 * (1 - Math.cos(RAMP_ANGLE))) / Math.tan(RAMP_ANGLE)), 1e-12, "ramp top x");
});

test("loop is the circle of centre (0, R) with phi = θ", () => {
    const radius = 1.7;
    const track = buildTrack(radius, 5);
    for (const theta of [0.4, Math.PI / 2, 2.2, Math.PI, 4.5, 6]) {
        const point = pointAt(track, track.loop_start + theta * radius);
        assertClose(point.x, radius * Math.sin(theta), 1e-12, `x at θ = ${theta}`);
        assertClose(point.y, radius * (1 - Math.cos(theta)), 1e-12, `y at θ = ${theta}`);
        assertClose(point.phi, theta, 1e-12, `phi at θ = ${theta}`);
        assertClose(point.kappa, 1 / radius, 1e-12, `kappa at θ = ${theta}`);
    }
    const exit = pointAt(track, track.loop_end + radius);
    assertClose(exit.x, radius, 1e-9, "exit straight x");
    assertClose(exit.y, 0, 1e-9, "exit straight y");
});

test("release point sits at height h on the incline and on the fillet", () => {
    for (const start_height of [5.4, 2, 0.6, 0.1]) {
        const track = buildTrack(2, start_height);
        assertClose(pointAt(track, track.start_s).y, start_height, 1e-9, `h = ${start_height}`);
    }
    assert.equal(buildTrack(2, 0).start_s, buildTrack(2, 0).segments[2].s_start);
    assert.equal(buildTrack(2, 7).start_height, 6, "h clamped to 3R");
});

test("speed and normal reaction follow v² = 2 g (h − y) and N/m = v²/r + g cos(φ)", () => {
    const radius = 2;
    const start_height = 5.5;
    const track = buildTrack(radius, start_height);
    const bottom = pointAt(track, track.loop_start + 1e-9);
    assertClose(normalPerMass(GRAVITY, start_height, bottom), 2 * GRAVITY * start_height / radius + GRAVITY, 1e-6, "N/m at the bottom");
    const top = pointAt(track, track.loop_start + Math.PI * radius);
    assertClose(speedFromEnergy(GRAVITY, start_height, top.y), Math.sqrt(2 * GRAVITY * (start_height - 4)), 1e-9, "v at the top");
    assertClose(normalPerMass(GRAVITY, start_height, top), topNormalPerMass(GRAVITY, start_height, radius), 1e-9, "N/m at the top");
    assertClose(topNormalPerMass(GRAVITY, start_height, radius), 2 * GRAVITY * 1.5 / 2 - GRAVITY, 1e-12, "N_s/m hand value");
    const incline = pointAt(track, 0.5);
    assertClose(normalPerMass(GRAVITY, start_height, incline), GRAVITY * Math.cos(RAMP_ANGLE), 1e-12, "straight incline: N = m g cos(60°)");
    assert.equal(speedFromEnergy(GRAVITY, 1, 3), 0, "v = 0 above h");
});

test("closed forms: h_min = 5R/2, top speed, take-off and stop angles", () => {
    assert.equal(minimumHeight(2), 5);
    assertClose(topSpeed(GRAVITY, minimumHeight(2), 2), Math.sqrt(GRAVITY * 2), 1e-12, "v_s = √(g R) at h_min");
    assert.equal(topSpeed(GRAVITY, 3, 2), null);
    assertClose(topNormalPerMass(GRAVITY, minimumHeight(2), 2), 0, 1e-12, "N_s = 0 at h_min");
    assertClose(Math.cos(takeoffAngle(4, 2)), -2 / 3, 1e-12, "cos(θ_d) = 2 (2 − 4)/6 for h = 2R");
    assert.equal(takeoffAngle(2, 2), null);
    assert.equal(takeoffAngle(5, 2), null);
    assertClose(stopAngle(1, 2), Math.acos(0.5), 1e-12, "stop angle h = R/2");
    assert.equal(stopAngle(3, 2), null);
});

test("h ≥ 5R/2: the wagon goes round and reaches the end of the rail", () => {
    for (const start_height of [5.001, 5.5, 6]) {
        const trajectory = run(2, start_height);
        assert.equal(trajectory.end_reason, "end", `h = ${start_height}`);
        assert.equal(trajectory.takeoff, null);
        for (const sample of trajectory.samples) {
            assert.ok(sample.normal_per_mass >= -1e-6, `N ≥ 0 at t = ${sample.time}`);
        }
    }
});

test("RK4 run conserves mechanical energy and matches the energy speed", () => {
    const radius = 1.5;
    const trajectory = run(radius, 4.2);
    const track = buildTrack(radius, 4.2);
    let previous_s = -Infinity;
    for (const sample of trajectory.samples) {
        const energy = energies(2, GRAVITY, sample);
        assertClose(energy.mechanical, 2 * GRAVITY * 4.2, 1e-9, `E_m at t = ${sample.time}`);
        assert.ok(sample.s >= previous_s - 1e-12, "monotonic s");
        previous_s = sample.s;
    }
    const independent = independentDuration(track);
    assertClose(trajectory.duration, independent, 2e-3, "duration against a fine Euler–Cromer run");
});

/* independentDuration: time to reach the end of the rail with a fine
   semi-implicit Euler integration of s'' = −g sin(φ) (reference for RK4) */
function independentDuration(track) {
    const dt = 2e-6;
    let s = track.start_s;
    let velocity = 0;
    let time = 0;
    while (s < track.length) {
        velocity += -GRAVITY * Math.sin(pointAt(track, s).phi) * dt;
        s += velocity * dt;
        time += dt;
    }
    return time;
}

test("R < h < 5R/2: take-off where cos(θ_d) = 2 (R − h)/(3 R), flight lands on the circle", () => {
    const radius = 2;
    for (const start_height of [2.5, 4, 4.9]) {
        const trajectory = run(radius, start_height);
        assert.ok(trajectory.takeoff !== null, `take-off for h = ${start_height}`);
        assert.equal(trajectory.end_reason, "impact");
        assertClose(trajectory.takeoff.loop_angle, takeoffAngle(start_height, radius), 1e-6, `θ_d for h = ${start_height}`);
        assertClose(trajectory.takeoff.normal_per_mass, 0, 1e-6, "N = 0 at take-off");
        const impact = trajectory.impact;
        assertClose(Math.hypot(impact.x, impact.y - radius), radius, 1e-6, "impact on the circle");
        const tau = impact.time - trajectory.takeoff.time;
        assertClose(impact.y, trajectory.takeoff.y + trajectory.takeoff.velocity_y * tau - GRAVITY * tau * tau / 2, 1e-9, "MRUA y");
        for (const sample of trajectory.samples.filter((candidate) => candidate.phase === "flight")) {
            assert.ok(Math.hypot(sample.x, sample.y - radius) <= radius + 1e-9, "flight stays inside the loop");
        }
    }
});

test("h ≤ R: the wagon stops at cos(θ) = 1 − h/R, comes back to its release point", () => {
    const radius = 2;
    const start_height = 1.4;
    const trajectory = run(radius, start_height);
    assert.equal(trajectory.end_reason, "back");
    const highest = trajectory.samples.reduce((best, sample) => (sample.loop_angle !== null && sample.loop_angle > best ? sample.loop_angle : best), 0);
    assertClose(highest, stopAngle(start_height, radius), 2e-3, "highest angle in the loop");
    const last = trajectory.samples[trajectory.samples.length - 1];
    assertClose(last.y, start_height, 1e-3, "back at height h");
    assert.ok(trajectory.samples.every((sample) => sample.normal_per_mass > 0), "N > 0 throughout");
});

test("degenerate cases: h = 0 stays at rest, sampleAt clamps", () => {
    const resting = run(2, 0);
    assert.equal(resting.end_reason, "rest");
    assert.equal(resting.duration, 0);
    assert.equal(resting.samples[0].speed, 0);
    assert.equal(sampleAt(resting, 5), resting.samples[0]);
    const full = run(2, 6);
    assert.equal(sampleAt(full, -1), full.samples[0]);
    assert.equal(sampleAt(full, 1e9), full.samples[full.samples.length - 1]);
});

test("g only changes the time scale (√g), not the path or the outcome", () => {
    const earth = run(2, 4.5, GRAVITY);
    const moon = run(2, 4.5, 1.62);
    assertClose(moon.takeoff.loop_angle, earth.takeoff.loop_angle, 1e-6, "same take-off angle");
    assertClose(moon.takeoff.time / earth.takeoff.time, Math.sqrt(GRAVITY / 1.62), 1e-3, "time ∝ 1/√g");
});

test("pointAt extends the rail along its end tangents beyond both ends", () => {
    const track = buildTrack(2, 5);
    const top = pointAt(track, 0);
    const before = pointAt(track, -3);
    assertClose(before.x, top.x - 3 * Math.cos(-RAMP_ANGLE), 1e-12, "x before the start");
    assertClose(before.y, top.y - 3 * Math.sin(-RAMP_ANGLE), 1e-12, "y before the start (higher up the incline)");
    assertClose(before.phi, -RAMP_ANGLE, 1e-15, "phi before the start");
    assert.equal(before.kappa, 0);
    assert.equal(before.segment, "incline");
    const end = pointAt(track, track.length);
    const after = pointAt(track, track.length + 2.5);
    assertClose(after.x, end.x + 2.5, 1e-9, "x past the end");
    assertClose(after.y, 0, 1e-9, "y past the end");
    assertClose(after.phi, 2 * Math.PI, 1e-12, "phi past the end");
    assert.equal(after.kappa, 0);
    assert.equal(after.segment, "exit");
    assert.equal(pointAt(track, track.length).segment, "exit", "s = length stays on the last segment");
});

test("releaseArcLength on the incline / fillet boundary and at the ends of the ramp", () => {
    const radius = 2;
    const track = buildTrack(radius, 1);
    const incline = track.segments[0];
    const fillet = track.segments[1];
    const boundary_height = radius * (1 - Math.cos(RAMP_ANGLE));
    assertClose(boundary_height, radius / 2, 1e-12, "boundary at R/2");
    assertClose(releaseArcLength(track, boundary_height), incline.length, 1e-9, "h = R/2 gives the incline end");
    assertClose(releaseArcLength(track, boundary_height + 1e-6), incline.length, 1e-5, "just above, on the incline");
    assert.ok(releaseArcLength(track, boundary_height + 1e-6) < incline.length, "just above is before the boundary");
    assert.ok(releaseArcLength(track, boundary_height - 1e-6) > incline.length, "just below is on the fillet");
    assert.equal(releaseArcLength(track, track.ramp_height), 0, "h = 3R: top of the ramp");
    assert.equal(releaseArcLength(track, 10 * radius), 0, "above 3R: top of the ramp");
    assert.equal(releaseArcLength(track, 0), fillet.s_start + fillet.length, "h = 0: fillet bottom");
    assert.equal(releaseArcLength(track, -1), fillet.s_start + fillet.length, "h < 0: fillet bottom");
    let previous = -Infinity;
    for (let start_height = 6; start_height >= 0.05; start_height -= 0.05) {
        const s = releaseArcLength(track, start_height);
        assert.ok(s >= previous, `monotonic at h = ${start_height}`);
        assertClose(pointAt(track, s).y, start_height, 1e-9, `height at h = ${start_height}`);
        previous = s;
    }
});

test("take-off close to the top (h just under 5R/2): short flight, impact on the circle after the take-off", () => {
    const radius = 2;
    for (const start_height of [4.99, 4.999]) {
        const trajectory = run(radius, start_height);
        assert.equal(trajectory.end_reason, "impact", `h = ${start_height}`);
        assertClose(trajectory.takeoff.loop_angle, takeoffAngle(start_height, radius), 1e-6, "θ_d");
        assert.ok(trajectory.takeoff.loop_angle < Math.PI, "take-off before the top");
        const tau = trajectory.impact.time - trajectory.takeoff.time;
        assert.ok(tau > 0 && tau < 2, `flight time ${tau}`);
        assertClose(Math.hypot(trajectory.impact.x, trajectory.impact.y - radius), radius, 1e-6, "impact on the circle");
        assert.ok(trajectory.impact.y < trajectory.takeoff.y + 1e-9 || trajectory.impact.x < trajectory.takeoff.x, "impact lies further along the loop");
    }
});

test("take-off close to R (h just above R): θ_d near 90°, flight lands on the circle", () => {
    const radius = 2;
    const trajectory = run(radius, 2.001);
    assert.equal(trajectory.end_reason, "impact");
    assertClose(trajectory.takeoff.loop_angle, Math.PI / 2, 1e-3, "θ_d ≈ 90°");
    assertClose(Math.hypot(trajectory.impact.x, trajectory.impact.y - radius), radius, 1e-6, "impact on the circle");
});

test("boundary heights h = 5R/2 (loops) and h = R (stops at 90°, returns)", () => {
    assert.equal(takeoffAngle(2, 2), null);
    assert.equal(takeoffAngle(5, 2), null);
    assertClose(stopAngle(2, 2), Math.PI / 2, 1e-12, "stop angle at h = R");
    assert.equal(run(2, 5).end_reason, "end");
    assert.equal(run(2, 2).end_reason, "back");
});
