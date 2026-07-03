/*
 * main.test.js — Unit tests for the projectile-motion kinematics (calcul.js).
 * Every expected value is computed analytically from the closed-form equations,
 * using simple numbers (g = 10, angles of 30/45/60/90°) so results are exact.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/projectile-motion/calcul.js";

const {
    degToRad,
    positionX,
    positionY,
    velocityX,
    velocityY,
    flightTime,
    maxHeight,
    horizontalRange,
    weightForce,
    speedMagnitude,
} = globalThis.projectile_calcul;

const EPSILON = 1e-9;

/* assertClose: strict numeric comparison within EPSILON */
function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < EPSILON, `${message}: expected ${expected}, got ${actual}`);
}

test("degToRad converts degrees to radians", () => {
    assertClose(degToRad(180), Math.PI, "180°");
    assertClose(degToRad(90), Math.PI / 2, "90°");
    assertClose(degToRad(0), 0, "0°");
});

test("velocityX is the constant horizontal component v0·cos(theta)", () => {
    assertClose(velocityX(10, degToRad(60)), 5, "v0=10, theta=60°");
    assertClose(velocityX(10, degToRad(0)), 10, "horizontal launch");
    assertClose(velocityX(10, degToRad(90)), 0, "vertical launch");
});

test("velocityY starts at v0·sin(theta) and vanishes at the apex", () => {
    const launch_angle = degToRad(30);
    assertClose(velocityY(20, launch_angle, 10, 0), 10, "t=0");
    const apex_time = (20 * Math.sin(launch_angle)) / 10;
    assertClose(velocityY(20, launch_angle, 10, apex_time), 0, "apex");
});

test("positionX grows linearly in time", () => {
    const launch_angle = degToRad(60);
    assertClose(positionX(10, launch_angle, 2), 10, "v0=10, theta=60°, t=2");
    assertClose(positionX(10, launch_angle, 4), 20, "doubling t doubles x");
});

test("positionY follows h0 + v0·sin(theta)·t − ½·g·t²", () => {
    const launch_angle = degToRad(30);
    assertClose(positionY(5, 20, launch_angle, 10, 0), 5, "t=0 returns h0");
    assertClose(positionY(0, 20, launch_angle, 10, 1), 5, "0 + 10·1 − 5·1");
    assertClose(positionY(2, 20, launch_angle, 10, 2), 2, "2 + 10·2 − 5·4");
});

test("flightTime from ground level equals 2·v0·sin(theta)/g", () => {
    assertClose(flightTime(0, 20, degToRad(30), 10), 2, "v0=20, theta=30°, g=10");
});

test("flightTime with initial height lands exactly at y=0", () => {
    const launch_angle = degToRad(45);
    const landing_time = flightTime(12, 18, launch_angle, 9.81);
    assertClose(positionY(12, 18, launch_angle, 9.81, landing_time), 0, "y(t_flight)");
});

test("flightTime for a pure drop equals sqrt(2·h0/g)", () => {
    assertClose(flightTime(20, 0, 0, 10), 2, "h0=20, g=10");
});

test("maxHeight equals h0 + (v0·sin(theta))²/(2g)", () => {
    assertClose(maxHeight(0, 20, degToRad(30), 10), 5, "ground launch");
    assertClose(maxHeight(3, 20, degToRad(30), 10), 8, "elevated launch");
});

test("maxHeight is h0 when launching horizontally or downward", () => {
    assertClose(maxHeight(5, 20, degToRad(0), 10), 5, "horizontal launch");
    assertClose(maxHeight(5, 20, degToRad(-30), 10), 5, "downward launch");
});

test("flightTime with a downward launch angle still lands at y=0", () => {
    const landing_time = flightTime(20, 10, degToRad(-30), 10);
    assertClose(positionY(20, 10, degToRad(-30), 10, landing_time), 0, "y(t_flight)");
});

test("horizontalRange from ground level equals v0²·sin(2·theta)/g", () => {
    assertClose(horizontalRange(0, 20, degToRad(45), 10), 40, "45° optimum");
});

test("horizontalRange is symmetric between theta and 90° − theta", () => {
    const range_30 = horizontalRange(0, 25, degToRad(30), 9.81);
    const range_60 = horizontalRange(0, 25, degToRad(60), 9.81);
    assertClose(range_30, range_60, "30° vs 60°");
});

test("horizontalRange is zero for a vertical launch", () => {
    assertClose(horizontalRange(0, 15, degToRad(90), 9.81), 0, "theta=90°");
});

test("weightForce equals m·g", () => {
    assertClose(weightForce(2, 9.81), 19.62, "m=2, g=9.81");
});

test("speedMagnitude is the Euclidean norm of the velocity components", () => {
    assertClose(speedMagnitude(3, 4), 5, "3-4-5 triangle");
    assertClose(speedMagnitude(0, -7), 7, "sign-independent");
});
