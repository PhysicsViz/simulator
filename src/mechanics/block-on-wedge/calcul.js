/*
 * calcul.js — Block of mass m on a triangular wedge of mass M pushed by a
 * horizontal force F on a frictionless floor; static friction µs between
 * block and wedge (kinetic friction taken equal to µs when sliding).
 * No-slip regime: the pair shares a = F/(m+M); isolating the block,
 * N = m·(g·cos α + a·sin α) and the required (up-slope positive) friction is
 * f = m·(g·sin α − a·cos α); |f| ≤ µs·N bounds the acceleration to
 * g·tan(α − φ) ≤ a ≤ g·tan(α + φ) with the friction angle φ = atan µs, hence
 * F_min = (m+M)·g·tan(α − φ) (clamped at 0) and F_max = (m+M)·g·tan(α + φ)
 * (infinite when α + φ ≥ 90°). Outside the window the block slides on the
 * incline: with all forces constant the accelerations stay constant, and the
 * exact two-body solution is N = m·(F·sin α + M·g·cos α)/D with
 * D = (m+M)·sin²α + M·cos²α + σ·µ·m·sin α·cos α (σ = +1 sliding up-slope
 * relative to the wedge, −1 sliding down), s̈ = (N·(cos α − σ·µ·sin α) − m·g)
 * /(m·sin α) along the slope and A = (F + m·s̈·cos α)/(m+M) for the wedge.
 * Up-slope means toward the wedge apex, opposite the push direction. SI units.
 * Classic script (works via file://); exposes globalThis.block_wedge_calcul.
 */
(() => {
    /* frictionAngle: φ = atan µ — the half-opening of the friction cone */
    function frictionAngle(friction_coefficient) {
        return Math.atan(friction_coefficient);
    }

    /* systemAcceleration: a = F/(m+M) when the pair moves together */
    function systemAcceleration(force, block_mass, wedge_mass) {
        return force / (block_mass + wedge_mass);
    }

    /* stuckNormal: N = m·(g·cos α + a·sin α) in the no-slip regime */
    function stuckNormal(block_mass, incline_angle, acceleration, gravity) {
        return block_mass * (gravity * Math.cos(incline_angle) + acceleration * Math.sin(incline_angle));
    }

    /* requiredFriction: f = m·(g·sin α − a·cos α), positive = up-slope */
    function requiredFriction(block_mass, incline_angle, acceleration, gravity) {
        return block_mass * (gravity * Math.sin(incline_angle) - acceleration * Math.cos(incline_angle));
    }

    /* minAcceleration / maxAcceleration: the no-slip window g·tan(α ∓ φ) */
    function minAcceleration(incline_angle, friction_coefficient, gravity) {
        return gravity * Math.tan(incline_angle - frictionAngle(friction_coefficient));
    }
    function maxAcceleration(incline_angle, friction_coefficient, gravity) {
        const total_angle = incline_angle + frictionAngle(friction_coefficient);
        if (total_angle >= Math.PI / 2) {
            return Infinity;
        }
        return gravity * Math.tan(total_angle);
    }

    /* minForce / maxForce: the course answer, F = (m+M)·a at the two limits */
    function minForce(block_mass, wedge_mass, incline_angle, friction_coefficient, gravity) {
        return Math.max(
            (block_mass + wedge_mass) * minAcceleration(incline_angle, friction_coefficient, gravity),
            0,
        );
    }
    function maxForce(block_mass, wedge_mass, incline_angle, friction_coefficient, gravity) {
        return (block_mass + wedge_mass) * maxAcceleration(incline_angle, friction_coefficient, gravity);
    }

    /* isStuck: F inside [F_min, F_max] keeps the block from sliding */
    function isStuck(force, block_mass, wedge_mass, incline_angle, friction_coefficient, gravity) {
        return force >= minForce(block_mass, wedge_mass, incline_angle, friction_coefficient, gravity) - 1e-12
            && force <= maxForce(block_mass, wedge_mass, incline_angle, friction_coefficient, gravity) + 1e-12;
    }

    /* slidingSolution: exact constant accelerations while the block slides
       (sliding_sign = +1 up-slope relative to the wedge, −1 down-slope) */
    function slidingSolution(force, block_mass, wedge_mass, incline_angle, friction_coefficient, gravity, sliding_sign) {
        const sine = Math.sin(incline_angle);
        const cosine = Math.cos(incline_angle);
        const denominator = (block_mass + wedge_mass) * sine * sine
            + wedge_mass * cosine * cosine
            + sliding_sign * friction_coefficient * block_mass * sine * cosine;
        const normal = block_mass * (force * sine + wedge_mass * gravity * cosine) / denominator;
        const relative_acceleration = (normal * (cosine - sliding_sign * friction_coefficient * sine)
            - block_mass * gravity) / (block_mass * sine);
        const wedge_acceleration = (force + block_mass * relative_acceleration * cosine)
            / (block_mass + wedge_mass);
        return { normal, relative_acceleration, wedge_acceleration };
    }

    /* motionState: exact state at time t, released from rest — wedge position/
       velocity/acceleration, relative slide s (up-slope positive) and its
       derivatives, the contact forces and the regime flag */
    function motionState(force, block_mass, wedge_mass, incline_angle, friction_coefficient, gravity, time) {
        if (isStuck(force, block_mass, wedge_mass, incline_angle, friction_coefficient, gravity)) {
            const acceleration = systemAcceleration(force, block_mass, wedge_mass);
            return {
                sliding: false,
                wedge_position: acceleration * time * time / 2,
                wedge_velocity: acceleration * time,
                wedge_acceleration: acceleration,
                slide_displacement: 0,
                slide_velocity: 0,
                slide_acceleration: 0,
                normal: stuckNormal(block_mass, incline_angle, acceleration, gravity),
                friction: requiredFriction(block_mass, incline_angle, acceleration, gravity),
            };
        }
        const sliding_sign = force > maxForce(block_mass, wedge_mass, incline_angle, friction_coefficient, gravity)
            ? 1
            : -1;
        const solution = slidingSolution(
            force, block_mass, wedge_mass, incline_angle, friction_coefficient, gravity, sliding_sign,
        );
        return {
            sliding: true,
            wedge_position: solution.wedge_acceleration * time * time / 2,
            wedge_velocity: solution.wedge_acceleration * time,
            wedge_acceleration: solution.wedge_acceleration,
            slide_displacement: solution.relative_acceleration * time * time / 2,
            slide_velocity: solution.relative_acceleration * time,
            slide_acceleration: solution.relative_acceleration,
            normal: solution.normal,
            friction: -sliding_sign * friction_coefficient * solution.normal,
        };
    }

    globalThis.block_wedge_calcul = {
        frictionAngle,
        systemAcceleration,
        stuckNormal,
        requiredFriction,
        minAcceleration,
        maxAcceleration,
        minForce,
        maxForce,
        isStuck,
        slidingSolution,
        motionState,
    };
})();
