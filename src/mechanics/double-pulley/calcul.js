/*
 * calcul.js — Two-radius pulley (two cylinders on one shaft, moment of inertia
 * I, radii R1 and R2). A massless rope ties block m1 to the small cylinder
 * after passing over a smooth nail (frictionless, so the tension T1 is the
 * same on both sides); block m2 hangs from the large cylinder. Newton on each
 * block plus the rotation equation I·α = T2·R2 − T1·R1 and the rope
 * constraints a1 = α·R1, a2 = α·R2 give
 * α = g·(m2·R2 − m1·R1) / (I + m1·R1² + m2·R2²).
 * Sign convention: α > 0 turns the pulley so block 2 goes DOWN and block 1
 * goes UP; a1 is positive upward for block 1, a2 positive downward for
 * block 2. Both blocks start at rest, block 2 a gap h above block 1, so they
 * pass each other at t = √(2h/(a1+a2)) (MRUA). SI units.
 * Classic script (works via file://); exposes globalThis.double_pulley_calcul.
 */
(() => {
    /* angularAcceleration: α = g·(m2·R2 − m1·R1)/(I + m1·R1² + m2·R2²) */
    function angularAcceleration(mass_1, mass_2, radius_1, radius_2, inertia, gravity) {
        return gravity * (mass_2 * radius_2 - mass_1 * radius_1)
            / (inertia + mass_1 * radius_1 * radius_1 + mass_2 * radius_2 * radius_2);
    }

    /* accelerationBlock1: a1 = α·R1 (positive = block 1 moves up) */
    function accelerationBlock1(angular_acceleration, radius_1) {
        return angular_acceleration * radius_1;
    }

    /* accelerationBlock2: a2 = α·R2 (positive = block 2 moves down) */
    function accelerationBlock2(angular_acceleration, radius_2) {
        return angular_acceleration * radius_2;
    }

    /* tensionRope1: from T1 − m1·g = m1·a1 (a1 positive upward) */
    function tensionRope1(mass_1, acceleration_1, gravity) {
        return mass_1 * (gravity + acceleration_1);
    }

    /* tensionRope2: from m2·g − T2 = m2·a2 (a2 positive downward) */
    function tensionRope2(mass_2, acceleration_2, gravity) {
        return mass_2 * (gravity - acceleration_2);
    }

    /* meetingTime: the gap h closes as (a1+a2)·t²/2 — Infinity when the blocks
       do not approach (equilibrium or reversed motion) */
    function meetingTime(height_gap, acceleration_1, acceleration_2) {
        const closing = acceleration_1 + acceleration_2;
        if (closing <= 0) {
            return Infinity;
        }
        return Math.sqrt(2 * height_gap / closing);
    }

    /* positionBlock1: y1(t) = y10 + a1·t²/2 (MRUA from rest) */
    function positionBlock1(start_height, acceleration_1, time) {
        return start_height + acceleration_1 * time * time / 2;
    }

    /* positionBlock2: y2(t) = y10 + h − a2·t²/2 (MRUA from rest) */
    function positionBlock2(start_height, height_gap, acceleration_2, time) {
        return start_height + height_gap - acceleration_2 * time * time / 2;
    }

    /* verticalVelocityBlock1: ẏ1 = a1·t (positive = upward) */
    function verticalVelocityBlock1(acceleration_1, time) {
        return acceleration_1 * time;
    }

    /* verticalVelocityBlock2: ẏ2 = −a2·t (positive = upward) */
    function verticalVelocityBlock2(acceleration_2, time) {
        return -acceleration_2 * time;
    }

    /* angularVelocity: ω = α·t */
    function angularVelocity(angular_acceleration, time) {
        return angular_acceleration * time;
    }

    /* rotationAngle: θ = α·t²/2 */
    function rotationAngle(angular_acceleration, time) {
        return angular_acceleration * time * time / 2;
    }

    /* floorTimeBlock1: time for block 1 to reach y = 0 (Infinity if it rises) */
    function floorTimeBlock1(start_height, acceleration_1) {
        if (acceleration_1 >= 0) {
            return Infinity;
        }
        return Math.sqrt(2 * start_height / -acceleration_1);
    }

    /* floorTimeBlock2: time for block 2 to reach y = 0 (Infinity if it rises) */
    function floorTimeBlock2(start_height, height_gap, acceleration_2) {
        if (acceleration_2 <= 0) {
            return Infinity;
        }
        return Math.sqrt(2 * (start_height + height_gap) / acceleration_2);
    }

    globalThis.double_pulley_calcul = {
        angularAcceleration,
        accelerationBlock1,
        accelerationBlock2,
        tensionRope1,
        tensionRope2,
        meetingTime,
        positionBlock1,
        positionBlock2,
        verticalVelocityBlock1,
        verticalVelocityBlock2,
        angularVelocity,
        rotationAngle,
        floorTimeBlock1,
        floorTimeBlock2,
    };
})();
