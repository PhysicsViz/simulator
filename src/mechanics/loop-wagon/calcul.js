/*
 * calcul.js — Classic loop-the-loop with a roller-coaster wagon: the wagon,
 * modelled as a point mass m, is released from rest at height h on a
 * frictionless rail, runs down a fixed ramp, along a horizontal run-in, through
 * a vertical loop of height H = 2R — a circle of radius R or a clothoid (Euler
 * spiral: curvature proportional to the arc length, r → ∞ at the entry, the
 * smallest radius r_s = A/√(2π) at the top) — then along an exit straight.
 * Every length of the rail is proportional to R, so the picture only scales;
 * the loop is centred on x = 0 (half width w = R for the circle, A X₁ for the
 * clothoid):
 *   incline  straight at 60° from height 3R (the top of the ramp, h ≤ 3R)
 *   fillet   circular arc of radius R turning from −60° to 0°, tangent to the floor
 *   run_in   straight of length R ending at the loop entry (x = 0 for the circle,
 *            −A X₁ for the clothoid)
 *   loop     circle of radius R, centre (0, R), inclination phi from 0 to 2π;
 *            or two symmetric clothoid halves, kappa = u/A² up to the top
 *            (phi = π), then decreasing back to 0 at the exit (phi = 2π), with
 *            A = 2R/Y₁ so that the top is at 2R (Y₁ = ∫₀^√(2π) sin(u²/2) du,
 *            X₁ = ∫₀^√(2π) cos(u²/2) du, Fresnel integrals)
 *   exit     straight ending at x = w + 2.1R
 * Geometry: straights and arcs in closed form; the clothoid has no elementary
 * closed form, its points come from x' = cos(phi), y' = sin(phi) integrated with
 * Simpson's rule on a grid turning by at most 0.0025 rad per step (phi(s) and
 * kappa(s) themselves are exact). Dynamics: tangential equation s'' = −g sin(phi)
 * integrated with RK4 (time evolution only); the speed shown is the exact energy
 * value v = sqrt(2 g (h − y)); normal reaction N = m (v²/r + g cos(phi)), the
 * normal pointing toward the centre of curvature. The wagon is NOT held on the
 * rail (no upstop wheels): it leaves it as soon as N would become negative —
 * on the circle cos(θ_d) = 2 (R − h)/(3 R), for R < h < 5R/2 — then flies freely
 * (MRUA parabola) until it meets the loop again, where the simulation stops
 * (impact not modelled). Loop condition: N ≥ 0 everywhere ⇔ h ≥ y − r cos(phi)/2
 * at every point of the loop, so h_min = 5R/2 for the circle and the maximum of
 * that quantity over the loop for the clothoid (found numerically). In the loop,
 * the angle travelled from the bottom equals the inclination phi (θ on the
 * circle). When the wagon cannot reach the vertical part (h ≤ R on the circle)
 * it climbs to y = h, rolls back and the run ends when it is back at its
 * release point.
 * SI units, angles in radians. Classic script (works via file://); exposes
 * globalThis.loop_wagon_calcul.
 */
(() => {
    const RAMP_ANGLE = Math.PI / 3;
    const RAMP_HEIGHT_RATIO = 3;
    const FILLET_RADIUS_RATIO = 1;
    const RUN_IN_LENGTH_RATIO = 1;
    const MINIMUM_HEIGHT_RATIO = 2.5;
    const LEAVING_TOLERANCE = 1e-9;
    const IMPACT_SCAN_STEPS_PER_TIME_SCALE = 400;
    const IMPACT_SCAN_TIME_SCALES = 12;
    const EXIT_END_RATIO = 2.1;
    const ANGLE_RESOLUTION = 0.0025;
    const FRESNEL_INTERVALS = 20000;
    const IMPACT_EXCLUSION_RATIO = 0.05;
    const MINIMUM_FLIGHT_TIME = 1e-4;
    const UNIT_CLOTHOID = unitClothoid();

    /* unitClothoid: end point (X₁, Y₁) of the half clothoid kappa = u (A = 1)
       turning by π, X₁ = ∫₀^√(2π) cos(u²/2) du, Y₁ = ∫₀^√(2π) sin(u²/2) du
       (Simpson, 20 000 intervals) */
    function unitClothoid() {
        const length = Math.sqrt(2 * Math.PI);
        const step = length / FRESNEL_INTERVALS;
        let sum_x = 0;
        let sum_y = 0;
        for (let i = 0; i <= FRESNEL_INTERVALS; i++) {
            const u = i * step;
            const weight = i === 0 || i === FRESNEL_INTERVALS ? 1 : (i % 2 === 1 ? 4 : 2);
            sum_x += weight * Math.cos(u * u / 2);
            sum_y += weight * Math.sin(u * u / 2);
        }
        return { x: sum_x * step / 3, y: sum_y * step / 3 };
    }

    /* clothoidParameter: A such that the clothoid loop is H = 2R high, A = 2R/Y₁ */
    function clothoidParameter(loop_radius) {
        return 2 * loop_radius / UNIT_CLOTHOID.y;
    }

    /* loopGeometry: half width w, top radius r_s and the loop segments of a shape */
    function loopGeometry(shape, loop_radius) {
        if (shape === "circle") {
            return {
                half_width: loop_radius,
                top_radius: loop_radius,
                definitions: [{ name: "loop", length: 2 * Math.PI * loop_radius, phi_start: 0, kappa: 1 / loop_radius, kappa_rate: 0 }],
            };
        }
        const parameter = clothoidParameter(loop_radius);
        const half_length = parameter * Math.sqrt(2 * Math.PI);
        const rate = 1 / (parameter * parameter);
        return {
            half_width: parameter * UNIT_CLOTHOID.x,
            top_radius: parameter / Math.sqrt(2 * Math.PI),
            definitions: [
                { name: "loop", length: half_length, phi_start: 0, kappa: 0, kappa_rate: rate },
                { name: "loop", length: half_length, phi_start: Math.PI, kappa: half_length * rate, kappa_rate: -rate },
            ],
        };
    }

    /* phiAt / kappaAt: exact inclination and curvature at the local abscissa u,
       kappa(u) = kappa + kappa_rate u */
    function phiAt(segment, u) {
        return segment.phi_start + segment.kappa * u + 0.5 * segment.kappa_rate * u * u;
    }
    function kappaAt(segment, u) {
        return segment.kappa + segment.kappa_rate * u;
    }

    /* sampleSpiral: Simpson grid of (x, y) along a segment of varying curvature */
    function sampleSpiral(segment) {
        const count = Math.ceil(segment.turn / ANGLE_RESOLUTION);
        const step = segment.length / count;
        const xs = [segment.x_start];
        const ys = [segment.y_start];
        for (let i = 0; i < count; i++) {
            const phi_start = phiAt(segment, i * step);
            const phi_middle = phiAt(segment, (i + 0.5) * step);
            const phi_end = phiAt(segment, (i + 1) * step);
            xs.push(xs[i] + step / 6 * (Math.cos(phi_start) + 4 * Math.cos(phi_middle) + Math.cos(phi_end)));
            ys.push(ys[i] + step / 6 * (Math.sin(phi_start) + 4 * Math.sin(phi_middle) + Math.sin(phi_end)));
        }
        segment.grid = { count, step, xs, ys };
    }

    /* segmentPoint: position, inclination and curvature at the local abscissa u —
       exact for a straight (kappa = 0) or a circular arc (kappa = 1/r), Simpson
       from the nearest grid point for a clothoid segment */
    function segmentPoint(segment, u) {
        const phi = phiAt(segment, u);
        if (segment.kappa_rate !== 0) {
            const grid = segment.grid;
            const index = Math.min(Math.max(Math.floor(u / grid.step), 0), grid.count - 1);
            const grid_u = index * grid.step;
            const remainder = u - grid_u;
            const phi_start = phiAt(segment, grid_u);
            const phi_middle = phiAt(segment, grid_u + remainder / 2);
            return {
                x: grid.xs[index] + remainder / 6 * (Math.cos(phi_start) + 4 * Math.cos(phi_middle) + Math.cos(phi)),
                y: grid.ys[index] + remainder / 6 * (Math.sin(phi_start) + 4 * Math.sin(phi_middle) + Math.sin(phi)),
                phi,
                kappa: kappaAt(segment, u),
            };
        }
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

    /* buildTrack: rail for a loop radius R, release height h (clamped to [0, 3R])
       and loop shape ("circle" | "clothoid"), loop centred on x = 0, y measured
       from the floor; the clothoid also gets its h_min and critical point */
    function buildTrack(loop_radius, start_height, shape = "circle") {
        const fillet_radius = FILLET_RADIUS_RATIO * loop_radius;
        const ramp_height = RAMP_HEIGHT_RATIO * loop_radius;
        const fillet_height = fillet_radius * (1 - Math.cos(RAMP_ANGLE));
        const incline_length = (ramp_height - fillet_height) / Math.sin(RAMP_ANGLE);
        const run_in_length = RUN_IN_LENGTH_RATIO * loop_radius;
        const loop = loopGeometry(shape, loop_radius);
        const entry_x = shape === "circle" ? 0 : -loop.half_width;
        const exit_x = shape === "circle" ? 0 : loop.half_width;
        const definitions = [
            { name: "incline", length: incline_length, phi_start: -RAMP_ANGLE, kappa: 0, kappa_rate: 0 },
            { name: "fillet", length: fillet_radius * RAMP_ANGLE, phi_start: -RAMP_ANGLE, kappa: 1 / fillet_radius, kappa_rate: 0 },
            { name: "run_in", length: run_in_length, phi_start: 0, kappa: 0, kappa_rate: 0 },
            ...loop.definitions,
            { name: "exit", length: loop.half_width + EXIT_END_RATIO * loop_radius - exit_x, phi_start: 2 * Math.PI, kappa: 0, kappa_rate: 0 },
        ];

        const segments = [];
        let s_start = 0;
        let x = entry_x - (run_in_length + fillet_radius * Math.sin(RAMP_ANGLE) + incline_length * Math.cos(RAMP_ANGLE));
        let y = ramp_height;
        for (const definition of definitions) {
            const segment = { ...definition, s_start, x_start: x, y_start: y };
            segment.turn = Math.abs(phiAt(segment, segment.length) - segment.phi_start);
            if (segment.kappa_rate !== 0) {
                sampleSpiral(segment);
            }
            const end = segmentPoint(segment, segment.length);
            segments.push(segment);
            s_start += segment.length;
            const at_loop_entry = definition.name === "run_in";
            const at_loop_exit = definition.name === "loop" && Math.abs(phiAt(segment, segment.length) - 2 * Math.PI) < 1e-12;
            x = at_loop_entry ? entry_x : (at_loop_exit ? exit_x : end.x);
            y = at_loop_entry || at_loop_exit ? 0 : end.y;
        }

        const loop_parts = segments.filter((segment) => segment.name === "loop");
        const last_loop = loop_parts[loop_parts.length - 1];
        const track = {
            shape,
            loop_radius,
            fillet_radius,
            ramp_height,
            start_height: Math.min(Math.max(start_height, 0), ramp_height),
            segments,
            length: s_start,
            loop_start: loop_parts[0].s_start,
            loop_end: last_loop.s_start + last_loop.length,
            loop_height: 2 * loop_radius,
            loop_half_width: loop.half_width,
            top_radius: loop.top_radius,
            ramp_top_x: segments[0].x_start,
        };
        track.start_s = releaseArcLength(track, track.start_height);
        track.loop_extent = shape === "circle" ? loop_radius : loopExtent(loop_parts, loop_radius);
        track.critical = criticalPoint(track);
        track.minimum_height = track.critical.height;
        return track;
    }

    /* loopExtent: largest |x| of the clothoid loop body above y = R/2 (its grid
       points) — below, the two branches cross and run out to the entry and the
       exit at ±A X₁ */
    function loopExtent(loop_parts, loop_radius) {
        let extent = 0;
        for (const segment of loop_parts) {
            for (let i = 0; i <= segment.grid.count; i++) {
                if (segment.grid.ys[i] >= loop_radius / 2) {
                    extent = Math.max(extent, Math.abs(segment.grid.xs[i]));
                }
            }
        }
        return extent;
    }

    /* criticalPoint: point of the loop that sets h_min, the maximum of
       y − r cos(phi)/2 over the loop (only where cos(phi) < 0): the top and
       5R/2 for the circle; for the clothoid, grid scan of the rising half (the
       descending half is its mirror image, and the wagon meets the rising twin
       first; it lies just before the top, not at it) then golden-section
       refinement. Returns { height, s, x, y, phi, radius } */
    function criticalPoint(track) {
        if (track.shape === "circle") {
            const s = track.loop_start + Math.PI * track.loop_radius;
            return { height: minimumHeight(track.loop_radius), s, x: 0, y: 2 * track.loop_radius, phi: Math.PI, radius: track.loop_radius };
        }
        const value = (s) => {
            const point = pointAt(track, s);
            return point.kappa > 0 && Math.cos(point.phi) < 0 ? point.y - Math.cos(point.phi) / (2 * point.kappa) : -Infinity;
        };
        const steps = 1000;
        const step = (track.loop_end - track.loop_start) / 2 / steps;
        let best = track.loop_start;
        for (let i = 1; i < steps; i++) {
            if (value(track.loop_start + i * step) > value(best)) {
                best = track.loop_start + i * step;
            }
        }
        let low = best - step;
        let high = best + step;
        for (let i = 0; i < 100; i++) {
            const left = high - (high - low) / 1.618033988749895;
            const right = low + (high - low) / 1.618033988749895;
            if (value(left) < value(right)) {
                low = left;
            } else {
                high = right;
            }
        }
        const s = (low + high) / 2;
        const point = pointAt(track, s);
        return { height: value(s), s, x: point.x, y: point.y, phi: point.phi, radius: 1 / point.kappa };
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

    /* topNormalPerMass: N_s/m = 2 g (h − 2R)/r_s − g at the top of the loop (height
       2R, radius of curvature r_s: R for the circle) */
    function topNormalPerMass(gravity, start_height, loop_radius, top_radius = loop_radius) {
        return 2 * gravity * (start_height - 2 * loop_radius) / top_radius - gravity;
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

    /* loopAngle: angle travelled from the bottom of the loop, the inclination
       phi (θ = (s − s_entry)/R on the circle), null off the loop */
    function loopAngle(track, s) {
        return s >= track.loop_start && s <= track.loop_end ? pointAt(track, s).phi : null;
    }

    /* heightAngle: loop angle at which the rising half of the loop reaches the
       height y (bisection, y increases with s up to the top); null above 2R */
    function heightAngle(track, height) {
        if (height > track.loop_height || height < 0) {
            return null;
        }
        let low = track.loop_start;
        let high = (track.loop_start + track.loop_end) / 2;
        for (let i = 0; i < 80; i++) {
            const middle = (low + high) / 2;
            if (pointAt(track, middle).y < height) {
                low = middle;
            } else {
                high = middle;
            }
        }
        return pointAt(track, (low + high) / 2).phi;
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

    /* impactTime: first tau > 0 at which the parabola from the take-off point
       meets the loop again — the circle: scan of |p(tau) − c|² − R², then
       bisection (the parabola starts inside, its curvature g |cos(phi)|/v²
       equals 1/R there and grows); the clothoid: crossing of the grid polyline
       (points closer than 5 % of R along the rail ignored, the parabola leaves
       tangentially) or of the floor */
    function impactTime(track, gravity, takeoff) {
        if (track.shape !== "circle") {
            return polylineImpactTime(track, gravity, takeoff);
        }
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

    /* polylineImpactTime: first crossing of the parabola with the loop grid
       polyline or the floor y = 0 (see impactTime) */
    function polylineImpactTime(track, gravity, takeoff) {
        const exclusion = IMPACT_EXCLUSION_RATIO * track.loop_radius;
        let best = (takeoff.velocity_y + Math.sqrt(takeoff.velocity_y ** 2 + 2 * gravity * Math.max(takeoff.y, 0))) / gravity;
        for (const segment of track.segments.filter((candidate) => candidate.name === "loop")) {
            const grid = segment.grid;
            for (let i = 0; i < grid.count; i++) {
                if (Math.abs(segment.s_start + (i + 0.5) * grid.step - takeoff.s) < exclusion) {
                    continue;
                }
                const start_x = grid.xs[i];
                const start_y = grid.ys[i];
                const delta_x = grid.xs[i + 1] - start_x;
                const delta_y = grid.ys[i + 1] - start_y;
                const a = -delta_x * gravity / 2;
                const b = -delta_y * takeoff.velocity_x + delta_x * takeoff.velocity_y;
                const c = -delta_y * (takeoff.x - start_x) + delta_x * (takeoff.y - start_y);
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
        clothoidParameter,
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
        heightAngle,
        energies,
        simulate,
        sampleAt,
    };
})();
