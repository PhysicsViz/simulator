/*
 * calcul.js — Mass dropped on a vertical ideal spring (the course's
 * trampoline). A mass m falls from a height h above the natural top of a
 * massless ideal spring of constant k; y is the height of the mass above the
 * natural top (y < 0 means a compression x = −y). Energy conservation between
 * the highest and the lowest point gives m·g·(h + d) = ½·k·d², so the course
 * question inverts to k = 2·m·g·(h + d)/d², and the maximum depression is
 * d = x_eq + √(x_eq² + (v/ω)²) with x_eq = m·g/k, v = √(2·g·h), ω = √(k/m).
 * The motion is exact and piecewise: MRUA free fall until contact, then
 * harmonic motion x(t') = x_eq·(1 − cos ωt') + (v/ω)·sin ωt' about the
 * equilibrium compression, leaving the spring after (2π − 2α)/ω with
 * α = atan2(v/ω, x_eq), then a symmetric ascent back to h — periodic, no
 * losses. h = 0 keeps the mass in permanent contact (grazing oscillation).
 * SI units. Classic script (works via file://); exposes
 * globalThis.mass_spring_calcul.
 */
(() => {
    /* impactSpeed: v = √(2·g·h) at the moment the mass touches the spring */
    function impactSpeed(gravity, drop_height) {
        return Math.sqrt(2 * gravity * drop_height);
    }

    /* freeFallTime: duration of the drop, t = √(2·h/g) */
    function freeFallTime(gravity, drop_height) {
        return Math.sqrt(2 * drop_height / gravity);
    }

    /* equilibriumCompression: x_eq = m·g/k (NOT the lowest point) */
    function equilibriumCompression(mass, gravity, stiffness) {
        return mass * gravity / stiffness;
    }

    /* angularFrequency: ω = √(k/m) of the contact phase */
    function angularFrequency(stiffness, mass) {
        return Math.sqrt(stiffness / mass);
    }

    /* maxDepression: lowest point, d = x_eq + √(x_eq² + (v/ω)²) —
       equivalent to solving m·g·(h + d) = ½·k·d² */
    function maxDepression(mass, gravity, drop_height, stiffness) {
        const rest_compression = equilibriumCompression(mass, gravity, stiffness);
        const swing = impactSpeed(gravity, drop_height) / angularFrequency(stiffness, mass);
        return rest_compression + Math.hypot(rest_compression, swing);
    }

    /* springConstantFromDepression: the course answer, k = 2·m·g·(h + d)/d² */
    function springConstantFromDepression(mass, gravity, drop_height, depression) {
        return 2 * mass * gravity * (drop_height + depression) / (depression * depression);
    }

    /* contactDuration: time in contact, (2π − 2α)/ω with α = atan2(v/ω, x_eq) */
    function contactDuration(mass, gravity, drop_height, stiffness) {
        const omega = angularFrequency(stiffness, mass);
        const alpha = Math.atan2(
            impactSpeed(gravity, drop_height) / omega,
            equilibriumCompression(mass, gravity, stiffness),
        );
        return (2 * Math.PI - 2 * alpha) / omega;
    }

    /* cyclePeriod: fall + contact + symmetric ascent (h = 0: contact only) */
    function cyclePeriod(mass, gravity, drop_height, stiffness) {
        return 2 * freeFallTime(gravity, drop_height) + contactDuration(mass, gravity, drop_height, stiffness);
    }

    /* maxAcceleration: peak (upward) acceleration at the lowest point,
       a_max = k·d/m − g */
    function maxAcceleration(mass, gravity, drop_height, stiffness) {
        return stiffness * maxDepression(mass, gravity, drop_height, stiffness) / mass - gravity;
    }

    /* motionAt: exact piecewise state at a time within one cycle —
       {height (of the mass above the natural top), velocity (upward +),
       acceleration (upward +), in_contact} */
    function motionAt(mass, gravity, drop_height, stiffness, time) {
        const period = cyclePeriod(mass, gravity, drop_height, stiffness);
        const cycle_time = ((time % period) + period) % period;
        const fall_time = freeFallTime(gravity, drop_height);
        const contact_time = contactDuration(mass, gravity, drop_height, stiffness);
        const impact = impactSpeed(gravity, drop_height);

        if (cycle_time < fall_time) {
            return {
                height: drop_height - gravity * cycle_time * cycle_time / 2,
                velocity: -gravity * cycle_time,
                acceleration: -gravity,
                in_contact: false,
            };
        }
        if (cycle_time < fall_time + contact_time) {
            const omega = angularFrequency(stiffness, mass);
            const rest_compression = equilibriumCompression(mass, gravity, stiffness);
            const phase_time = cycle_time - fall_time;
            const compression = rest_compression * (1 - Math.cos(omega * phase_time))
                + (impact / omega) * Math.sin(omega * phase_time);
            const compression_rate = rest_compression * omega * Math.sin(omega * phase_time)
                + impact * Math.cos(omega * phase_time);
            return {
                height: -compression,
                velocity: -compression_rate,
                acceleration: stiffness * compression / mass - gravity,
                in_contact: true,
            };
        }
        const ascent_time = cycle_time - fall_time - contact_time;
        return {
            height: impact * ascent_time - gravity * ascent_time * ascent_time / 2,
            velocity: impact - gravity * ascent_time,
            acceleration: -gravity,
            in_contact: false,
        };
    }

    /* energies: kinetic, gravitational (reference at the natural top) and
       elastic energy of a motion state; their sum stays m·g·h */
    function energies(mass, gravity, stiffness, state) {
        const compression = Math.max(-state.height, 0);
        return {
            kinetic: mass * state.velocity * state.velocity / 2,
            gravitational: mass * gravity * state.height,
            elastic: stiffness * compression * compression / 2,
        };
    }

    globalThis.mass_spring_calcul = {
        impactSpeed,
        freeFallTime,
        equilibriumCompression,
        angularFrequency,
        maxDepression,
        springConstantFromDepression,
        contactDuration,
        cyclePeriod,
        maxAcceleration,
        motionAt,
        energies,
    };
})();
