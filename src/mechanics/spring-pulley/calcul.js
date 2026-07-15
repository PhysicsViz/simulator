/*
 * calcul.js — Spring–incline–pulley system: block m1 on an incline (angle θ,
 * kinetic friction µ, static taken equal) is tied to a spring (constant k,
 * natural length at start) anchored down the slope and, through a massless
 * rope and ideal pulley, to a hanging block m2. Released from rest, m2 falls
 * by x while m1 climbs the slope by x and the spring stretches by x.
 * The energy theorem answers the course question:
 * ½·(m1+m2)·v² = m2·g·x − m1·g·sinθ·x − ½·k·x² − µ·m1·g·cosθ·x.
 * The full motion is a Coulomb-damped harmonic oscillation, exact piecewise:
 * with F = m2·g − m1·g·sinθ, f = µ·m1·g·cosθ and ω = √(k/(m1+m2)), each
 * half-cycle is harmonic about the shifted center (F ∓ f)/k (the friction
 * sign follows the motion), turning points map x → 2·center − x every π/ω,
 * and the system sticks at a turning point once |F − k·x| ≤ f. SI units.
 * Classic script (works via file://); exposes globalThis.spring_pulley_calcul.
 */
(() => {
    const MAX_PHASES = 120;

    /* drivingForce: F = m2·g − m1·g·sinθ (constant pull toward +x) */
    function drivingForce(mass_1, mass_2, incline_angle, gravity) {
        return mass_2 * gravity - mass_1 * gravity * Math.sin(incline_angle);
    }

    /* frictionMagnitude: f = µ·N = µ·m1·g·cosθ */
    function frictionMagnitude(mass_1, incline_angle, friction_coefficient, gravity) {
        return friction_coefficient * mass_1 * gravity * Math.cos(incline_angle);
    }

    /* normalForce: N = m1·g·cosθ on the incline */
    function normalForce(mass_1, incline_angle, gravity) {
        return mass_1 * gravity * Math.cos(incline_angle);
    }

    /* angularFrequency: ω = √(k/(m1+m2)) of every half-cycle */
    function angularFrequency(stiffness, mass_1, mass_2) {
        return Math.sqrt(stiffness / (mass_1 + mass_2));
    }

    /* speedAfterDrop: the course answer from the energy theorem (first swing) */
    function speedAfterDrop(mass_1, mass_2, stiffness, incline_angle, friction_coefficient, gravity, drop) {
        const net_work = drivingForce(mass_1, mass_2, incline_angle, gravity) * drop
            - stiffness * drop * drop / 2
            - frictionMagnitude(mass_1, incline_angle, friction_coefficient, gravity) * drop;
        return Math.sqrt(Math.max(2 * net_work / (mass_1 + mass_2), 0));
    }

    /* firstSwingMax: largest drop of the first swing, 2·(F − f)/k (0 if it never starts) */
    function firstSwingMax(mass_1, mass_2, stiffness, incline_angle, friction_coefficient, gravity) {
        const net = drivingForce(mass_1, mass_2, incline_angle, gravity)
            - frictionMagnitude(mass_1, incline_angle, friction_coefficient, gravity);
        return 2 * Math.max(net, 0) / stiffness;
    }

    /* buildMotion: the exact half-cycle sequence until the system sticks */
    function buildMotion(mass_1, mass_2, stiffness, incline_angle, friction_coefficient, gravity) {
        const force = drivingForce(mass_1, mass_2, incline_angle, gravity);
        const friction = frictionMagnitude(mass_1, incline_angle, friction_coefficient, gravity);
        const omega = angularFrequency(stiffness, mass_1, mass_2);
        const half_period = Math.PI / omega;
        const phases = [];
        let position = 0;
        let time = 0;
        for (let i = 0; i < MAX_PHASES; i++) {
            const net = force - stiffness * position;
            if (Math.abs(net) <= friction + 1e-12) {
                break;
            }
            const direction = Math.sign(net);
            const center = (force - direction * friction) / stiffness;
            phases.push({ start_time: time, start_position: position, center });
            position = 2 * center - position;
            time += half_period;
        }
        return { omega, phases, rest_position: position, total_duration: time };
    }

    /* motionAt: exact {position, velocity, acceleration, moving} at a time —
       position = fall of m2 = climb of m1 = spring stretch */
    function motionAt(motion, time) {
        if (motion.phases.length === 0 || time <= 0) {
            return { position: motion.phases.length === 0 ? motion.rest_position : 0, velocity: 0, acceleration: 0, moving: false };
        }
        if (time >= motion.total_duration) {
            return { position: motion.rest_position, velocity: 0, acceleration: 0, moving: false };
        }
        let phase = motion.phases[0];
        for (const candidate of motion.phases) {
            if (candidate.start_time <= time) {
                phase = candidate;
            }
        }
        const phase_time = time - phase.start_time;
        const swing = phase.start_position - phase.center;
        const position = phase.center + swing * Math.cos(motion.omega * phase_time);
        return {
            position,
            velocity: -motion.omega * swing * Math.sin(motion.omega * phase_time),
            acceleration: motion.omega * motion.omega * (phase.center - position),
            moving: true,
        };
    }

    /* ropeTension: on the m2 side, m2·g − T = m2·a (a = downward acceleration of m2) */
    function ropeTension(mass_2, gravity, acceleration) {
        return mass_2 * (gravity - acceleration);
    }

    globalThis.spring_pulley_calcul = {
        drivingForce,
        frictionMagnitude,
        normalForce,
        angularFrequency,
        speedAfterDrop,
        firstSwingMax,
        buildMotion,
        motionAt,
        ropeTension,
    };
})();
