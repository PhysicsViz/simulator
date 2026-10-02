/*
 * main.test.js — Unit tests for the loop-the-loop physics (calcul.js): rail
 * geometry (ramp, circle, clothoid of height 2R), the classic h_min = 5R/2 and
 * N = 6 m g results, the general criterion h ≥ y − r cos(phi)/2, the load-factor
 * limit, the take-off angle cos(theta) = (2 − 2h/R)/3, the free-fall flight and
 * the RK4 timing against independent quadratures.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/loop-the-loop/calcul.js";

const {
    RAMP_LOAD_FACTOR,
    CLOTHOID_UNIT_HEIGHT,
    clothoidParameter,
    buildTrack,
    pointAt,
    speedFromEnergy,
    normalPerMass,
    minimumHeight,
    maxHeightForLoad,
    simulate,
    sampleAt,
} = globalThis.loop_calcul;

const GRAVITY = 9.81;
const SAMPLE_RATE = 240;
const SUBSTEPS = 8;

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

/* simpson: composite Simpson quadrature of f on [a, b] with an even interval count */
function simpson(f, a, b, intervals) {
    const step = (b - a) / intervals;
    let sum = f(a) + f(b);
    for (let i = 1; i < intervals; i++) {
        sum += (i % 2 === 1 ? 4 : 2) * f(a + i * step);
    }
    return sum * step / 3;
}

test("clothoid unit height matches the Fresnel power series", () => {
    // ∫₀^L sin(s²/2) ds = Σ (−1)ⁿ L^(4n+3) / ((2n+1)! 2^(2n+1) (4n+3)), L = √(2π)
    const length = Math.sqrt(2 * Math.PI);
    let series = 0;
    let factorial = 1;
    for (let n = 0; n < 30; n++) {
        if (n > 0) {
            factorial *= (2 * n) * (2 * n + 1);
        }
        series += (n % 2 === 0 ? 1 : -1) * length ** (4 * n + 3) / (factorial * 2 ** (2 * n + 1) * (4 * n + 3));
    }
    assertClose(CLOTHOID_UNIT_HEIGHT, series, 1e-10, "Y₁");
    assertClose(clothoidParameter(1), 2 / series, 1e-9, "A = 2R/Y₁");
});

test("ramp: 60° arc of radius 2h starting at rest from height h, tangent to the floor", () => {
    const radius = 1.5;
    const height = 3;
    const track = buildTrack("circle", radius, height);
    const start = pointAt(track, 0);
    assertClose(start.y, height, 1e-9, "start height");
    assertClose(start.x, -radius - Math.sqrt(3) * height, 1e-9, "start x = −R − 2h sin(60°)");
    assertClose(start.phi, -Math.PI / 3, 1e-12, "initial slope −60°");
    assertClose(start.kappa, 0, 1e-12, "extension before the rail is straight");
    assertClose(pointAt(track, 1e-9).kappa, 1 / (2 * height), 1e-12, "ramp curvature 1/(2h)");
    const entry = pointAt(track, track.loop_start);
    assertClose(entry.x, 0, 1e-12, "loop entry x");
    assertClose(entry.y, 0, 1e-12, "loop entry y");
    assertClose(RAMP_LOAD_FACTOR, 2, 1e-12, "ramp bottom: N/(m g) = 1 + 2h/(2h) = 2");
});

test("circular loop: every point at distance R from (0, R), top at (0, 2R), closed", () => {
    const radius = 1.3;
    const track = buildTrack("circle", radius, 4);
    for (let k = 0; k <= 50; k++) {
        const point = pointAt(track, track.loop_start + (k / 50) * (track.loop_end - track.loop_start));
        assertClose(Math.hypot(point.x, point.y - radius), radius, 1e-9, `on the circle at k = ${k}`);
    }
    const top = pointAt(track, (track.loop_start + track.loop_end) / 2);
    assertClose(top.x, 0, 1e-9, "top x");
    assertClose(top.y, 2 * radius, 1e-9, "top y");
    assertClose(top.phi, Math.PI, 1e-12, "moving backward at the top");
    const exit = pointAt(track, track.loop_end);
    assertClose(exit.x, 0, 1e-9, "closed: exit x");
    assertClose(exit.y, 0, 1e-9, "closed: exit y");
    assertClose(track.top_radius, radius, 1e-12, "r_top = R");
});

test("clothoid loop: height 2R, top radius A/√(2π), symmetric, curvature-continuous entry", () => {
    const radius = 1;
    const track = buildTrack("clothoid", radius, 4);
    const parameter = clothoidParameter(radius);
    const half = (track.loop_start + track.loop_end) / 2;
    const top = pointAt(track, half);
    assertClose(top.y, 2 * radius, 1e-9, "H = 2R");
    assertClose(top.phi, Math.PI, 1e-12, "horizontal at the top");
    assertClose(1 / top.kappa, parameter / Math.sqrt(2 * Math.PI), 1e-9, "r_top");
    assertClose(track.top_radius, parameter / Math.sqrt(2 * Math.PI), 1e-12, "track.top_radius");
    assertClose(pointAt(track, track.loop_start + 1e-12).kappa, 0, 1e-9, "r → ∞ at the entry");
    for (const fraction of [0.1, 0.27, 0.4]) {
        const before = pointAt(track, half - fraction * (half - track.loop_start));
        const after = pointAt(track, half + fraction * (half - track.loop_start));
        assertClose(before.y, after.y, 1e-9, `mirror height at ${fraction}`);
        assertClose(before.x + after.x, 2 * top.x, 1e-9, `mirror x at ${fraction}`);
        assertClose(before.kappa, after.kappa, 1e-12, `mirror curvature at ${fraction}`);
    }
    const exit = pointAt(track, track.loop_end);
    assertClose(exit.y, 0, 1e-9, "back on the floor");
    assertClose(exit.x, 2 * top.x, 1e-9, "exit is the mirror of the entry");
});

test("circle: h_min = 5R/2 at the top, where N = 0, and N = 6 m g at the bottom", () => {
    for (const radius of [0.5, 1, 1.7]) {
        const track = buildTrack("circle", radius, 2.5 * radius);
        const critical = minimumHeight(track);
        assertClose(critical.height, 2.5 * radius, 1e-9, `h_min for R = ${radius}`);
        assertClose(critical.phi, Math.PI, 1e-9, "critical point is the top");
        const top = pointAt(track, (track.loop_start + track.loop_end) / 2);
        assertClose(normalPerMass(GRAVITY, 2.5 * radius, top), 0, 1e-9, "N_top = 0 at h_min");
        assertClose(speedFromEnergy(GRAVITY, 2.5 * radius, top.y), Math.sqrt(GRAVITY * radius), 1e-9, "v_top = √(g R)");
        const bottom = pointAt(track, track.loop_start + 1e-12);
        assertClose(normalPerMass(GRAVITY, 2.5 * radius, bottom) / GRAVITY, 6, 1e-6, "N_bottom = 6 m g");
    }
});

test("clothoid: h_min is the exact maximum of y − r cos(phi)/2, slightly before the top", () => {
    const radius = 1;
    const track = buildTrack("clothoid", radius, 3);
    const critical = minimumHeight(track);
    let brute = -Infinity;
    for (let k = 1; k < 200000; k++) {
        const point = pointAt(track, track.loop_start + (k / 200000) * (track.loop_end - track.loop_start));
        if (point.kappa > 0 && Math.cos(point.phi) < 0) {
            brute = Math.max(brute, point.y - Math.cos(point.phi) / (2 * point.kappa));
        }
    }
    assertClose(critical.height, brute, 1e-7, "h_min against a 200 000-point scan");
    const top_criterion = 2 * radius + track.top_radius / 2;
    assert.ok(critical.height > top_criterion, "the top alone (H + r_top/2) underestimates h_min");
    assertClose(critical.height, top_criterion, 2e-3, "but only by about 0.06 %");
    assert.ok(critical.phi < Math.PI && critical.phi > 0.95 * Math.PI, `critical φ just before 180°: ${critical.phi}`);
    assert.ok(critical.height < 2.5 * radius, "the clothoid needs less height than the circle");
});

test("load limit: circle h_max = (n − 1) R / 2; below the ramp's 2 g nothing works", () => {
    const radius = 1.2;
    const track = buildTrack("circle", radius, 3);
    assertClose(maxHeightForLoad(track, 7), 3 * radius, 1e-9, "n = 7");
    assertClose(maxHeightForLoad(track, 9), 4 * radius, 1e-9, "n = 9");
    assert.equal(maxHeightForLoad(track, 1.9), 0, "n < 2");
    const clothoid = buildTrack("clothoid", radius, 3);
    const limit = maxHeightForLoad(clothoid, 4.5);
    let max_load = 0;
    const at_limit = buildTrack("clothoid", radius, limit);
    for (let k = 0; k <= 20000; k++) {
        const point = pointAt(at_limit, at_limit.loop_start + (k / 20000) * (at_limit.loop_end - at_limit.loop_start));
        max_load = Math.max(max_load, normalPerMass(GRAVITY, limit, point) / GRAVITY);
    }
    assertClose(max_load, 4.5, 1e-4, "clothoid at h_max reaches exactly the limit");
});

test("take-off on the circle at cos(theta) = (2 − 2h/R)/3 with v² = −g R cos(theta)", () => {
    const radius = 1;
    for (const height of [1.5, 2, 2.3, 2.45]) {
        const track = buildTrack("circle", radius, height);
        const trajectory = simulate(track, GRAVITY, SAMPLE_RATE, SUBSTEPS, 20);
        assert.ok(trajectory.takeoff !== null, `take-off for h = ${height}`);
        const expected_cos = (2 - 2 * height / radius) / 3;
        assertClose(Math.cos(trajectory.takeoff.phi), expected_cos, 1e-6, `cos(θ) for h = ${height}`);
        assertClose(trajectory.takeoff.y, radius * (1 - expected_cos), 1e-6, "take-off height");
        assertClose(trajectory.takeoff.speed ** 2, -GRAVITY * radius * expected_cos, 1e-5, "v² = −g R cos(θ)");
        assertClose(trajectory.takeoff.normal_per_mass, 0, 1e-6, "N = 0 at take-off");
        assert.equal(trajectory.end_reason, "impact");
        assertClose(Math.hypot(trajectory.impact.x, trajectory.impact.y - radius), radius, 1e-3, "lands back on the circle");
    }
});

test("flight follows the MRUA parabola x = u₀ τ + x₀, y = −g τ²/2 + v₀ τ + y₀", () => {
    const trajectory = simulate(buildTrack("circle", 1, 2), GRAVITY, SAMPLE_RATE, SUBSTEPS, 20);
    const takeoff = trajectory.takeoff;
    const flight = trajectory.samples.filter((sample) => sample.phase === "flight");
    assert.ok(flight.length > 10, "several flight samples");
    for (const sample of flight) {
        const tau = sample.time - takeoff.time;
        assertClose(sample.x, takeoff.velocity_x * tau + takeoff.x, 1e-9, "x(τ)");
        assertClose(sample.y, -GRAVITY * tau * tau / 2 + takeoff.velocity_y * tau + takeoff.y, 1e-9, "y(τ)");
        assert.equal(sample.normal_per_mass, 0, "no contact in flight");
    }
});

test("RK4 timing: run-in crossed at v = √(2 g h), circle lap time against a quadrature", () => {
    const radius = 1;
    const height = 3;
    const track = buildTrack("circle", radius, height);
    const trajectory = simulate(track, GRAVITY, SAMPLE_RATE, SUBSTEPS, 20);
    assert.equal(trajectory.end_reason, "end");
    const timeAtS = (target) => {
        const samples = trajectory.samples;
        for (let i = 1; i < samples.length; i++) {
            if (samples[i].s >= target) {
                const ratio = (target - samples[i - 1].s) / (samples[i].s - samples[i - 1].s);
                return samples[i - 1].time + ratio * (samples[i].time - samples[i - 1].time);
            }
        }
        return NaN;
    };
    const run_in_time = timeAtS(track.loop_start) - timeAtS(track.loop_start - radius);
    assertClose(run_in_time, radius / Math.sqrt(2 * GRAVITY * height), 1e-5, "run-in at constant speed");
    // lap time = ∫₀^2π R dθ / √(2 g (h − R (1 − cos θ)))
    const lap = simpson((theta) => radius / Math.sqrt(2 * GRAVITY * (height - radius * (1 - Math.cos(theta)))), 0, 2 * Math.PI, 2000);
    assertClose(timeAtS(track.loop_end) - timeAtS(track.loop_start), lap, 1e-5, "loop lap time");
});

test("low release: no take-off, the ball oscillates below its release height", () => {
    for (const shape of ["circle", "clothoid"]) {
        const height = 0.8;
        const track = buildTrack(shape, 1, height);
        const trajectory = simulate(track, GRAVITY, SAMPLE_RATE, SUBSTEPS, 20);
        assert.equal(trajectory.takeoff, null, `${shape}: never leaves the rail`);
        assert.equal(trajectory.end_reason, "timeout");
        assertClose(trajectory.duration, 20, 1e-9, "full window");
        const highest = Math.max(...trajectory.samples.map((sample) => sample.y));
        assert.ok(highest <= height + 1e-6, `${shape}: y ≤ h`);
        assert.ok(trajectory.samples.some((sample) => sample.s > track.loop_start), "enters the loop");
        assert.ok(trajectory.samples.some((sample, i) => i > 0 && sample.s < trajectory.samples[i - 1].s), "comes back");
    }
});

test("h = 0: the ball stays at rest at the start of the run-in", () => {
    const track = buildTrack("circle", 1, 0);
    const trajectory = simulate(track, GRAVITY, SAMPLE_RATE, SUBSTEPS, 5);
    for (const sample of trajectory.samples) {
        assert.equal(sample.s, 0);
        assert.equal(sample.speed, 0);
    }
    assertClose(trajectory.samples[0].x, -1, 1e-12, "x = −R");
    assertClose(trajectory.samples[0].normal_per_mass, GRAVITY, 1e-12, "N = m g on the floor");
});

test("above h_min the ball completes the loop and reaches the end of the rail", () => {
    for (const shape of ["circle", "clothoid"]) {
        const track = buildTrack(shape, 1, 3);
        const trajectory = simulate(track, GRAVITY, SAMPLE_RATE, SUBSTEPS, 20);
        assert.equal(trajectory.end_reason, "end", shape);
        assert.equal(trajectory.takeoff, null, shape);
        const last = trajectory.samples[trajectory.samples.length - 1];
        assertClose(last.s, track.length, 1e-12, "last sample at the rail end");
        assertClose(last.speed, Math.sqrt(2 * GRAVITY * 3), 1e-9, "v = √(2 g h) on the floor");
        for (const sample of trajectory.samples) {
            assert.ok(sample.normal_per_mass >= -1e-9, `${shape}: N ≥ 0 at s = ${sample.s}`);
        }
    }
});

test("sampleAt returns the last sample at or before t", () => {
    const trajectory = simulate(buildTrack("circle", 1, 3), GRAVITY, SAMPLE_RATE, SUBSTEPS, 20);
    assert.equal(sampleAt(trajectory, 0), trajectory.samples[0]);
    assert.equal(sampleAt(trajectory, 0.5).time, 120 / SAMPLE_RATE);
    assert.equal(sampleAt(trajectory, 0.5 + 0.9 / SAMPLE_RATE).time, 120 / SAMPLE_RATE);
    assert.equal(sampleAt(trajectory, 1e6), trajectory.samples[trajectory.samples.length - 1]);
});
