/*
 * calcul.js — Loop-the-loop on a frictionless rail: a point mass released from
 * rest at height h slides down a ramp, along a horizontal run, then through a
 * vertical loop that is either a circle of radius R or a clothoid (Euler spiral,
 * curvature proportional to arc length, r → ∞ at the entry) of the same height
 * H = 2R. The rail is described intrinsically by its inclination phi(s) and its
 * curvature kappa(s) = 1/r as functions of the arc length s; positions come from
 * x' = cos(phi), y' = sin(phi) integrated with Simpson's rule (exact phi), the
 * clothoid having no elementary closed form (Fresnel integrals).
 * Track, in travel order (loop entry at the origin, y measured from the floor):
 *   ramp   circular arc of 60°, radius h/(1 − cos 60°) = 2h, tangent to the floor
 *   run-in straight of length R
 *   loop   circle (kappa = 1/R) or clothoid (kappa = s/A², symmetric, A = 2R/Y₁)
 *   exit   straight of length 3R
 * Dynamics: tangential equation a_theta = s'' = −g sin(phi) integrated with RK4
 * (time evolution only); the speed shown is the exact energy value
 * v = sqrt(2 g (h − y)); normal reaction N = m (v²/r + g cos(phi)), the normal
 * pointing toward the centre of curvature (every curve of this rail turns
 * counterclockwise, kappa ≥ 0). The ball is NOT held on the rail: it leaves it as
 * soon as N would become negative, then flies freely (MRUA parabola) until it
 * meets the rail or the floor again, where the simulation stops (impact not
 * modelled). Loop condition: N ≥ 0 everywhere ⇔ h ≥ y − r cos(phi)/2 at every
 * point, hence h_min = max of that quantity over the loop (5R/2 for the circle).
 * SI units, angles in radians. Classic script (works via file://); exposes
 * globalThis.loop_calcul.
 */
(() => {
    const RAMP_ANGLE = Math.PI / 3;
    const RAMP_LOAD_FACTOR = 3 - 2 * Math.cos(RAMP_ANGLE);
    const RUN_IN_LENGTH_RATIO = 1;
    const EXIT_LENGTH_RATIO = 3;
    const ANGLE_RESOLUTION = 0.0025;
    const STRAIGHT_SAMPLES = 8;
    const IMPACT_EXCLUSION_RATIO = 0.05;
    const MINIMUM_FLIGHT_TIME = 1e-4;
    const CLOTHOID_UNIT_HEIGHT = clothoidUnitHeight();

    /* clothoidUnitHeight: height Y₁ of the half clothoid kappa = s (A = 1) turning
       by pi, Y₁ = ∫₀^√(2π) sin(s²/2) ds (Simpson, 20 000 intervals) */
    function clothoidUnitHeight() {
        const intervals = 20000;
        const length = Math.sqrt(2 * Math.PI);
        const step = length / intervals;
        let sum = 0;
        for (let i = 0; i <= intervals; i++) {
            const s = i * step;
            const weight = i === 0 || i === intervals ? 1 : (i % 2 === 1 ? 4 : 2);
            sum += weight * Math.sin(s * s / 2);
        }
        return sum * step / 3;
    }

    /* clothoidParameter: A such that the clothoid loop is H = 2R high */
    function clothoidParameter(loop_radius) {
        return 2 * loop_radius / CLOTHOID_UNIT_HEIGHT;
    }

    /* phiAt / kappaAt: exact inclination and curvature at a local abscissa u of a
       segment whose curvature varies linearly, kappa(u) = kappa_start + kappa_rate u */
    function phiAt(segment, u) {
        return segment.phi_start + segment.kappa_start * u + 0.5 * segment.kappa_rate * u * u;
    }
    function kappaAt(segment, u) {
        return segment.kappa_start + segment.kappa_rate * u;
    }

    /* sampleSegment: Simpson integration of (cos(phi), sin(phi)) on a uniform grid
       fine enough that phi turns by at most ANGLE_RESOLUTION per step */
    function sampleSegment(segment, start_x, start_y) {
        const turn = Math.abs(segment.kappa_start) * segment.length
            + 0.5 * Math.abs(segment.kappa_rate) * segment.length * segment.length;
        const count = Math.max(STRAIGHT_SAMPLES, Math.ceil(turn / ANGLE_RESOLUTION));
        const step = segment.length / count;
        const xs = [start_x];
        const ys = [start_y];
        for (let i = 0; i < count; i++) {
            const phi_start = phiAt(segment, i * step);
            const phi_middle = phiAt(segment, (i + 0.5) * step);
            const phi_end = phiAt(segment, (i + 1) * step);
            xs.push(xs[i] + step / 6 * (Math.cos(phi_start) + 4 * Math.cos(phi_middle) + Math.cos(phi_end)));
            ys.push(ys[i] + step / 6 * (Math.sin(phi_start) + 4 * Math.sin(phi_middle) + Math.sin(phi_end)));
        }
        return { ...segment, count, step, xs, ys };
    }

    /* loopSegments: the loop as one circle or two symmetric clothoid halves */
    function loopSegments(shape, loop_radius) {
        if (shape === "circle") {
            return [{ name: "loop", length: 2 * Math.PI * loop_radius, phi_start: 0, kappa_start: 1 / loop_radius, kappa_rate: 0 }];
        }
        const parameter = clothoidParameter(loop_radius);
        const half_length = parameter * Math.sqrt(2 * Math.PI);
        const rate = 1 / (parameter * parameter);
        return [
            { name: "loop", length: half_length, phi_start: 0, kappa_start: 0, kappa_rate: rate },
            { name: "loop", length: half_length, phi_start: Math.PI, kappa_start: half_length * rate, kappa_rate: -rate },
        ];
    }

    /* buildTrack: sampled rail for a loop shape ("circle" | "clothoid"), loop
       radius R and release height h, translated so the loop entry is the origin */
    function buildTrack(shape, loop_radius, start_height) {
        const definitions = [];
        if (start_height > 0) {
            const ramp_radius = start_height / (1 - Math.cos(RAMP_ANGLE));
            definitions.push({ name: "ramp", length: ramp_radius * RAMP_ANGLE, phi_start: -RAMP_ANGLE, kappa_start: 1 / ramp_radius, kappa_rate: 0 });
        }
        definitions.push({ name: "run_in", length: RUN_IN_LENGTH_RATIO * loop_radius, phi_start: 0, kappa_start: 0, kappa_rate: 0 });
        definitions.push(...loopSegments(shape, loop_radius));
        definitions.push({ name: "exit", length: EXIT_LENGTH_RATIO * loop_radius, phi_start: 2 * Math.PI, kappa_start: 0, kappa_rate: 0 });

        const segments = [];
        let s_start = 0;
        let x = 0;
        let y = 0;
        for (const definition of definitions) {
            const segment = sampleSegment(definition, x, y);
            segment.s_start = s_start;
            segments.push(segment);
            s_start += segment.length;
            x = segment.xs[segment.count];
            y = segment.ys[segment.count];
        }

        const loop_parts = segments.filter((segment) => segment.name === "loop");
        const entry_x = loop_parts[0].xs[0];
        const entry_y = loop_parts[0].ys[0];
        for (const segment of segments) {
            segment.xs = segment.xs.map((value) => value - entry_x);
            segment.ys = segment.ys.map((value) => value - entry_y);
        }

        const first_half = loop_parts[0];
        const top_index = shape === "circle" ? first_half.count / 2 : first_half.count;
        const top_radius = shape === "circle" ? loop_radius : clothoidParameter(loop_radius) / Math.sqrt(2 * Math.PI);
        const top_x = shape === "circle"
            ? (first_half.xs[Math.floor(top_index)] + first_half.xs[Math.ceil(top_index)]) / 2
            : first_half.xs[top_index];
        const last_loop = loop_parts[loop_parts.length - 1];
        return {
            shape,
            loop_radius,
            start_height,
            segments,
            length: s_start,
            loop_start: first_half.s_start,
            loop_end: last_loop.s_start + last_loop.length,
            loop_height: 2 * loop_radius,
            top_radius,
            top_x,
        };
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

    /* pointAt: position, inclination phi and curvature kappa at arc length s;
       beyond either end the rail is extended along its end tangent */
    function pointAt(track, s) {
        if (s <= 0 || s >= track.length) {
            const segment = s <= 0 ? track.segments[0] : track.segments[track.segments.length - 1];
            const index = s <= 0 ? 0 : segment.count;
            const phi = phiAt(segment, s <= 0 ? 0 : segment.length);
            const overshoot = s <= 0 ? s : s - track.length;
            return {
                s,
                x: segment.xs[index] + overshoot * Math.cos(phi),
                y: segment.ys[index] + overshoot * Math.sin(phi),
                phi,
                kappa: 0,
            };
        }
        const segment = findSegment(track, s);
        const u = s - segment.s_start;
        const index = Math.min(Math.floor(u / segment.step), segment.count - 1);
        const grid_u = index * segment.step;
        const remainder = u - grid_u;
        const phi_start = phiAt(segment, grid_u);
        const phi_middle = phiAt(segment, grid_u + remainder / 2);
        const phi_end = phiAt(segment, u);
        return {
            s,
            x: segment.xs[index] + remainder / 6 * (Math.cos(phi_start) + 4 * Math.cos(phi_middle) + Math.cos(phi_end)),
            y: segment.ys[index] + remainder / 6 * (Math.sin(phi_start) + 4 * Math.sin(phi_middle) + Math.sin(phi_end)),
            phi: phi_end,
            kappa: kappaAt(segment, u),
        };
    }

    /* trackSamples: every grid point of the rail in travel order (shared segment
       ends listed once), with s, x, y, phi, kappa; computed once per track */
    function trackSamples(track) {
        if (track.samples === undefined) {
            track.samples = [];
            track.segments.forEach((segment, segment_index) => {
                for (let i = segment_index === 0 ? 0 : 1; i <= segment.count; i++) {
                    const u = i * segment.step;
                    track.samples.push({ s: segment.s_start + u, x: segment.xs[i], y: segment.ys[i], phi: phiAt(segment, u), kappa: kappaAt(segment, u) });
                }
            });
        }
        return track.samples;
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

    /* loopSamples: grid points of the loop only */
    function loopSamples(track) {
        return trackSamples(track).filter((point) => point.s >= track.loop_start && point.s <= track.loop_end);
    }

    /* maximumOverLoop: largest value(point) over the loop (null values skipped):
       grid scan, then ternary search between the neighbouring grid points */
    function maximumOverLoop(track, value) {
        const samples = loopSamples(track);
        let best_index = -1;
        let best_value = -Infinity;
        samples.forEach((point, index) => {
            const candidate = value(point);
            if (candidate !== null && candidate > best_value) {
                best_value = candidate;
                best_index = index;
            }
        });
        if (best_index < 0) {
            return null;
        }
        const refined = (s) => {
            const candidate = value(pointAt(track, s));
            return candidate === null ? -Infinity : candidate;
        };
        let low = samples[Math.max(best_index - 1, 0)].s;
        let high = samples[Math.min(best_index + 1, samples.length - 1)].s;
        for (let i = 0; i < 80; i++) {
            const left = low + (high - low) / 3;
            const right = high - (high - low) / 3;
            if (refined(left) < refined(right)) {
                low = left;
            } else {
                high = right;
            }
        }
        const point = pointAt(track, (low + high) / 2);
        const refined_value = refined(point.s);
        return refined_value >= best_value ? { value: refined_value, point } : { value: best_value, point: samples[best_index] };
    }

    /* minimumHeight: smallest release height keeping N ≥ 0 on the whole loop,
       h_min = max over the loop of y − r cos(phi)/2 (only points with cos(phi) < 0
       constrain h); returns the height and the critical point */
    function minimumHeight(track) {
        const best = maximumOverLoop(track, (point) => (point.kappa > 0 && Math.cos(point.phi) < 0
            ? point.y - Math.cos(point.phi) / (2 * point.kappa)
            : null));
        if (best === null) {
            return null;
        }
        const point = best.point;
        return { height: best.value, x: point.x, y: point.y, phi: point.phi, radius: 1 / point.kappa, s: point.s };
    }

    /* maxHeightForLoad: largest release height keeping N/(m g) ≤ load_factor on
       the whole rail, min over the loop of y + r (load_factor − cos(phi))/2; the
       ramp bottom always carries 3 − 2 cos(60°) = 2 g, the straights 1 g, so no
       positive height works below that */
    function maxHeightForLoad(track, load_factor) {
        if (load_factor < RAMP_LOAD_FACTOR) {
            return 0;
        }
        const best = maximumOverLoop(track, (point) => (point.kappa > 0
            ? -(point.y + (load_factor - Math.cos(point.phi)) / (2 * point.kappa))
            : null));
        return -best.value;
    }

    /* railState: sample on the rail; speed from energy, direction from the RK4 velocity */
    function railState(track, gravity, time, s, velocity) {
        const point = pointAt(track, s);
        const speed = speedFromEnergy(gravity, track.start_height, point.y);
        const direction = velocity < 0 ? -1 : 1;
        return {
            time,
            phase: "rail",
            s,
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
            s: takeoff.s,
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
        const clamped = Math.min(Math.max(s, 0), track.length);
        const segment = findSegment(track, clamped);
        return -gravity * Math.sin(phiAt(segment, clamped - segment.s_start));
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

    /* isLeavingRail: N(s) < 0 — only possible on a curve where cos(phi) < 0 */
    function isLeavingRail(track, gravity, s) {
        if (s <= 0 || s >= track.length) {
            return false;
        }
        const segment = findSegment(track, s);
        const phi = phiAt(segment, s - segment.s_start);
        if (Math.cos(phi) >= 0) {
            return false;
        }
        return normalPerMass(gravity, track.start_height, pointAt(track, s)) < 0;
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

    /* impactTime: first time tau > 0 at which the parabola from the take-off point
       crosses the rail polyline (rail points closer than 5% of R along the rail are
       ignored: the parabola leaves the rail tangentially) or the floor y = 0 */
    function impactTime(track, gravity, takeoff) {
        const exclusion = IMPACT_EXCLUSION_RATIO * track.loop_radius;
        let best = (takeoff.velocity_y + Math.sqrt(takeoff.velocity_y ** 2 + 2 * gravity * Math.max(takeoff.y, 0))) / gravity;
        for (const segment of track.segments) {
            for (let i = 0; i < segment.count; i++) {
                const s_middle = segment.s_start + (i + 0.5) * segment.step;
                if (Math.abs(s_middle - takeoff.s) < exclusion) {
                    continue;
                }
                const start_x = segment.xs[i];
                const start_y = segment.ys[i];
                const delta_x = segment.xs[i + 1] - start_x;
                const delta_y = segment.ys[i + 1] - start_y;
                const normal_x = -delta_y;
                const normal_y = delta_x;
                const a = -normal_y * gravity / 2;
                const b = normal_x * takeoff.velocity_x + normal_y * takeoff.velocity_y;
                const c = normal_x * (takeoff.x - start_x) + normal_y * (takeoff.y - start_y);
                const roots = [];
                if (Math.abs(a) < 1e-14) {
                    if (Math.abs(b) > 1e-14) {
                        roots.push(-c / b);
                    }
                } else {
                    const discriminant = b * b - 4 * a * c;
                    if (discriminant >= 0) {
                        const root = Math.sqrt(discriminant);
                        roots.push((-b - root) / (2 * a), (-b + root) / (2 * a));
                    }
                }
                for (const tau of roots) {
                    if (tau <= MINIMUM_FLIGHT_TIME || tau >= best) {
                        continue;
                    }
                    const hit_x = takeoff.x + takeoff.velocity_x * tau;
                    const hit_y = takeoff.y + takeoff.velocity_y * tau - gravity * tau * tau / 2;
                    const along = ((hit_x - start_x) * delta_x + (hit_y - start_y) * delta_y) / (delta_x * delta_x + delta_y * delta_y);
                    if (along >= 0 && along <= 1) {
                        best = tau;
                    }
                }
            }
        }
        return best;
    }

    /* simulate: trajectory sampled at sample_rate (RK4 with substeps per sample)
       until the end of the rail, the impact after a take-off, or max_duration;
       returns { samples, takeoff, impact, end_reason ("end" | "impact" | "timeout"),
       duration } — samples are time-ordered, see sampleAt */
    function simulate(track, gravity, sample_rate, substeps, max_duration) {
        const dt = 1 / (sample_rate * substeps);
        const total_samples = Math.round(max_duration * sample_rate);
        const samples = [railState(track, gravity, 0, 0, 0)];
        let s = 0;
        let velocity = 0;
        let takeoff = null;
        let impact = null;
        let end_reason = "timeout";

        integration: for (let i = 1; i <= total_samples; i++) {
            for (let k = 1; k <= substeps; k++) {
                const previous_s = s;
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
            const flight_duration = impactTime(track, gravity, takeoff);
            const impact_time = Math.min(takeoff.time + flight_duration, max_duration);
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

    globalThis.loop_calcul = {
        RAMP_ANGLE,
        RAMP_LOAD_FACTOR,
        CLOTHOID_UNIT_HEIGHT,
        clothoidParameter,
        buildTrack,
        pointAt,
        trackSamples,
        speedFromEnergy,
        normalPerMass,
        minimumHeight,
        maxHeightForLoad,
        simulate,
        sampleAt,
    };
})();
