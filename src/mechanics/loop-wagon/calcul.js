/*
 * calcul.js — Classic loop-the-loop with a roller-coaster wagon: the wagon,
 * modelled as a point mass m, is released from rest at height h on a
 * frictionless rail, runs down a fixed ramp, along a horizontal run-in, through
 * a vertical circular loop of radius R, then along an exit straight.
 * Every length of the rail is proportional to R, so the picture only scales:
 *   incline  straight at 60° from height 3R (the top of the ramp, h ≤ 3R)
 *   fillet   circular arc of radius R turning from −60° to 0°, tangent to the floor
 *   run_in   straight of length R ending at the loop entry (origin)
 *   loop     circle of radius R, centre (0, R), inclination phi from 0 to 2π
 *   exit     straight of length 3.1R
 * Geometry is exact (straights and arcs in closed form, inclination phi(s),
 * curvature kappa(s) = 1/r). Dynamics: tangential equation s'' = −g sin(phi)
 * integrated with RK4 (time evolution only); the speed shown is the exact energy
 * value v = sqrt(2 g (h − y)); normal reaction N = m (v²/r + g cos(phi)), the
 * normal pointing toward the centre of curvature. The wagon is NOT held on the
 * rail (no upstop wheels): it leaves it as soon as N would become negative —
 * on the circle cos(θ_d) = 2 (R − h)/(3 R), for R < h < 5R/2 — then flies freely
 * (MRUA parabola) until it meets the circle again, where the simulation stops
 * (impact not modelled). Loop condition: N ≥ 0 at the top ⇔ h ≥ h_min = 5R/2.
 * Below h = R the wagon climbs to cos(θ) = 1 − h/R, rolls back and the run ends
 * when it is back at its release point.
 * SI units, angles in radians. Classic script (works via file://); exposes
 * globalThis.loop_wagon_calcul.
 */
(() => {
    const RAMP_ANGLE = Math.PI / 3;
    const RAMP_HEIGHT_RATIO = 3;
    const FILLET_RADIUS_RATIO = 1;
    const RUN_IN_LENGTH_RATIO = 1;
    const EXIT_LENGTH_RATIO = 3.1;
    const MINIMUM_HEIGHT_RATIO = 2.5;
    const LEAVING_TOLERANCE = 1e-9;
    const IMPACT_SCAN_STEPS_PER_TIME_SCALE = 400;
    const IMPACT_SCAN_TIME_SCALES = 12;

    /* segmentPoint: exact position, inclination and curvature at the local abscissa
       u of a straight (kappa = 0) or circular arc (kappa = 1/r) segment */
    function segmentPoint(segment, u) {
        const phi = segment.phi_start + segment.kappa * u;
        if (segment.kappa === 0) {
            return {
                x: segment.x_start + u * Math.cos(segment.phi_start),
                y: segment.y_start + u * Math.sin(segment.phi_start),
                phi,
                kappa: 0,
            };
        }
        return {
            x: segment.x_start + (Math.sin(phi) - Math.sin(segment.phi_start)) / segment.kappa,
            y: segment.y_start - (Math.cos(phi) - Math.cos(segment.phi_start)) / segment.kappa,
            phi,
            kappa: segment.kappa,
        };
    }

    /* buildTrack: rail for a loop radius R and release height h (clamped to
       [0, 3R]), loop entry at the origin, y measured from the floor */
    function buildTrack(loop_radius, start_height) {
        const fillet_radius = FILLET_RADIUS_RATIO * loop_radius;
        const ramp_height = RAMP_HEIGHT_RATIO * loop_radius;
        const fillet_height = fillet_radius * (1 - Math.cos(RAMP_ANGLE));
        const incline_length = (ramp_height - fillet_height) / Math.sin(RAMP_ANGLE);
        const run_in_length = RUN_IN_LENGTH_RATIO * loop_radius;
        const definitions = [
            { name: "incline", length: incline_length, phi_start: -RAMP_ANGLE, kappa: 0 },
            { name: "fillet", length: fillet_radius * RAMP_ANGLE, phi_start: -RAMP_ANGLE, kappa: 1 / fillet_radius },
            { name: "run_in", length: run_in_length, phi_start: 0, kappa: 0 },
            { name: "loop", length: 2 * Math.PI * loop_radius, phi_start: 0, kappa: 1 / loop_radius },
            { name: "exit", length: EXIT_LENGTH_RATIO * loop_radius, phi_start: 2 * Math.PI, kappa: 0 },
        ];

        const segments = [];
        let s_start = 0;
        let x = -(run_in_length + fillet_radius * Math.sin(RAMP_ANGLE) + incline_length * Math.cos(RAMP_ANGLE));
        let y = ramp_height;
        for (const definition of definitions) {
            const segment = { ...definition, s_start, x_start: x, y_start: y };
            const end = segmentPoint(segment, segment.length);
            segments.push(segment);
            s_start += segment.length;
            x = definition.name === "run_in" ? 0 : end.x;
            y = definition.name === "run_in" ? 0 : end.y;
        }

        const loop = segments.find((segment) => segment.name === "loop");
        const track = {
            loop_radius,
            fillet_radius,
            ramp_height,
            start_height: Math.min(Math.max(start_height, 0), ramp_height),
            segments,
            length: s_start,
            loop_start: loop.s_start,
            loop_end: loop.s_start + loop.length,
            loop_height: 2 * loop_radius,
            ramp_top_x: segments[0].x_start,
        };
        track.start_s = releaseArcLength(track, track.start_height);
        return track;
    }

    /* findSegment: segment containing the arc length s (0 ≤ s ≤ length) */
    function findSegment(track, s) {
        for (const segment of track.segments) {
            if (s <= segment.s_start + segment.length) {
                return segment;
            }
        }
        return track.segments[track.segments.length - 1];
    }

    /* pointAt: position, inclination phi, curvature kappa and segment name at arc
       length s; beyond either end the rail is extended along its end tangent */
    function pointAt(track, s) {
        if (s < 0 || s > track.length) {
            const segment = s < 0 ? track.segments[0] : track.segments[track.segments.length - 1];
            const end = segmentPoint(segment, s < 0 ? 0 : segment.length);
            const overshoot = s < 0 ? s : s - track.length;
            return {
                s,
                x: end.x + overshoot * Math.cos(end.phi),
                y: end.y + overshoot * Math.sin(end.phi),
                phi: end.phi,
                kappa: 0,
                segment: segment.name,
            };
        }
        const segment = findSegment(track, s);
        return { s, ...segmentPoint(segment, s - segment.s_start), segment: segment.name };
    }

    /* releaseArcLength: arc length of the rail point at height h on the ramp
       (bisection, y decreases along incline and fillet); h = 0 → fillet bottom */
    function releaseArcLength(track, start_height) {
        const fillet = track.segments[1];
        const ramp_end = fillet.s_start + fillet.length;
        if (start_height >= track.ramp_height) {
            return 0;
        }
        if (start_height <= 0) {
            return ramp_end;
        }
        let low = 0;
        let high = ramp_end;
        for (let i = 0; i < 80; i++) {
            const middle = (low + high) / 2;
            if (pointAt(track, middle).y > start_height) {
                low = middle;
            } else {
                high = middle;
            }
        }
        return (low + high) / 2;
    }

    /* speedFromEnergy: v = sqrt(2 g (h − y)), zero above the release height */
    function speedFromEnergy(gravity, start_height, y) {
        return Math.sqrt(Math.max(2 * gravity * (start_height - y), 0));
    }

    /* normalPerMass: N/m = v²/r + g cos(phi) at a rail point, v from energy */
    function normalPerMass(gravity, start_height, point) {
        const speed = speedFromEnergy(gravity, start_height, point.y);
        return speed * speed * point.kappa + gravity * Math.cos(point.phi);
    }

    /* minimumHeight: h_min = 5R/2, from N_top = m (2 g (h − 2R)/R − g) ≥ 0 */
    function minimumHeight(loop_radius) {
        return MINIMUM_HEIGHT_RATIO * loop_radius;
    }

    /* topSpeed: v_s = sqrt(2 g (h − 2R)), null when the top is out of reach */
    function topSpeed(gravity, start_height, loop_radius) {
        return start_height < 2 * loop_radius ? null : Math.sqrt(2 * gravity * (start_height - 2 * loop_radius));
    }

    /* topNormalPerMass: N_s/m = 2 g (h − 2R)/R − g at the top of the loop */
    function topNormalPerMass(gravity, start_height, loop_radius) {
        return 2 * gravity * (start_height - 2 * loop_radius) / loop_radius - gravity;
    }

    /* takeoffAngle: angle θ_d from the bottom where N = 0, cos(θ_d) = 2 (R − h)/(3 R);
       null unless R < h < 5R/2 (below R the wagon stops with N > 0, above 5R/2 it loops) */
    function takeoffAngle(start_height, loop_radius) {
        if (start_height <= loop_radius || start_height >= minimumHeight(loop_radius)) {
            return null;
        }
        return Math.acos(2 * (loop_radius - start_height) / (3 * loop_radius));
    }

    /* stopAngle: angle θ from the bottom where v = 0 for h ≤ R, cos(θ) = 1 − h/R */
    function stopAngle(start_height, loop_radius) {
        return start_height > loop_radius ? null : Math.acos(1 - Math.max(start_height, 0) / loop_radius);
    }

    /* energies: kinetic E_c = m v²/2, potential E_p = m g y (floor reference), mechanical E_m */
    function energies(mass, gravity, state) {
        const kinetic = mass * state.speed * state.speed / 2;
        const potential = mass * gravity * state.y;
        return { kinetic, potential, mechanical: kinetic + potential };
    }

    /* loopAngle: angle θ travelled from the bottom of the loop, null off the loop */
    function loopAngle(track, s) {
        return s >= track.loop_start && s <= track.loop_end ? (s - track.loop_start) / track.loop_radius : null;
    }

    /* railState: sample on the rail; speed from energy, direction from the RK4 velocity */
    function railState(track, gravity, time, s, velocity) {
        const point = pointAt(track, s);
        const speed = speedFromEnergy(gravity, track.start_height, point.y);
        const direction = velocity < 0 ? -1 : 1;
        return {
            time,
            phase: "rail",
            segment: point.segment,
            s,
            loop_angle: loopAngle(track, s),
            x: point.x,
            y: point.y,
            phi: point.phi,
            kappa: point.kappa,
            speed,
            velocity_x: direction * speed * Math.cos(point.phi),
            velocity_y: direction * speed * Math.sin(point.phi),
            normal_per_mass: speed * speed * point.kappa + gravity * Math.cos(point.phi),
            a_theta: -gravity * Math.sin(point.phi),
            a_r: -speed * speed * point.kappa,
        };
    }

    /* flightState: free fall (MRUA) from the take-off point, tau = t − t_takeoff;
       phi is the velocity direction, a_r the normal component of g */
    function flightState(gravity, takeoff, time) {
        const tau = time - takeoff.time;
        const velocity_x = takeoff.velocity_x;
        const velocity_y = takeoff.velocity_y - gravity * tau;
        const phi = Math.atan2(velocity_y, velocity_x);
        return {
            time,
            phase: "flight",
            segment: "flight",
            s: takeoff.s,
            loop_angle: null,
            x: takeoff.x + velocity_x * tau,
            y: takeoff.y + takeoff.velocity_y * tau - gravity * tau * tau / 2,
            phi: phi < 0 ? phi + 2 * Math.PI : phi,
            kappa: 0,
            speed: Math.hypot(velocity_x, velocity_y),
            velocity_x,
            velocity_y,
            normal_per_mass: 0,
            a_theta: -gravity * Math.sin(phi),
            a_r: -gravity * Math.abs(Math.cos(phi)),
        };
    }

    /* tangentialAcceleration: s'' = −g sin(phi(s)), phi extended beyond the rail ends */
    function tangentialAcceleration(track, gravity, s) {
        return -gravity * Math.sin(pointAt(track, s).phi);
    }

    /* stepRk4: one RK4 step of the state (s, s') */
    function stepRk4(track, gravity, s, velocity, dt) {
        const k1_s = velocity;
        const k1_v = tangentialAcceleration(track, gravity, s);
        const k2_s = velocity + k1_v * dt / 2;
        const k2_v = tangentialAcceleration(track, gravity, s + k1_s * dt / 2);
        const k3_s = velocity + k2_v * dt / 2;
        const k3_v = tangentialAcceleration(track, gravity, s + k2_s * dt / 2);
        const k4_s = velocity + k3_v * dt;
        const k4_v = tangentialAcceleration(track, gravity, s + k3_s * dt);
        return {
            s: s + dt / 6 * (k1_s + 2 * k2_s + 2 * k3_s + k4_s),
            velocity: velocity + dt / 6 * (k1_v + 2 * k2_v + 2 * k3_v + k4_v),
        };
    }

    /* isLeavingRail: N(s) < 0 — only possible on the loop where cos(phi) < 0 */
    function isLeavingRail(track, gravity, s) {
        if (s <= track.loop_start || s >= track.loop_end) {
            return false;
        }
        const point = pointAt(track, s);
        return Math.cos(point.phi) < 0 && normalPerMass(gravity, track.start_height, point) < -LEAVING_TOLERANCE * gravity;
    }

    /* findTakeoff: bisection on s of N(s) = 0 between a point where N ≥ 0 and one
       where N < 0 (N depends on s only, through energy conservation) */
    function findTakeoff(track, gravity, s_before, s_after) {
        let low = s_before;
        let high = s_after;
        for (let i = 0; i < 60; i++) {
            const middle = (low + high) / 2;
            if (normalPerMass(gravity, track.start_height, pointAt(track, middle)) >= 0) {
                low = middle;
            } else {
                high = middle;
            }
        }
        return (low + high) / 2;
    }

    /* impactTime: first tau > 0 at which the parabola from the take-off point, which
       starts inside the circle (its curvature g |cos(phi)|/v² equals 1/R there and
       grows), reaches the circle again: scan of |p(tau) − c|² − R², then bisection */
    function impactTime(track, gravity, takeoff) {
        const radius = track.loop_radius;
        const outside = (tau) => {
            const x = takeoff.x + takeoff.velocity_x * tau;
            const y = takeoff.y + takeoff.velocity_y * tau - gravity * tau * tau / 2;
            return x * x + (y - radius) * (y - radius) - radius * radius;
        };
        const time_scale = Math.sqrt(radius / gravity);
        const step = time_scale / IMPACT_SCAN_STEPS_PER_TIME_SCALE;
        const steps = IMPACT_SCAN_STEPS_PER_TIME_SCALE * IMPACT_SCAN_TIME_SCALES;
        for (let i = 2; i <= steps; i++) {
            if (outside(i * step) >= 0) {
                let low = (i - 1) * step;
                let high = i * step;
                for (let k = 0; k < 60; k++) {
                    const middle = (low + high) / 2;
                    if (outside(middle) >= 0) {
                        high = middle;
                    } else {
                        low = middle;
                    }
                }
                return (low + high) / 2;
            }
        }
        return steps * step;
    }

    /* simulate: trajectory sampled at sample_rate (RK4 with substeps per sample)
       until the end of the rail, the impact after a take-off, the return to the
       release point (h ≤ R) or max_duration; returns { samples, takeoff, impact,
       end_reason ("end" | "impact" | "back" | "rest" | "timeout"), duration } */
    function simulate(track, gravity, sample_rate, substeps, max_duration) {
        const dt = 1 / (sample_rate * substeps);
        const total_samples = Math.round(max_duration * sample_rate);
        const samples = [railState(track, gravity, 0, track.start_s, 0)];
        if (track.start_height <= 0) {
            return { samples, takeoff: null, impact: null, end_reason: "rest", duration: 0 };
        }
        let s = track.start_s;
        let velocity = 0;
        let takeoff = null;
        let impact = null;
        let end_reason = "timeout";

        integration: for (let i = 1; i <= total_samples; i++) {
            for (let k = 1; k <= substeps; k++) {
                const previous_s = s;
                const previous_velocity = velocity;
                const previous_time = ((i - 1) * substeps + k - 1) * dt;
                const next = stepRk4(track, gravity, s, velocity, dt);
                s = next.s;
                velocity = next.velocity;
                if (s >= track.length) {
                    const end_time = previous_time + dt * (track.length - previous_s) / (s - previous_s);
                    samples.push(railState(track, gravity, end_time, track.length, velocity));
                    end_reason = "end";
                    break integration;
                }
                if (previous_velocity < 0 && velocity >= 0) {
                    const back_time = previous_time + dt * -previous_velocity / (velocity - previous_velocity);
                    samples.push(railState(track, gravity, back_time, s, 0));
                    end_reason = "back";
                    break integration;
                }
                if (isLeavingRail(track, gravity, s)) {
                    const takeoff_s = findTakeoff(track, gravity, previous_s, s);
                    const takeoff_time = previous_time + dt * (takeoff_s - previous_s) / (s - previous_s);
                    takeoff = railState(track, gravity, takeoff_time, takeoff_s, velocity);
                    samples.push(takeoff);
                    break integration;
                }
            }
            samples.push(railState(track, gravity, i / sample_rate, s, velocity));
        }

        if (takeoff !== null) {
            const impact_time = Math.min(takeoff.time + impactTime(track, gravity, takeoff), max_duration);
            for (let j = Math.floor(takeoff.time * sample_rate) + 1; j / sample_rate < impact_time; j++) {
                samples.push(flightState(gravity, takeoff, j / sample_rate));
            }
            impact = flightState(gravity, takeoff, impact_time);
            samples.push(impact);
            end_reason = impact_time < max_duration ? "impact" : "timeout";
        }

        return { samples, takeoff, impact, end_reason, duration: samples[samples.length - 1].time };
    }

    /* sampleAt: last trajectory sample at or before the given time (binary search) */
    function sampleAt(trajectory, time) {
        const samples = trajectory.samples;
        let low = 0;
        let high = samples.length - 1;
        if (time >= samples[high].time) {
            return samples[high];
        }
        while (high - low > 1) {
            const middle = (low + high) >> 1;
            if (samples[middle].time <= time) {
                low = middle;
            } else {
                high = middle;
            }
        }
        return samples[low];
    }

    globalThis.loop_wagon_calcul = {
        RAMP_ANGLE,
        RAMP_HEIGHT_RATIO,
        EXIT_LENGTH_RATIO,
        buildTrack,
        pointAt,
        releaseArcLength,
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
    };
})();
