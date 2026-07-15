/*
 * calcul.js — Head-on approach of a charged ball toward a fixed, uniformly
 * charged insulating sphere in deep space. Outside the sphere (r ≥ R) Gauss's
 * theorem makes it act as a point charge, so U(r) = k·Q·q/r and the repulsive
 * force is F = k·Q·q/r². Launched from very far with speed v∞, energy
 * conservation ½·m·v∞² = k·Q·q/r_min gives the turning radius
 * r_min = 2·k·Q·q/(m·v∞²), and the course answer inverts it: the minimum
 * launch speed to stay at least a distance d from the SURFACE is
 * v_min = √(2·k·Q·q/(m·(R + d))). The radial motion is exact: with
 * A = v∞² and B = 2·k·Q·q/m, ṙ² = A − B/r, whose time primitive is
 * T(r) = √(r·(A·r − B))/A + (B/A^1.5)·ln(√(A·r) + √(A·r − B)); the inbound
 * leg runs from the display start radius r₀, the outbound leg is its mirror
 * about the turning time, and a launch too fast ends on the surface
 * (collision at r = R). SI units.
 * Classic script (works via file://); exposes globalThis.sphere_approach_calcul.
 */
(() => {
    const COULOMB_CONSTANT = 8.988e9;
    const BISECTION_ITERATIONS = 60;

    /* potentialEnergy: U(r) = k·Q·q/r (zero at infinity, r ≥ R) */
    function potentialEnergy(sphere_charge, ball_charge, radius) {
        return COULOMB_CONSTANT * sphere_charge * ball_charge / radius;
    }

    /* repulsionForce: F = k·Q·q/r², radially outward on the ball */
    function repulsionForce(sphere_charge, ball_charge, radius) {
        return COULOMB_CONSTANT * sphere_charge * ball_charge / (radius * radius);
    }

    /* turningRadius: r_min = 2·k·Q·q/(m·v∞²) where all the kinetic energy is spent */
    function turningRadius(sphere_charge, ball_charge, mass, infinity_speed) {
        return 2 * COULOMB_CONSTANT * sphere_charge * ball_charge / (mass * infinity_speed * infinity_speed);
    }

    /* minimumSpeed: the course answer — v to turn around exactly at a radius */
    function minimumSpeed(sphere_charge, ball_charge, mass, radius) {
        return Math.sqrt(2 * COULOMB_CONSTANT * sphere_charge * ball_charge / (mass * radius));
    }

    /* speedAt: |ṙ| from energy conservation at a radius */
    function speedAt(sphere_charge, ball_charge, mass, infinity_speed, radius) {
        const squared = infinity_speed * infinity_speed
            - 2 * COULOMB_CONSTANT * sphere_charge * ball_charge / (mass * radius);
        return Math.sqrt(Math.max(squared, 0));
    }

    /* timePrimitive: antiderivative of 1/ṙ for ṙ² = A − B/r (valid for A·r ≥ B) */
    function timePrimitive(speed_squared, potential_coefficient, radius) {
        const excess = Math.max(speed_squared * radius - potential_coefficient, 0);
        return Math.sqrt(radius * excess) / speed_squared
            + (potential_coefficient / Math.pow(speed_squared, 1.5))
                * Math.log(Math.sqrt(speed_squared * radius) + Math.sqrt(excess));
    }

    /* inboundTime: exact travel time from start_radius down to radius */
    function inboundTime(sphere_charge, ball_charge, mass, infinity_speed, start_radius, radius) {
        const speed_squared = infinity_speed * infinity_speed;
        const potential_coefficient = 2 * COULOMB_CONSTANT * sphere_charge * ball_charge / mass;
        return timePrimitive(speed_squared, potential_coefficient, start_radius)
            - timePrimitive(speed_squared, potential_coefficient, radius);
    }

    /* motionAt: exact state at a time — inbound from start_radius, symmetric
       outbound after the turning point, frozen on the surface on a collision.
       Returns {radius, radial_velocity (outward +), acceleration, phase} with
       phase one of "blocked" (cannot start), "inbound", "outbound", "impact". */
    function motionAt(sphere_charge, ball_charge, mass, infinity_speed, start_radius, contact_radius, time) {
        const turning = turningRadius(sphere_charge, ball_charge, mass, infinity_speed);
        if (turning >= start_radius) {
            return { radius: start_radius, radial_velocity: 0, acceleration: 0, phase: "blocked" };
        }
        const closest = Math.max(turning, contact_radius);
        const collides = turning < contact_radius - 1e-12;
        const closest_time = inboundTime(sphere_charge, ball_charge, mass, infinity_speed, start_radius, closest);

        let radius;
        let inbound;
        if (time <= 0) {
            radius = start_radius;
            inbound = true;
        } else if (time < closest_time) {
            radius = invertInbound(sphere_charge, ball_charge, mass, infinity_speed, start_radius, closest, time);
            inbound = true;
        } else if (collides) {
            return { radius: contact_radius, radial_velocity: 0, acceleration: 0, phase: "impact" };
        } else if (time < 2 * closest_time) {
            radius = invertInbound(sphere_charge, ball_charge, mass, infinity_speed, start_radius, closest, 2 * closest_time - time);
            inbound = false;
        } else {
            return {
                radius: start_radius,
                radial_velocity: speedAt(sphere_charge, ball_charge, mass, infinity_speed, start_radius),
                acceleration: repulsionForce(sphere_charge, ball_charge, start_radius) / mass,
                phase: "outbound",
            };
        }
        const speed = speedAt(sphere_charge, ball_charge, mass, infinity_speed, radius);
        return {
            radius,
            radial_velocity: inbound ? -speed : speed,
            acceleration: repulsionForce(sphere_charge, ball_charge, radius) / mass,
            phase: inbound ? "inbound" : "outbound",
        };
    }

    /* invertInbound: bisection of the monotonic inbound time on [closest, start] */
    function invertInbound(sphere_charge, ball_charge, mass, infinity_speed, start_radius, closest, time) {
        let lower = closest;
        let upper = start_radius;
        for (let i = 0; i < BISECTION_ITERATIONS; i++) {
            const middle = (lower + upper) / 2;
            if (inboundTime(sphere_charge, ball_charge, mass, infinity_speed, start_radius, middle) < time) {
                upper = middle;
            } else {
                lower = middle;
            }
        }
        return (lower + upper) / 2;
    }

    globalThis.sphere_approach_calcul = {
        COULOMB_CONSTANT,
        potentialEnergy,
        repulsionForce,
        turningRadius,
        minimumSpeed,
        speedAt,
        inboundTime,
        motionAt,
    };
})();
