/*
 * game.js — EXPERIMENTAL "bucket on a rope" game mode for the wagon loop
 * exercise. A light rigid bar (L_b = 0.9 m, 0.3 kg) turns on a frictionless
 * pivot; a flexible rope of length L (0.15–0.6 m) hangs from its tip and carries
 * an open bucket (centre of mass d = 0.19 m below the handle, total mass m with
 * its water) holding water drops (10 by default). Every force on the bucket comes
 * through the bar and the rope: at t = 0 everything hangs at rest, then a motor
 * at the pivot drives the bar — a few back-and-forth swings at the pendulum's
 * own rhythm until the swing reaches about 70°, then, from a backswing, a throw
 * that pulls the bucket forward along a planned energy curve reaching ½ v₀²
 * (energy per unit mass from the lowest point) at +90°; as soon as the bucket's
 * energy reaches ½ v₀² (with what the alignment is expected to add; at the
 * latest at +150°) the motor brings the bar back in line with the bucket and
 * accompanies it until bar, rope and bucket are aligned (bend < 3°, at most
 * 0.6 s, so the release may come after the top), then lets go: from there the
 * bar turns freely. The bucket then passes the lowest point a little faster than
 * v₀ (+3 to +10 %: the alignment still adds energy and the bar and rope hand
 * theirs over), so the measured success threshold lies at 0.92–0.98 √(5 g R)
 * and the tension up to ≈ 25 % above m (v₀²/R + g). The motor never pushes the bucket itself: it sets the bar's lead
 * δ over the bucket so that the rope, pulling from the bar's tip, makes the
 * angle ψ with the bucket's inward radial that gives the wanted tangential pull
 * (triangle pivot–tip–bucket: L_b sin(δ + ψ) = r sin(ψ), so sin(ψ) ≤ L_b/r: a
 * bar long next to the rope, like an arm with a short rope, is what makes the
 * throw possible). For a very small v₀ (½ v₀² ≤ 1.2 g R) the motor lets go at
 * the lowest point instead.
 * It is the wagon's
 * loop with a rope instead of a rail (R = L_b + L + d): the water stays in iff
 * the rope stays taut at the top, T_s = m (v₀²/R − 5 g) ≥ 0 ⇔ v₀² ≥ 5 g R (the
 * counterpart of h ≥ 5R/2), and the rope snaps iff its tension exceeds T_max,
 * at the bottom T = m (v₀²/R + g) ≤ T_max. The student sets the ONE free
 * variable of each challenge (v₀, L or m — the bucket must then be filled to at
 * least 90 % of the largest mass the rope holds) so that the bucket makes 2 full
 * turns without losing a drop; result: "réussi" / "raté".
 * Simulation (pure, deterministic, also used by the solvability checker):
 * extended position-based dynamics with small steps (at least 1200 substeps/s
 * during the gentle swings and 2400 from the throw on, both fast enough for the
 * transverse waves of the rope, 1.3 √(T/μ)/ℓ; zero compliance). One chain of point masses: fixed pivot → bar tip (bilateral link,
 * effective mass m_bar/3 = I/L_b², weight m_bar g/2 so that the torque of the
 * weight is right) → 10 rope links (one-sided: a link may
 * shorten, never stretch, so the rope bends and goes slack but never pushes) →
 * handle → bucket centre of mass (bilateral link: the bucket is a rigid body
 * hinged at its handle). All links are projected at once by a direct solve of
 * the tridiagonal system of their Lagrange multipliers (Thomas algorithm, active
 * set for the one-sided links); the rope tension is T = −λ/Δt² of its most
 * loaded link (the bar end for a heavy rope), low-pass filtered over 20 ms;
 * the position projection damps the motion slightly (2 to 8 % of the energy
 * over two turns at 2400 Hz). Water = 10 disc particles under gravity,
 * kept in the moving bucket by projection on its bottom and side walls and
 * separated from each other by non-overlap constraints, with a viscous drag
 * (rate 8 s⁻¹) of their velocity relative to the bucket wall; a drop whose centre
 * crosses the rim plane is lost. The two joints of the free chain — handle
 * hinge (bucket / rope) and bar tip (bar / rope) — have a little friction, an
 * internal torque pair (momentum conserved, energy only removed) that makes
 * their relative rotation decay at 8 s⁻¹: it damps the bending wobble left by
 * the throw without slowing the common rotation. The bucket is a point mass at
 * d below the handle (no moment of inertia about its centre of mass). The drops do not act back on the bucket (their
 * mass is included in m; more drops are smaller, the water volume stays the
 * same). Air resistance and pivot friction are neglected.
 * Every challenge is provably solvable: constructive generation around a
 * reference solution, then the pure checker isChallengeFeasible replays the full
 * simulation, wind-up included (the pumping does not depend on v₀: it is
 * simulated once per setup and cloned for every probe), at five evenly spaced points of the announced
 * winning window (the ideal window shrunk by 6 % on v₀ at each end, its upper
 * end also allowing for the rope's own load), rejection sampling with a
 * deterministic fallback, Monte-Carlo tests. Milestone tiers as elsewhere.
 * Self-contained: to remove, delete this file, its test file, the GAME MODE
 * blocks in index.html and the lines marked "Game mode hook" in main.js.
 * Integration surface: the "game-mode" body class (set here),
 * globalThis.loop_wagon_game_overlay (called by main.js each frame; returns
 * true when it painted the scene) and globalThis.loop_wagon_game_duration
 * (run length used by main.js for its clock). Pure logic is exposed as
 * globalThis.loop_wagon_game.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const PLACES = [
        { key: "moon", gravity: 1.62 },
        { key: "mars", gravity: 3.71 },
        { key: "venus", gravity: 8.87 },
        { key: "earth", gravity: 9.81 },
    ];
    const VARIABLES = {
        launch_speed: { weight: 4, min: 0, max: 20, step: 0.01, default_value: 5 },
        rope_length: { weight: 3, min: 0.15, max: 0.6, step: 0.01, default_value: 0.4 },
        mass: { weight: 3, min: 0.5, max: 8, step: 0.01, default_value: 2 },
    };
    const VARIABLE_KEYS = Object.keys(VARIABLES);
    const BAR_LENGTH = 0.9;
    const BAR_MASS = 0.3;
    const BAR_WEIGHT_FACTOR = 1.5;
    const PIVOT_HEIGHT = 1.95;
    const ROPE_LINKS = 10;
    const ROPE_LINEAR_DENSITY = 0.15;
    const HANDLE_MASS = 0.01;
    const BUCKET = { rim: 0.06, bottom: 0.26, center_of_mass: 0.19, half_width: 0.1 };
    const DROP_COUNT = 10;
    const DROP_RADIUS = 0.022;
    const WATER_DRAG_RATE = 8;
    const SUBSTEP_RATE = 2400;
    const WINDUP_SUBSTEP_RATE = 1200;
    const FRAME_RATE = 60;
    const TENSION_FILTER_SECONDS = 0.02;
    const WIN_TURNS = 2;
    const POST_EVENT_SECONDS = 1.6;
    const MAX_RUN_SECONDS = 30;
    const WINDOW_MARGIN = 0.06;
    const TENSION_SHARE = 0.8;
    const MINIMUM_RELATIVE_WINDOW = 0.05;
    const MASS_FILL_RATIO = 0.9;
    const FALLBACK_CHALLENGES = [
        { variable: "launch_speed", place: "earth", gravity: 9.81, launch_speed: null, rope_length: 0.4, mass: 2, tension_max: 210 },
        { variable: "launch_speed", place: "mars", gravity: 3.71, launch_speed: null, rope_length: 0.5, mass: 3, tension_max: 150 },
    ];
    const PIVOT = 0;
    const TIP = 1;
    const HANDLE = ROPE_LINKS + 1;
    const CENTER = ROPE_LINKS + 2;
    const LAST_ROPE_LINK = ROPE_LINKS;
    const FIRST_ROPE_LINK = 1;
    const SLACK_TOLERANCE = 1e-6;
    const SINGULAR_TOLERANCE = 1e-9;
    const PUMP_AMPLITUDE = 70 * Math.PI / 180;
    const PUMP_FRACTION = 0.6;
    const KICK_TIME_SCALES = 1.3;
    const MAX_PULL_TANGENT = 0.35;
    const PULL_SAFETY = 0.85;
    const ENERGY_GAIN = 1;
    const RELEASE_ANGLE = Math.PI / 2;
    const BOTTOM_RELEASE_RATIO = 1.2;
    const BAR_STIFFNESS = 400;
    const LEAD_SMOOTHING_TIME_SCALES = 0.3;
    const THROW_SMOOTHING_TIME_SCALES = 0.1;
    const LATEST_RELEASE_ANGLE = 150 * Math.PI / 180;
    const HINGE_DAMPING_RATE = 8;
    const ALIGNED_LEAD = 2 * Math.PI / 180;
    const ALIGN_SECONDS = 0.12;
    const ALIGNED_WOBBLE = 3 * Math.PI / 180;
    const MAX_ALIGN_SECONDS = 0.6;
    const MAX_DRIVE_SECONDS = 40;
    const PUMP_CACHE_SIZE = 64;
    const PUMP_CACHE = new Map();

    /* bucketRadius: R = L_b + L + d, pivot → bucket centre of mass, rope straight and radial */
    function bucketRadius(rope_length) {
        return BAR_LENGTH + rope_length + BUCKET.center_of_mass;
    }

    /* tensionPerMass: T/m = v²/R + g cos(θ) = v₀²/R + g (3 cos(θ) − 2), θ from the
       lowest point, energy v² = v₀² − 2 g R (1 − cos(θ)) (massless rope and bar) */
    function tensionPerMass(gravity, radius, launch_speed, theta) {
        return launch_speed * launch_speed / radius + gravity * (3 * Math.cos(theta) - 2);
    }

    /* idealWindow: v₀ interval of the massless-rope pendulum, T ≥ 0 at the top
       (v₀ ≥ √(5 g R)) and T ≤ T_max at the bottom (v₀ ≤ √((T_max/m − g) R)) */
    function idealWindow(gravity, rope_length, mass, tension_max) {
        const radius = bucketRadius(rope_length);
        return {
            minimum: Math.sqrt(5 * gravity * radius),
            maximum: Math.sqrt(Math.max(tension_max / mass - gravity, 0) * radius),
        };
    }

    /* resolveParameters: v₀, L and m of a challenge with the free variable set to value */
    function resolveParameters(challenge, value) {
        return {
            launch_speed: challenge.variable === "launch_speed" ? value : challenge.launch_speed,
            rope_length: challenge.variable === "rope_length" ? value : challenge.rope_length,
            mass: challenge.variable === "mass" ? value : challenge.mass,
        };
    }

    /* winningWindow: values of the free variable announced as winning, from the
       ideal conditions with v₀ kept 6 % above the water limit (q = 1.06) and
       the tension, rope load included, below 0.8 T_max (the simulated tension
       exceeds the ideal one, see the top of the file):
       v₀: q √(5 g R) ≤ v₀ ≤ √((0.8 T_max − (m + μL) g) / (m/R + μL r_mid/R²))
       L:  R = L_b + L + d between the shortest rope that holds and the longest
           that keeps the water (v₀² ≥ 5 g R q²)
       m:  0.9 m_max ≤ m ≤ m_max, the heaviest bucket the rope holds (fill the
           bucket; needs v₀ ≥ q √(5 g R)) */
    function winningWindow(challenge) {
        const gravity = challenge.gravity;
        const low = (1 + WINDOW_MARGIN) ** 2;
        const allowed = TENSION_SHARE * challenge.tension_max;
        const empty = { minimum: Infinity, maximum: -Infinity };
        if (challenge.variable === "launch_speed") {
            const radius = bucketRadius(challenge.rope_length);
            const rope_mass = ROPE_LINEAR_DENSITY * challenge.rope_length;
            const middle = BAR_LENGTH + challenge.rope_length / 2;
            const room = allowed - (challenge.mass + rope_mass) * gravity;
            return {
                minimum: Math.sqrt(5 * gravity * radius * low),
                maximum: room > 0 ? Math.sqrt(room / (challenge.mass / radius + rope_mass * middle / (radius * radius))) : -Infinity,
            };
        }
        const speed_squared = challenge.launch_speed * challenge.launch_speed;
        if (challenge.variable === "rope_length") {
            const shortest = shortestRope(challenge, allowed);
            const longest = speed_squared / (5 * gravity * low) - BAR_LENGTH - BUCKET.center_of_mass;
            return shortest === null ? empty : { minimum: shortest, maximum: longest };
        }
        const radius = bucketRadius(challenge.rope_length);
        if (speed_squared < 5 * gravity * radius * low) {
            return empty;
        }
        const mass_max = (allowed - ropeLoad(challenge.rope_length, speed_squared, gravity)) / (speed_squared / radius + gravity);
        return mass_max > 0 ? { minimum: MASS_FILL_RATIO * mass_max, maximum: mass_max } : empty;
    }

    /* ropeLoad: share of the bar-end tension due to the rope itself at the bottom,
       μ L (ω² r_milieu + g), ω = v₀/R, r_milieu = L_b + L/2 (rigid rotation) */
    function ropeLoad(rope_length, speed_squared, gravity) {
        const radius = bucketRadius(rope_length);
        return ROPE_LINEAR_DENSITY * rope_length * (speed_squared / (radius * radius) * (BAR_LENGTH + rope_length / 2) + gravity);
    }

    /* shortestRope: smallest L whose bottom tension m (v₀²/R + g) + μ L (ω² r_milieu + g)
       stays within the allowed tension (bisection, the tension decreases with L
       over the input range); null if even the longest rope is too loaded */
    function shortestRope(challenge, allowed) {
        const speed_squared = challenge.launch_speed * challenge.launch_speed;
        const tension = (rope_length) => challenge.mass * (speed_squared / bucketRadius(rope_length) + challenge.gravity)
            + ropeLoad(rope_length, speed_squared, challenge.gravity);
        let low = 0;
        let high = 3;
        if (tension(high) > allowed) {
            return null;
        }
        for (let i = 0; i < 50; i++) {
            const middle = (low + high) / 2;
            if (tension(middle) > allowed) {
                low = middle;
            } else {
                high = middle;
            }
        }
        return high;
    }

    /* initialState: everything at rest, hanging straight down, the bar held by the
       motor (tip with zero inverse mass until it lets go); drops (10 by default,
       radius 2.2 cm × √(10/n) so that the water volume does not change) settled
       on the bucket bottom in hexagonal rows */
    function initialState(parameters) {
        const radius = bucketRadius(parameters.rope_length);
        const link_length = parameters.rope_length / ROPE_LINKS;
        const node_mass = ROPE_LINEAR_DENSITY * link_length;
        const point = (distance, inverse_mass) => ({
            x: 0,
            y: PIVOT_HEIGHT - distance,
            previous_x: 0,
            previous_y: PIVOT_HEIGHT - distance,
            velocity_x: 0,
            velocity_y: 0,
            inverse_mass,
        });
        const nodes = [point(0, 0), point(BAR_LENGTH, 0)];
        for (let i = 1; i <= ROPE_LINKS; i++) {
            nodes.push(point(BAR_LENGTH + i * link_length, 1 / (i === ROPE_LINKS ? node_mass + HANDLE_MASS : node_mass)));
        }
        nodes.push(point(radius, 1 / parameters.mass));
        const drop_count = Math.max(1, Math.round(parameters.drop_count ?? DROP_COUNT));
        const drop_radius = DROP_RADIUS * Math.sqrt(DROP_COUNT / drop_count);
        return {
            nodes,
            drops: settledDrops(BAR_LENGTH + parameters.rope_length, drop_count, drop_radius, point),
            drop_radius,
            link_lengths: [BAR_LENGTH, ...new Array(ROPE_LINKS).fill(link_length), BUCKET.center_of_mass],
            rope_flags: [false, ...new Array(ROPE_LINKS).fill(true), false],
            snapped: false,
            mass: parameters.mass,
            tension: (parameters.mass + ROPE_LINEAR_DENSITY * parameters.rope_length) * parameters.gravity,
            released: false,
            turned: 0,
            previous_angle: 0,
            work: createWorkspace(ROPE_LINKS + 2),
        };
    }

    /* settledDrops: drops at rest on the bottom of the hanging bucket, hexagonal
       rows alternating n and n − 1 drops across the inner width */
    function settledDrops(handle_distance, count, radius, point) {
        const drops = [];
        const per_row = Math.max(1, Math.floor((2 * BUCKET.half_width) / (2 * radius) - 1e-9));
        for (let row = 0; drops.length < count; row++) {
            const in_row = row % 2 === 0 ? per_row : Math.max(per_row - 1, 1);
            for (let k = 0; k < in_row && drops.length < count; k++) {
                const drop = point(handle_distance + BUCKET.bottom - radius - row * Math.sqrt(3) * radius, 0);
                drop.x = (k - (in_row - 1) / 2) * 2 * radius;
                drop.previous_x = drop.x;
                drop.spilled = false;
                drop.resting = false;
                drops.push(drop);
            }
        }
        return drops;
    }

    /* createWorkspace: preallocated arrays of the chain solver (no allocation per substep) */
    function createWorkspace(link_count) {
        return {
            unit_x: new Float64Array(link_count),
            unit_y: new Float64Array(link_count),
            violation: new Float64Array(link_count),
            active: new Uint8Array(link_count),
            diagonal: new Float64Array(link_count),
            upper: new Float64Array(link_count),
            right: new Float64Array(link_count),
            delta: new Float64Array(link_count),
            lambdas: new Float64Array(link_count),
            shift_x: new Float64Array(link_count + 1),
            shift_y: new Float64Array(link_count + 1),
        };
    }

    /* solveTridiagonal: Thomas algorithm for A Δλ = −C restricted to the active
       links (an inactive link has the row Δλ_i = 0, which decouples its neighbours;
       a row that becomes singular — a straight chain between two fixed points —
       is decoupled the same way);
       the solution is written into work.delta */
    function solveTridiagonal(nodes, work) {
        const { unit_x, unit_y, violation, active, diagonal, upper, right, delta } = work;
        const count = violation.length;
        for (let i = 0; i < count; i++) {
            diagonal[i] = active[i] ? nodes[i].inverse_mass + nodes[i + 1].inverse_mass : 1;
            right[i] = active[i] ? -violation[i] : 0;
            upper[i] = i + 1 < count && active[i] && active[i + 1]
                ? -nodes[i + 1].inverse_mass * (unit_x[i] * unit_x[i + 1] + unit_y[i] * unit_y[i + 1])
                : 0;
        }
        for (let i = 1; i < count; i++) {
            const factor = upper[i - 1] / diagonal[i - 1];
            const original = diagonal[i];
            diagonal[i] -= factor * upper[i - 1];
            right[i] -= factor * right[i - 1];
            if (diagonal[i] <= SINGULAR_TOLERANCE * original) {
                diagonal[i] = Infinity;
            }
        }
        delta[count - 1] = right[count - 1] / diagonal[count - 1];
        for (let i = count - 2; i >= 0; i--) {
            delta[i] = (right[i] - upper[i] * delta[i + 1]) / diagonal[i];
        }
    }

    /* mostPushingLink: active rope link with the largest Δλ > 0 (it would push), −1 if none */
    function mostPushingLink(work, rope_flags) {
        let best = -1;
        for (let i = 0; i < work.delta.length; i++) {
            if (work.active[i] && rope_flags[i] && work.delta[i] > 0 && (best < 0 || work.delta[i] > work.delta[best])) {
                best = i;
            }
        }
        return best;
    }

    /* mostStretchedLink: inactive rope link that the correction of the active ones
       would stretch the most, linearised C_i + n_i · (Δx_{i+1} − Δx_i) > 0; −1 if none */
    function mostStretchedLink(nodes, work, rope_flags, broken_link) {
        const { unit_x, unit_y, violation, active, delta, shift_x, shift_y } = work;
        shift_x.fill(0);
        shift_y.fill(0);
        for (let i = 0; i < violation.length; i++) {
            if (active[i]) {
                shift_x[i] -= nodes[i].inverse_mass * unit_x[i] * delta[i];
                shift_y[i] -= nodes[i].inverse_mass * unit_y[i] * delta[i];
                shift_x[i + 1] += nodes[i + 1].inverse_mass * unit_x[i] * delta[i];
                shift_y[i + 1] += nodes[i + 1].inverse_mass * unit_y[i] * delta[i];
            }
        }
        let best = -1;
        let best_value = 1e-12;
        for (let i = 0; i < violation.length; i++) {
            if (active[i] || !rope_flags[i] || i === broken_link) {
                continue;
            }
            const predicted = violation[i] + unit_x[i] * (shift_x[i + 1] - shift_x[i]) + unit_y[i] * (shift_y[i + 1] - shift_y[i]);
            if (predicted > best_value) {
                best = i;
                best_value = predicted;
            }
        }
        return best;
    }

    /* solveChain: direct projection of every link of the chain at once (zero
       compliance). Link i joins nodes i and i+1 with unit vector n_i and violation
       C_i = |x_{i+1} − x_i| − l_i; the multipliers solve the tridiagonal system
       A Δλ = −C, A_ii = w_i + w_{i+1}, A_{i,i+1} = −w_{i+1} (n_i · n_{i+1}), then
       x_i −= w_i n_i Δλ_i and x_{i+1} += w_{i+1} n_i Δλ_i. One-sided rope links
       form a linear complementarity problem (C_i ≤ 0, λ_i ≤ 0, λ_i C_i = 0), solved
       by active set: every unbroken link starts active (except a rope link already
       slack by more than 10⁻⁶ of its length), the rope link pushing the
       most (largest Δλ > 0) is released, an inactive rope link that the correction
       would stretch is taken back, until neither happens. Two linearisations per
       substep. Returns work.lambdas, λ of every link. */
    function solveChain(nodes, lengths, rope_flags, broken_link, work) {
        const count = lengths.length;
        const { unit_x, unit_y, violation, active, delta, lambdas } = work;
        lambdas.fill(0);
        for (let iteration = 0; iteration < 2; iteration++) {
            for (let i = 0; i < count; i++) {
                const delta_x = nodes[i + 1].x - nodes[i].x;
                const delta_y = nodes[i + 1].y - nodes[i].y;
                const distance = Math.max(Math.sqrt(delta_x * delta_x + delta_y * delta_y), 1e-12);
                unit_x[i] = delta_x / distance;
                unit_y[i] = delta_y / distance;
                violation[i] = distance - lengths[i];
                active[i] = i !== broken_link && nodes[i].inverse_mass + nodes[i + 1].inverse_mass > 0
                    && (!rope_flags[i] || violation[i] > -SLACK_TOLERANCE * lengths[i]) ? 1 : 0;
            }
            solveTridiagonal(nodes, work);
            for (let pass = 0; pass < 4 * count; pass++) {
                const released = mostPushingLink(work, rope_flags);
                const taken = released >= 0 ? -1 : mostStretchedLink(nodes, work, rope_flags, broken_link);
                if (released < 0 && taken < 0) {
                    break;
                }
                active[released >= 0 ? released : taken] = released < 0 ? 1 : 0;
                solveTridiagonal(nodes, work);
            }
            for (let i = 0; i < count; i++) {
                if (!active[i]) {
                    continue;
                }
                const a = nodes[i];
                const b = nodes[i + 1];
                a.x -= a.inverse_mass * unit_x[i] * delta[i];
                a.y -= a.inverse_mass * unit_y[i] * delta[i];
                b.x += b.inverse_mass * unit_x[i] * delta[i];
                b.y += b.inverse_mass * unit_y[i] * delta[i];
                lambdas[i] += delta[i];
            }
        }
        return lambdas;
    }

    /* bucketFrame: handle point, unit axis e (handle → bottom) and its normal */
    function bucketFrame(nodes) {
        const handle = nodes[HANDLE];
        const center = nodes[CENTER];
        const length = Math.sqrt((center.x - handle.x) ** 2 + (center.y - handle.y) ** 2);
        const axis_x = (center.x - handle.x) / length;
        const axis_y = (center.y - handle.y) / length;
        return { x: handle.x, y: handle.y, axis_x, axis_y, normal_x: -axis_y, normal_y: axis_x };
    }

    /* containDrop: project a drop inside the bucket (bottom and side walls, open
       rim); marks it spilled once its centre has crossed the rim plane */
    function containDrop(drop, frame, radius) {
        const relative_x = drop.x - frame.x;
        const relative_y = drop.y - frame.y;
        const along = relative_x * frame.axis_x + relative_y * frame.axis_y;
        const across = relative_x * frame.normal_x + relative_y * frame.normal_y;
        if (along < BUCKET.rim) {
            drop.spilled = true;
            return;
        }
        const clamped_along = Math.min(along, BUCKET.bottom - radius);
        const clamped_across = Math.min(Math.max(across, -BUCKET.half_width + radius), BUCKET.half_width - radius);
        drop.x = frame.x + clamped_along * frame.axis_x + clamped_across * frame.normal_x;
        drop.y = frame.y + clamped_along * frame.axis_y + clamped_across * frame.normal_y;
    }

    /* separateDrops: non-overlap constraint |p_i − p_j| ≥ 2 r between drops that
       are both in the bucket or both in the air (equal masses, half correction each) */
    function separateDrops(drops, radius) {
        for (let i = 0; i < drops.length; i++) {
            for (let j = i + 1; j < drops.length; j++) {
                const a = drops[i];
                const b = drops[j];
                if (a.spilled !== b.spilled || a.resting || b.resting) {
                    continue;
                }
                const delta_x = b.x - a.x;
                const delta_y = b.y - a.y;
                const distance_squared = delta_x * delta_x + delta_y * delta_y;
                if (distance_squared >= 4 * radius * radius || distance_squared < 1e-24) {
                    continue;
                }
                const distance = Math.sqrt(distance_squared);
                const push = (2 * radius - distance) / 2 / distance;
                a.x -= delta_x * push;
                a.y -= delta_y * push;
                b.x += delta_x * push;
                b.y += delta_y * push;
            }
        }
    }

    /* predict: explicit prediction x ← x + v Δt with v ← v − g Δt (free point) */
    function predict(point, gravity, dt) {
        point.previous_x = point.x;
        point.previous_y = point.y;
        point.velocity_y -= gravity * dt;
        point.x += point.velocity_x * dt;
        point.y += point.velocity_y * dt;
    }

    /* settleOnGround: the floor y = 0 stops a point (perfectly inelastic, no sliding) */
    function settleOnGround(point, radius) {
        if (point.y >= radius) {
            return false;
        }
        point.y = radius;
        point.x = point.previous_x;
        return true;
    }

    /* updateVelocity: position-based velocity v = (x − x_previous)/Δt */
    function updateVelocity(point, dt) {
        point.velocity_x = (point.x - point.previous_x) / dt;
        point.velocity_y = (point.y - point.previous_y) / dt;
    }

    /* dampJoint: friction of the joint at node b between the segments b → a and
       b → c — an internal torque pair: the impulses Q_c ⊥ bc on c and Q_a ⊥ ba on
       a give the angular impulses +J and −J about b, and b takes −(Q_a + Q_c),
       so linear and angular momentum are conserved; J is sized (the relative
       spin is linear in the velocities) so that the relative rotation decays at
       the given rate, which only removes energy. A node of inverse mass 0 takes
       its impulse without moving (the bar's fixed pivot) */
    function dampJoint(a, b, c, rate, dt) {
        const spin = (from, to, from_dv, to_dv) => {
            const arm_x = to.x - from.x;
            const arm_y = to.y - from.y;
            return (arm_x * (to_dv[1] - from_dv[1]) - arm_y * (to_dv[0] - from_dv[0])) / (arm_x * arm_x + arm_y * arm_y);
        };
        const velocity = (node) => [node.velocity_x, node.velocity_y];
        const relative = (va, vb, vc) => spin(b, c, vb, vc) - spin(b, a, vb, va);
        const kicks = (angular_impulse) => {
            const along = (node) => {
                const arm_x = node.x - b.x;
                const arm_y = node.y - b.y;
                const share = angular_impulse / (arm_x * arm_x + arm_y * arm_y);
                return [-arm_y * share, arm_x * share];
            };
            const on_c = along(c);
            const on_a = along(a).map((component) => -component);
            return { a: on_a, b: [-on_a[0] - on_c[0], -on_a[1] - on_c[1]], c: on_c };
        };
        const unit = kicks(1);
        const scaled = (node, kick) => [kick[0] * node.inverse_mass, kick[1] * node.inverse_mass];
        const response = relative(scaled(a, unit.a), scaled(b, unit.b), scaled(c, unit.c));
        if (!(response > 0)) {
            return;
        }
        const angular_impulse = -relative(velocity(a), velocity(b), velocity(c)) * (1 - Math.exp(-rate * dt)) / response;
        const kick = kicks(angular_impulse);
        for (const [node, impulse] of [[a, kick.a], [b, kick.b], [c, kick.c]]) {
            node.velocity_x += impulse[0] * node.inverse_mass;
            node.velocity_y += impulse[1] * node.inverse_mass;
        }
    }

    /* stepState: one substep — prediction (the motor places the bar tip while it
       drives it, driven_angle ≠ null), chain projection, floor, drops contained
       and separated, velocities from positions (v = Δx/Δt); returns the raw rope
       tension, largest −λ/Δt² over the rope links (0 when slack or broken) */
    function stepState(state, gravity, dt, driven_angle = null) {
        const nodes = state.nodes;
        if (driven_angle === null) {
            predict(nodes[TIP], BAR_WEIGHT_FACTOR * gravity, dt);
        } else {
            nodes[TIP].previous_x = nodes[TIP].x;
            nodes[TIP].previous_y = nodes[TIP].y;
            nodes[TIP].x = BAR_LENGTH * Math.sin(driven_angle);
            nodes[TIP].y = PIVOT_HEIGHT - BAR_LENGTH * Math.cos(driven_angle);
        }
        for (let i = TIP + 1; i < nodes.length; i++) {
            predict(nodes[i], gravity, dt);
        }
        for (const drop of state.drops) {
            if (!drop.resting) {
                predict(drop, gravity, dt);
            }
        }
        const lambdas = solveChain(nodes, state.link_lengths, state.rope_flags, state.snapped ? FIRST_ROPE_LINK : -1, state.work);
        for (let i = TIP + 1; i < nodes.length; i++) {
            settleOnGround(nodes[i], 0.01);
        }
        const frame = bucketFrame(nodes);
        for (const drop of state.drops) {
            if (!drop.spilled) {
                containDrop(drop, frame, state.drop_radius);
            }
        }
        separateDrops(state.drops, state.drop_radius);
        for (const drop of state.drops) {
            if (drop.spilled && !drop.resting && settleOnGround(drop, state.drop_radius)) {
                drop.resting = true;
            }
        }
        for (let i = TIP; i < nodes.length; i++) {
            updateVelocity(nodes[i], dt);
        }
        dampJoint(nodes[HANDLE - 1], nodes[HANDLE], nodes[CENTER], HINGE_DAMPING_RATE, dt);
        if (state.released) {
            dampJoint(nodes[PIVOT], nodes[TIP], nodes[TIP + 1], HINGE_DAMPING_RATE, dt);
        }
        const handle = nodes[HANDLE];
        const center = nodes[CENTER];
        const arm_x = center.x - handle.x;
        const arm_y = center.y - handle.y;
        const spin = (arm_x * (center.velocity_y - handle.velocity_y) - arm_y * (center.velocity_x - handle.velocity_x)) / (arm_x * arm_x + arm_y * arm_y);
        const keep = Math.exp(-WATER_DRAG_RATE * dt);
        for (const drop of state.drops) {
            updateVelocity(drop, dt);
            if (!drop.spilled) {
                const bucket_x = handle.velocity_x - spin * (drop.y - handle.y);
                const bucket_y = handle.velocity_y + spin * (drop.x - handle.x);
                drop.velocity_x = bucket_x + (drop.velocity_x - bucket_x) * keep;
                drop.velocity_y = bucket_y + (drop.velocity_y - bucket_y) * keep;
            }
        }
        if (state.snapped) {
            return 0;
        }
        let largest = 0;
        for (let i = FIRST_ROPE_LINK; i <= LAST_ROPE_LINK; i++) {
            largest = Math.max(largest, -lambdas[i]);
        }
        return largest / (dt * dt);
    }

    /* trackTurns: cumulative angle swept by the bucket around the pivot (unwrapped) */
    function trackTurns(state) {
        const angle = bucketAngle(state);
        let change = angle - state.previous_angle;
        if (change > Math.PI) {
            change -= 2 * Math.PI;
        } else if (change < -Math.PI) {
            change += 2 * Math.PI;
        }
        state.previous_angle = angle;
        state.turned += change;
        return change;
    }

    /* bucketAngle: angle of the bucket centre of mass around the pivot, from the lowest point */
    function bucketAngle(state) {
        const center = state.nodes[CENTER];
        return Math.atan2(center.x, PIVOT_HEIGHT - center.y);
    }

    /* bucketMotion: distance r of the bucket centre from the pivot, its angular
       speed (r × v)/r² and its energy per unit mass ½ v² + g (y − y_bas) from the
       lowest point of the circle of radius R */
    function bucketMotion(state, gravity, radius) {
        const center = state.nodes[CENTER];
        const relative_x = center.x;
        const relative_y = center.y - PIVOT_HEIGHT;
        const distance_squared = relative_x * relative_x + relative_y * relative_y;
        return {
            distance: Math.sqrt(distance_squared),
            angular_speed: (relative_x * center.velocity_y - relative_y * center.velocity_x) / distance_squared,
            energy: (center.velocity_x ** 2 + center.velocity_y ** 2) / 2 + gravity * (center.y - (PIVOT_HEIGHT - radius)),
        };
    }

    /* smootherstep: u³ (10 − 15 u + 6 u²) on [0, 1], and its derivative */
    function smootherstep(u) {
        const clamped = Math.min(Math.max(u, 0), 1);
        return {
            value: clamped ** 3 * (10 - 15 * clamped + 6 * clamped * clamped),
            slope: u <= 0 || u >= 1 ? 0 : 30 * clamped * clamped * (1 - clamped) * (1 - clamped),
        };
    }

    /* throwReady: the pumping is over — the bucket turns back forward from a
       backswing (θ < 0) with at least 90 % of the energy of a 70° swing */
    function throwReady(motor, state, parameters, radius) {
        const motion = bucketMotion(state, parameters.gravity, radius);
        return motor.phase === "swing" && motor.bucket_angle < 0 && motor.previous_speed < 0 && motion.angular_speed >= 0
            && motion.energy >= 0.9 * parameters.gravity * radius * (1 - Math.cos(PUMP_AMPLITUDE));
    }

    /* startThrow: switch the motor to the throw toward the energy ½ v₀² */
    function startThrow(motor, state, parameters, radius) {
        const motion = bucketMotion(state, parameters.gravity, radius);
        motor.phase = "throw";
        motor.start_angle = motor.bucket_angle;
        motor.start_energy = motion.energy;
        motor.target_energy = parameters.launch_speed ** 2 / 2;
        motor.release_angle = motor.target_energy <= BOTTOM_RELEASE_RATIO * parameters.gravity * radius ? 0 : RELEASE_ANGLE;
    }

    /* motorLead: lead δ of the bar over the bucket wanted by the motor.
       The rope, pulling from the tip, makes the angle ψ with the bucket's inward
       radial; its pull per unit mass has the inward part r θ'² + g cos(θ) and the
       tangential part (r θ'² + g cos(θ)) tan(ψ), so it changes the energy at the
       rate dE/dθ = (2 E + g R (3 cos(θ) − 2)) tan(ψ). The bar gives ψ through the
       lead, L_b sin(δ + ψ) = r sin(ψ), so |sin(ψ)| ≤ 0.85 L_b/r; tan(ψ) is also
       kept ≤ 0.35 (≈ 19°) so that the bucket, hinged at its handle, keeps up.
       Timings scale with τ = √(R/g) (the push lasts 1.3 τ, the lead is smoothed
       over 0.3 τ while swinging, 0.1 τ while throwing).
       swing — tan(ψ) = 0.6 s tanh(θ'/θ'_s) × room (room → 0 as the swing nears
               70°), after a gentle push: pumping at the pendulum's own
               rhythm;
       throw — from a backswing (θ' changes sign with θ < 0), follow the energy
               curve E_d(θ) = E_s + (E* − E_s) smootherstep((θ − θ_s)/(θ_r − θ_s)),
               E* = ½ v₀², θ_r = 90° (0° if E* ≤ 1.2 g R): feed-forward
               tan(ψ) = (dE_d/dθ)/(2 E + g R (3 cos(θ) − 2)) plus (E_d − E)/(g R);
       align — once the energy, with what the alignment will still add, reaches
               ½ v₀²: no lead (no more work), the bar comes back in line and
               accompanies the bucket until the chain no longer bends (< 3°, at
               most 0.6 s); released then */
    function motorLead(motor, state, parameters, radius, time) {
        const motion = bucketMotion(state, parameters.gravity, radius);
        const angle = motor.bucket_angle;
        const gravity_radius = parameters.gravity * radius;
        const inward = motion.distance * motion.angular_speed ** 2 + parameters.gravity * Math.cos(angle);
        const sine_limit = PULL_SAFETY * Math.min(BAR_LENGTH / motion.distance, 1);
        const tangent_limit = Math.min(sine_limit / Math.sqrt(1 - sine_limit * sine_limit), MAX_PULL_TANGENT);
        motor.previous_speed = motion.angular_speed;
        if (motor.phase === "align") {
            return 0;
        }
        let tangent;
        if (motor.phase === "swing") {
            const pump_energy = gravity_radius * (1 - Math.cos(PUMP_AMPLITUDE));
            const room = Math.min(1, Math.max(0, (pump_energy - motion.energy) / (0.3 * pump_energy)));
            const speed_scale = 0.3 * Math.sqrt(parameters.gravity / radius);
            const kick = KICK_TIME_SCALES * Math.sqrt(radius / parameters.gravity);
            const push = time < kick ? 0.5 * Math.sin(Math.PI * time / kick) : Math.tanh(motion.angular_speed / speed_scale) * room;
            tangent = PUMP_FRACTION * tangent_limit * push;
        } else {
            const span = motor.release_angle - motor.start_angle;
            const curve = smootherstep((angle - motor.start_angle) / span);
            const wanted = motor.start_energy + (motor.target_energy - motor.start_energy) * curve.value;
            const slope = (motor.target_energy - motor.start_energy) * curve.slope / span;
            const capacity = Math.max(2 * motion.energy + gravity_radius * (3 * Math.cos(angle) - 2), 0.1 * gravity_radius);
            tangent = slope / capacity + ENERGY_GAIN * (wanted - motion.energy) / gravity_radius;
        }
        if (inward <= 0) {
            return 0;
        }
        tangent = Math.min(Math.max(tangent, -tangent_limit), tangent_limit);
        const psi = Math.atan(tangent);
        return Math.asin(Math.min(Math.max(motion.distance * Math.sin(psi) / BAR_LENGTH, -1), 1)) - psi;
    }

    /* chainWobble: largest bend of the chain at the bar tip (bar / rope) and at
       the handle (rope / bucket), in radians */
    function chainWobble(state) {
        const direction = (from, to) => Math.atan2(to.x - from.x, from.y - to.y);
        const bend = (first, second) => Math.abs(((second - first + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        const nodes = state.nodes;
        const bar = direction({ x: 0, y: PIVOT_HEIGHT }, nodes[TIP]);
        const rope = direction(nodes[TIP], nodes[HANDLE]);
        const bucket = direction(nodes[HANDLE], nodes[CENTER]);
        return Math.max(bend(bar, rope), bend(rope, bucket));
    }

    /* predictedEnergy: bucket energy once the bar is back in line — the current
       energy plus the gain during the alignment, dE/dt ≈ (2 E + g R (3 cos(θ) − 2))
       tan(ψ) θ' over half the alignment time, with tan(ψ) = L_b sin(δ)/(r − L_b cos(δ))
       from the current lead δ */
    function predictedEnergy(motor, state, parameters, radius) {
        const motion = bucketMotion(state, parameters.gravity, radius);
        const tangent = BAR_LENGTH * Math.sin(motor.lead) / (motion.distance - BAR_LENGTH * Math.cos(motor.lead));
        const capacity = 2 * motion.energy + parameters.gravity * radius * (3 * Math.cos(motor.bucket_angle) - 2);
        return motion.energy + 0.5 * ALIGN_SECONDS * Math.max(capacity * tangent * motion.angular_speed, 0);
    }

    /* moveBar: the bar angle follows the motor's target as a critically damped
       second-order system (ω_n = 20 rad/s) with velocity feed-forward on the
       bucket's angular speed: smooth, never a jump */
    function moveBar(motor, target, target_rate, dt) {
        const acceleration = BAR_STIFFNESS * (target - motor.angle) + 2 * Math.sqrt(BAR_STIFFNESS) * (target_rate - motor.rate);
        motor.rate += acceleration * dt;
        motor.angle += motor.rate * dt;
        return motor.angle;
    }

    /* releaseBar: the motor lets go — the bar tip gets its effective mass m_b/3
       back, turns are counted from here */
    function releaseBar(state) {
        state.released = true;
        state.nodes[TIP].inverse_mass = 3 / BAR_MASS;
        state.turned = 0;
        state.previous_angle = bucketAngle(state);
    }

    /* captureFrame: copy of the drawable state at a given time */
    function captureFrame(state, time, motor) {
        return {
            time,
            released: state.released,
            motor_phase: motor === null ? "rest" : motor.phase,
            drop_radius: state.drop_radius,
            nodes: state.nodes.map((node) => [node.x, node.y]),
            drops: state.drops.map((drop) => [drop.x, drop.y, drop.spilled]),
            tension: state.tension,
            snapped: state.snapped,
            turns: Math.max(state.turned, 0) / (2 * Math.PI),
        };
    }

    /* waveRate: substeps per second at least `minimum` and fast enough for the
       transverse waves of the rope under the tension T, rate ≥ 1.3 c/ℓ with
       c = √(T/μ) (a short rope under a heavy bucket), rounded up to 120 Hz */
    function waveRate(parameters, tension, minimum) {
        const wave = Math.sqrt(tension / ROPE_LINEAR_DENSITY) / (parameters.rope_length / ROPE_LINKS);
        return Math.max(minimum, Math.ceil(1.3 * wave / 120) * 120);
    }

    /* substepRate: substeps per second from the throw on — at least 2400, waves
       under T ≈ 1.3 m (v₀²/R + g) */
    function substepRate(parameters) {
        const radius = bucketRadius(parameters.rope_length);
        return waveRate(parameters, 1.3 * parameters.mass * (parameters.launch_speed ** 2 / radius + parameters.gravity), SUBSTEP_RATE);
    }

    /* windupRate: substeps per second during the pumping — at least 1200, waves
       under T ≈ 1.3 m g (3 − 2 cos(70°)) (bottom of a 70° swing); independent of
       v₀ and T_max, as the pumping cache requires */
    function windupRate(parameters) {
        return waveRate(parameters, 1.3 * parameters.mass * parameters.gravity * (3 - 2 * Math.cos(PUMP_AMPLITUDE)), WINDUP_SUBSTEP_RATE);
    }

    /* newAttempt: mutable context of one attempt (state, motor, clock, results) */
    function newAttempt(parameters, record) {
        const state = initialState(parameters);
        const motor = {
            phase: "swing", angle: 0, rate: 0, lead: 0, bucket_angle: 0, previous_speed: 0,
            target_energy: parameters.launch_speed ** 2 / 2, start_angle: 0, start_energy: 0, release_angle: RELEASE_ANGLE, align_time: null,
        };
        return {
            state, motor, record, frames: [captureFrame(state, 0, motor)],
            outcome: "success", event_time: null, end_time: MAX_DRIVE_SECONDS + MAX_RUN_SECONDS,
            release_time: null, launch_speed: 0, max_tension: 0, min_tension: Infinity,
            time: 0, frame_index: 0, previous_angle: 0,
        };
    }

    /* advanceAttempt: run the attempt's substeps until its end — or, with
       stop_at_throw, until the pumping is over (before that substep: what happened
       so far does not depend on v₀) — returns true when stopped at the throw;
       watch_tension, if given, sees the filtered tension after every substep */
    function advanceAttempt(attempt, parameters, stop_at_throw, watch_tension = null) {
        const radius = bucketRadius(parameters.rope_length);
        const free_rate = substepRate(parameters);
        const windup_rate = windupRate(parameters);
        const { state, motor } = attempt;
        while (attempt.time < attempt.end_time) {
            if (throwReady(motor, state, parameters, radius)) {
                if (stop_at_throw) {
                    return true;
                }
                startThrow(motor, state, parameters, radius);
            }
            const dt = 1 / (motor.phase === "swing" ? windup_rate : free_rate);
            attempt.time += dt;
            const time = attempt.time;
            let driven_angle = null;
            if (!state.released) {
                const smoothing = (motor.phase === "swing" ? LEAD_SMOOTHING_TIME_SCALES : THROW_SMOOTHING_TIME_SCALES) * Math.sqrt(radius / parameters.gravity);
                motor.lead += (motorLead(motor, state, parameters, radius, time) - motor.lead) * Math.min(1, dt / smoothing);
                driven_angle = moveBar(motor, motor.bucket_angle + motor.lead, bucketMotion(state, parameters.gravity, radius).angular_speed, dt);
            }
            const raw_tension = stepState(state, parameters.gravity, dt, driven_angle);
            state.tension += (raw_tension - state.tension) * dt / TENSION_FILTER_SECONDS;
            if (watch_tension !== null) {
                watch_tension(state.tension);
            }
            if (!state.released) {
                const angle = bucketAngle(state);
                let change = angle - attempt.previous_angle;
                change -= 2 * Math.PI * Math.round(change / (2 * Math.PI));
                motor.bucket_angle += change;
                attempt.previous_angle = angle;
                if (motor.phase === "throw" && change > 0
                    && (predictedEnergy(motor, state, parameters, radius) >= motor.target_energy || motor.bucket_angle >= LATEST_RELEASE_ANGLE)) {
                    motor.phase = "align";
                }
                if (motor.phase === "align" && motor.align_time === null) {
                    motor.align_time = time;
                }
                const reached = motor.phase === "align"
                    && ((Math.abs(motor.lead) <= ALIGNED_LEAD && chainWobble(state) <= ALIGNED_WOBBLE) || time - motor.align_time >= MAX_ALIGN_SECONDS);
                if (reached || time >= MAX_DRIVE_SECONDS) {
                    releaseBar(state);
                    motor.phase = "free";
                    attempt.release_time = time;
                    attempt.launch_speed = Math.hypot(state.nodes[CENTER].velocity_x, state.nodes[CENTER].velocity_y);
                }
            }
            const change = state.released ? trackTurns(state) : 0;
            const spilled = state.drops.some((drop) => drop.spilled);
            if (attempt.event_time === null) {
                if (state.released) {
                    attempt.max_tension = Math.max(attempt.max_tension, state.tension);
                    attempt.min_tension = Math.min(attempt.min_tension, state.tension);
                }
                if (state.tension > parameters.tension_max) {
                    attempt.outcome = "snap";
                    state.snapped = true;
                    state.tension = 0;
                } else if (spilled) {
                    attempt.outcome = "spill";
                } else if (state.released && change < 0 && state.turned < 2 * Math.PI) {
                    attempt.outcome = "swing";
                } else if (state.released && state.turned >= WIN_TURNS * 2 * Math.PI) {
                    attempt.event_time = time;
                    attempt.end_time = time;
                }
                if (attempt.outcome !== "success") {
                    attempt.event_time = time;
                    attempt.end_time = attempt.record ? time + POST_EVENT_SECONDS : time;
                    if (!state.released) {
                        releaseBar(state);
                        motor.phase = "free";
                        attempt.release_time = time;
                    }
                }
            } else if (attempt.outcome === "swing" && spilled) {
                attempt.outcome = "spill";
                attempt.event_time = time;
                attempt.end_time = attempt.record ? time + POST_EVENT_SECONDS : time;
            }
            if (attempt.record && Math.floor(time * FRAME_RATE + 1e-9) > attempt.frame_index) {
                attempt.frame_index = Math.floor(time * FRAME_RATE + 1e-9);
                attempt.frames.push(captureFrame(state, attempt.frame_index / FRAME_RATE, motor));
            }
        }
        return false;
    }

    /* pumpedAttempt: the attempt at the end of the pumping, which depends neither
       on v₀ nor, unless the rope snaps, on T_max — simulated once per (g, L, m,
       drops, record) with an unbreakable rope, its peak tension kept, and cloned
       afterwards (structuredClone), so that the checker's probes and the display
       replay only the throw; null if the pumping ended the run or would snap this
       rope (the caller then runs the attempt from t = 0) */
    function pumpedAttempt(parameters, record) {
        const key = [parameters.gravity, parameters.rope_length, parameters.mass, parameters.drop_count ?? DROP_COUNT, record].join("|");
        if (!PUMP_CACHE.has(key)) {
            const pumping = { ...parameters, launch_speed: 0, tension_max: Infinity };
            const attempt = newAttempt(pumping, record);
            let peak_tension = 0;
            const reached = advanceAttempt(attempt, pumping, true, (tension) => {
                peak_tension = Math.max(peak_tension, tension);
            });
            if (PUMP_CACHE.size >= PUMP_CACHE_SIZE) {
                PUMP_CACHE.delete(PUMP_CACHE.keys().next().value);
            }
            PUMP_CACHE.set(key, reached ? { attempt, peak_tension } : null);
        }
        const cached = PUMP_CACHE.get(key);
        return cached === null || cached.peak_tension > parameters.tension_max ? null : structuredClone(cached.attempt);
    }

    /* runAttempt: one attempt. The motor pumps (cached, see pumpedAttempt), then
       throws (motorLead) until the bucket's energy reaches ½ v₀² — so that it then
       passes the lowest point with v₀, whatever the angle — or the bucket reaches
       150° (or after 40 s), aligns, and lets the bar go; until success (2 turns
       after the release), or the first lost drop / snapped rope (at any time:
       every force goes through the rope) / swing back (the bucket turns backwards
       before its first free turn) plus 1.6 s of aftermath; frames at 60 Hz.
       Returns { frames, outcome, event_time, duration, release_time, launch_speed
       (bucket speed at the release), max_tension, min_tension } */
    function runAttempt(parameters, record) {
        let attempt = pumpedAttempt(parameters, record);
        if (attempt === null) {
            attempt = newAttempt(parameters, record);
        }
        advanceAttempt(attempt, parameters, false);
        const { state, motor } = attempt;
        attempt.frames.push(captureFrame(state, attempt.time, motor));
        if (attempt.event_time === null) {
            attempt.outcome = "swing";
            attempt.event_time = attempt.time;
        }
        return {
            frames: attempt.frames, outcome: attempt.outcome, event_time: attempt.event_time, duration: attempt.time,
            release_time: attempt.release_time, launch_speed: attempt.launch_speed, max_tension: attempt.max_tension, min_tension: attempt.min_tension,
        };
    }

    /* simulateRun: whole attempt for parameters { gravity, launch_speed,
       rope_length, mass, tension_max, drop_count? }: the motor swings the bar,
       throws the bucket and lets go, free turns (see runAttempt). v₀ = 0: nobody launches the bucket, it
       just hangs ("swing"). record = false skips the frames and the aftermath
       (outcome only, used by the checker) */
    function simulateRun(parameters, record = true) {
        if (parameters.launch_speed <= 0) {
            const state = initialState(parameters);
            const frames = [captureFrame(state, 0, null), captureFrame(state, POST_EVENT_SECONDS, null)];
            return { frames, outcome: "swing", event_time: 0, duration: POST_EVENT_SECONDS, release_time: null, launch_speed: 0, max_tension: state.tension, min_tension: state.tension };
        }
        return runAttempt(parameters, record);
    }

    /* frameAt: last frame at or before the given time */
    function frameAt(run, time) {
        const index = Math.min(Math.max(Math.floor(time * FRAME_RATE + 1e-9), 0), run.frames.length - 1);
        return run.frames[index];
    }

    /* fillThreshold: smallest accepted mass when m is the free variable (90 % of
       the announced m_max), 0 otherwise */
    function fillThreshold(challenge) {
        return challenge.variable === "mass" ? winningWindow(challenge).minimum : 0;
    }

    /* evaluate: outcome of the attempt with the free variable set to value; a
       successful run with an under-filled bucket is "underfilled" */
    function evaluate(challenge, value) {
        const outcome = simulateRun({ gravity: challenge.gravity, tension_max: challenge.tension_max, ...resolveParameters(challenge, value) }, false).outcome;
        return outcome === "success" && value < fillThreshold(challenge) ? "underfilled" : outcome;
    }

    /* isChallengeFeasible: the announced window lies inside the input range, is
       wide enough (≥ 5 % and ≥ 3 input steps), and the full simulation succeeds at
       both of its ends and in its middle */
    function isChallengeFeasible(challenge) {
        const window = winningWindow(challenge);
        const spec = VARIABLES[challenge.variable];
        if (!(window.minimum >= spec.min && window.maximum <= spec.max)) {
            return false;
        }
        const width = window.maximum - window.minimum;
        if (width < MINIMUM_RELATIVE_WINDOW * window.minimum || width < 3 * spec.step) {
            return false;
        }
        const probes = [0, 0.25, 0.5, 0.75, 1].map((share) => window.minimum + share * (window.maximum - window.minimum));
        return probes.every((value) => evaluate(challenge, value) === "success");
    }

    /* randomBetween: uniform value in [low, high], rounded to the given step */
    function randomBetween(rng, low, high, step) {
        return Math.round((low + rng() * (high - low)) / step) * step;
    }

    /* drawVariable: free variable drawn with weights 4 (v₀) : 3 (L) : 3 (m) */
    function drawVariable(rng) {
        const total = VARIABLE_KEYS.reduce((sum, key) => sum + VARIABLES[key].weight, 0);
        let remaining = rng() * total;
        for (const key of VARIABLE_KEYS) {
            remaining -= VARIABLES[key].weight;
            if (remaining < 0) {
                return key;
            }
        }
        return VARIABLE_KEYS[VARIABLE_KEYS.length - 1];
    }

    /* drawCandidate: constructive challenge around a reference solution — place, L
       and m drawn, reference v₀ with v₀² = (5.8 … 7.5) g R (above 5 g R), T_max set
       above the reference bottom tension, T_max = m (v₀²/R + g) × (1.25 … 1.6) */
    function drawCandidate(rng, variable) {
        const place = PLACES[Math.floor(rng() * PLACES.length)];
        const gravity = place.gravity;
        const rope_length = Math.round(randomBetween(rng, 0.2, 0.55, 0.01) * 100) / 100;
        const mass = Math.round(randomBetween(rng, 1, 6, 0.1) * 10) / 10;
        const radius = bucketRadius(rope_length);
        const reference_speed = Math.sqrt((5.8 + 1.7 * rng()) * gravity * radius);
        const tension_max = Math.round(mass * (reference_speed ** 2 / radius + gravity) * (1.25 + 0.35 * rng()));
        return {
            variable,
            place: place.key,
            gravity,
            launch_speed: variable === "launch_speed" ? null : Math.round(reference_speed * 100) / 100,
            rope_length: variable === "rope_length" ? null : rope_length,
            mass: variable === "mass" ? null : mass,
            tension_max,
        };
    }

    /* randomChallenge: rejection sampling of feasible candidates (bounded attempts,
       deterministic fallback); the previous value must not win the new challenge */
    function randomChallenge(rng = Math.random, excluded = null) {
        const variable = drawVariable(rng);
        for (let attempt = 0; attempt < 30; attempt++) {
            const candidate = drawCandidate(rng, variable);
            const window = winningWindow(candidate);
            const repeats = excluded !== null && excluded.variable === variable
                && excluded.value >= window.minimum && excluded.value <= window.maximum;
            if (!repeats && isChallengeFeasible(candidate)) {
                return candidate;
            }
        }
        return { ...FALLBACK_CHALLENGES[Math.floor(rng() * FALLBACK_CHALLENGES.length)] };
    }

    /* nextMilestone: next tier above the score (null once every tier is reached) */
    function nextMilestone(score) {
        return MILESTONES.find((milestone) => milestone > score) ?? null;
    }

    globalThis.loop_wagon_game = {
        MILESTONES,
        PLACES,
        VARIABLES,
        BAR_LENGTH,
        PIVOT_HEIGHT,
        ROPE_LINKS,
        HANDLE,
        CENTER,
        BUCKET,
        DROP_COUNT,
        DROP_RADIUS,
        SUBSTEP_RATE,
        WIN_TURNS,
        WINDOW_MARGIN,
        MASS_FILL_RATIO,
        FALLBACK_CHALLENGES,
        bucketRadius,
        tensionPerMass,
        idealWindow,
        resolveParameters,
        winningWindow,
        initialState,
        solveChain,
        runAttempt,
        simulateRun,
        frameAt,
        fillThreshold,
        evaluate,
        isChallengeFeasible,
        drawVariable,
        randomChallenge,
        nextMilestone,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Jeu : le seau d'eau", en: "Game: the water bucket" },
        panel_title: { fr: "Défi", en: "Challenge" },
        new_challenge: { fr: "Nouveau défi", en: "New challenge" },
        assumption: {
            fr: "Hypothèses : barre légère (0,3 kg) sur un pivot sans frottement, corde souple et inextensible (0,15 kg/m, elle plie mais ne pousse pas), seau rigide articulé à son anse (masse ponctuelle au centre de masse ; un léger frottement aux articulations amortit les flexions), gouttes d'eau (leur masse est comprise dans m ; une traînée visqueuse freine leur glissement contre le seau), air négligé. T est la tension du maillon le plus chargé ; la méthode numérique dissipe un peu d'énergie (2 à 8 % en deux tours). Au départ tout pend au repos. Seul un moteur au pivot agit : il fait tourner la barre, et la corde, tirée par le bout de la barre, est la seule à agir sur le seau (avec son poids). Le moteur balance d'abord la barre au rythme du pendule jusqu'à environ 70°, puis l'accélère : le seau gagne de l'énergie jusqu'à ½ v₀², la barre se remet dans l'alignement de la corde et le moteur la libère ; ensuite la barre tourne librement et le seau passe au point bas à environ v₀ (un peu plus vite, de 3 à 10 % : l'alignement et la barre lui cèdent encore un peu d'énergie). La corde peut casser à tout moment. Une goutte qui franchit le bord du seau est perdue.",
            en: "Assumptions: light bar (0.3 kg) on a frictionless pivot, flexible inextensible rope (0.15 kg/m, it bends but never pushes), rigid bucket hinged at its handle (point mass at its centre of mass; a little joint friction damps the bending), water drops (their mass is included in m; a viscous drag damps their sliding against the bucket), air neglected. T is the tension of the most loaded link; the numerical method dissipates a little energy (2 to 8 % over two turns). At the start everything hangs at rest. Only a motor at the pivot acts: it turns the bar, and the rope, pulled by the bar's tip, is the only thing acting on the bucket (besides its weight). The motor first swings the bar at the pendulum's rhythm up to about 70°, then speeds it up: the bucket gains energy up to ½ v₀², the bar comes back in line with the rope and the motor lets it go; from then on the bar turns freely and the bucket passes the lowest point at about v₀ (3 to 10 % faster: the alignment and the bar still hand it a little energy). The rope can snap at any time. A drop that crosses the rim of the bucket is lost.",
        },
        goal: { fr: "Fais faire 2 tours au seau sans perdre une goutte ni casser la corde.", en: "Make the bucket go round twice without losing a drop or snapping the rope." },
        card_objective: { fr: "Objectif", en: "Objective" },
        card_tier: { fr: "Palier", en: "Tier" },
        card_totals: { fr: "Réussites / essais", en: "Successes / attempts" },
        card_rate: { fr: "Taux de réussite", en: "Success rate" },
        card_result: { fr: "Dernier essai", en: "Last attempt" },
        all_tiers: { fr: "tous les paliers atteints", en: "every tier reached" },
        tier_reached: { fr: "palier {tier} atteint", en: "tier {tier} reached" },
        result_none: { fr: "—", en: "—" },
        result_success: { fr: "Réussi", en: "Success" },
        result_spill: { fr: "Raté : l'eau est tombée", en: "Failed: the water fell out" },
        result_snap: { fr: "Raté : la corde a cassé", en: "Failed: the rope snapped" },
        result_swing: { fr: "Raté : le seau n'a pas fait le tour", en: "Failed: the bucket did not go round" },
        result_underfilled: { fr: "Raté : seau pas assez rempli", en: "Failed: bucket not filled enough" },
        variable_launch_speed: { fr: "Vitesse de lancement v₀", en: "Launch speed v₀" },
        variable_rope_length: { fr: "Longueur de corde L", en: "Rope length L" },
        variable_mass: { fr: "Masse du seau rempli m", en: "Filled bucket mass m" },
        fill_rule: { fr: "Remplis le seau : m ≥ 90 % de la masse maximale.", en: "Fill the bucket: m ≥ 90 % of the largest mass." },
        place_moon: { fr: "Lune", en: "Moon" },
        place_mars: { fr: "Mars", en: "Mars" },
        place_venus: { fr: "Vénus", en: "Venus" },
        place_earth: { fr: "Terre", en: "Earth" },
        data_place: { fr: "Lieu", en: "Place" },
        data_bar: { fr: "Barre (pivot libre)", en: "Bar (free pivot)" },
        data_bucket: { fr: "Anse → centre de masse", en: "Handle → centre of mass" },
        data_rope: { fr: "Corde", en: "Rope" },
        data_mass: { fr: "Seau rempli", en: "Filled bucket" },
        data_speed: { fr: "Lancement (point bas)", en: "Launch (lowest point)" },
        data_tension: { fr: "Tension de rupture", en: "Breaking tension" },
        turns: { fr: "tour {count} / 2", en: "turn {count} / 2" },
        phase_rest: { fr: "seau au repos", en: "bucket at rest" },
        phase_swing: { fr: "élan : le moteur balance la barre", en: "wind-up: the motor swings the bar" },
        phase_throw: { fr: "le moteur accélère la barre", en: "the motor speeds the bar up" },
        phase_align: { fr: "la barre s'aligne sur la corde", en: "the bar lines up with the rope" },
        phase_free: { fr: "barre libre, seau à {v} m/s", en: "bar free, bucket at {v} m/s" },
        drop_count: { fr: "Gouttes (test)", en: "Drops (test)" },
    };
    const UNITS = { launch_speed: "m/s", rope_length: "m", mass: "kg" };
    const VIEW = { left: -2, right: 2, bottom: -0.2, top: 3.85 };
    const WEIGHT_COLOR = "#d32f2f";
    const TENSION_COLOR = "#8e24aa";
    const SUCCESS_COLOR = "#2e7d32";
    const UI_REFERENCE_WIDTH = 1100;
    const UI_REFERENCE_HEIGHT = 560;
    const FAILURE_COLOR = "#d32f2f";

    let active = false;
    let challenge = null;
    let value = VARIABLES.launch_speed.default_value;
    let drop_count = DROP_COUNT;
    let run = null;
    let run_dirty = true;
    let recorded = false;
    let pending_new_challenge = false;
    let last_time = 0;
    let last_language = null;
    let score = 0;
    let attempts = 0;
    let last_result = null;
    let last_tier_message = "";
    let ui_scale = 1;
    const elements = {};

    /* language: current UI language, mirrored by main.js on <html lang> */
    function language() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* text: translated string with {name} placeholders filled */
    function text(key, values = {}) {
        return Object.entries(values).reduce((result, [name, content]) => result.replace(`{${name}}`, content), strings[key][language()]);
    }

    /* formatValue: locale-aware number with a fixed number of decimals */
    function formatValue(number, decimals = 2) {
        return new Intl.NumberFormat(language() === "fr" ? "fr-BE" : "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(number);
    }

    /* resetClock: back to t = 0, paused (main.js owns the clock) */
    function resetClock() {
        document.getElementById("reset_button").click();
    }

    /* currentParameters: full simulation parameters of the attempt */
    function currentParameters() {
        return { gravity: challenge.gravity, tension_max: challenge.tension_max, drop_count, ...resolveParameters(challenge, value) };
    }

    /* ensureRun: recompute the attempt once after any change (at most once per frame) */
    function ensureRun() {
        if (run_dirty) {
            run = simulateRun(currentParameters());
            run_dirty = false;
            recorded = false;
        }
    }

    /* configureInput: range, step, unit and value of the free-variable input */
    function configureInput() {
        const spec = VARIABLES[challenge.variable];
        for (const input of [elements.slider, elements.number]) {
            input.min = spec.min;
            input.max = spec.max;
            input.step = spec.step;
            input.value = value;
        }
        elements.unit.textContent = UNITS[challenge.variable];
    }

    /* newChallenge: draw a solvable challenge (the last value never wins the next one) */
    function newChallenge() {
        const previous = challenge === null ? null : { variable: challenge.variable, value };
        challenge = randomChallenge(Math.random, previous);
        const spec = VARIABLES[challenge.variable];
        if (previous === null || previous.variable !== challenge.variable) {
            value = spec.default_value;
        }
        value = Math.min(Math.max(value, spec.min), spec.max);
        pending_new_challenge = false;
        run_dirty = true;
        configureInput();
        updatePanel();
        resetClock();
    }

    /* outcomeKey: displayed result of the finished attempt */
    function outcomeKey() {
        return run.outcome === "success" && value < fillThreshold(challenge) ? "underfilled" : run.outcome;
    }

    /* recordAttempt: count the finished attempt; a success queues a new challenge */
    function recordAttempt() {
        recorded = true;
        attempts += 1;
        last_result = outcomeKey();
        last_tier_message = "";
        if (last_result === "success") {
            score += 1;
            if (MILESTONES.includes(score)) {
                last_tier_message = text("tier_reached", { tier: MILESTONES.indexOf(score) + 1 });
            }
            pending_new_challenge = true;
        }
        updatePanel();
    }

    /* dataLine: one line of the challenge data, "?" for the unknown */
    function dataLine(label, content, unknown = false) {
        const item = document.createElement("li");
        item.append(`${label} : `);
        const span = document.createElement("span");
        span.textContent = unknown ? "?" : content;
        if (unknown) {
            span.className = "unknown";
        }
        item.append(span);
        return item;
    }

    /* updatePanel: challenge data, input label and stats cards in the current language */
    function updatePanel() {
        last_language = language();
        for (const element of document.querySelectorAll("[data-game-i18n]")) {
            element.textContent = text(element.dataset.gameI18n);
        }
        elements.goal.textContent = text("goal");
        elements.assumption.textContent = text("assumption");
        if (challenge === null) {
            return;
        }
        elements.label.textContent = text(`variable_${challenge.variable}`);
        elements.fill_rule.textContent = challenge.variable === "mass" ? text("fill_rule") : "";
        elements.data.replaceChildren(
            dataLine(text("data_place"), `${text(`place_${challenge.place}`)}, g = ${formatValue(challenge.gravity)} m/s²`),
            dataLine(text("data_bar"), `L_b = ${formatValue(BAR_LENGTH)} m`),
            dataLine(text("data_bucket"), `d = ${formatValue(BUCKET.center_of_mass)} m`),
            dataLine(text("data_rope"), `L = ${formatValue(challenge.rope_length ?? 0)} m`, challenge.variable === "rope_length"),
            dataLine(text("data_mass"), `m = ${formatValue(challenge.mass ?? 0)} kg`, challenge.variable === "mass"),
            dataLine(text("data_speed"), `v₀ = ${formatValue(challenge.launch_speed ?? 0)} m/s`, challenge.variable === "launch_speed"),
            dataLine(text("data_tension"), `T_max = ${formatValue(challenge.tension_max, 0)} N`),
        );
        const next = nextMilestone(score);
        elements.objective.textContent = next === null ? text("all_tiers") : `${score} / ${next}`;
        elements.tier.textContent = String(MILESTONES.filter((milestone) => milestone <= score).length);
        elements.totals.textContent = `${score} / ${attempts}`;
        elements.rate.textContent = attempts === 0 ? "—" : `${formatValue(100 * score / attempts, 0)} %`;
        elements.result.textContent = last_result === null
            ? text("result_none")
            : text(`result_${last_result}`) + (last_tier_message ? ` — ${last_tier_message}` : "");
        elements.result.className = `game-value${last_result === null ? "" : (last_result === "success" ? " success" : " failure")}`;
    }

    /* setActive: enter or leave the game mode */
    function setActive(next) {
        active = next;
        document.body.classList.toggle("game-mode", active);
        elements.panel.hidden = !active;
        elements.tabs[0].classList.toggle("active", !active);
        elements.tabs[1].classList.toggle("active", active);
        if (active && challenge === null) {
            newChallenge();
        }
        run_dirty = true;
        resetClock();
    }

    /* createCard: stats card in the formula-card presentation */
    function createCard(key) {
        const card = document.createElement("div");
        card.className = "formula-card";
        const name = document.createElement("span");
        name.className = "name";
        name.dataset.gameI18n = key;
        const content = document.createElement("div");
        content.className = "game-value";
        card.append(name, content);
        elements.grid.append(card);
        return content;
    }

    /* buildDropRow: temporary test row — number of water drops (same water volume) */
    function buildDropRow() {
        const row = document.createElement("div");
        row.className = "parameter-row game-row";
        const head = document.createElement("div");
        head.className = "row-head";
        const label = document.createElement("label");
        label.htmlFor = "number_game_drops";
        label.dataset.gameI18n = "drop_count";
        const input = document.createElement("input");
        input.type = "number";
        input.id = "number_game_drops";
        input.min = 1;
        input.max = 200;
        input.step = 1;
        input.value = drop_count;
        input.addEventListener("change", () => {
            const next = Number(input.value);
            if (!Number.isInteger(next) || next < 1 || next > 200) {
                input.value = drop_count;
                return;
            }
            drop_count = next;
            run_dirty = true;
            resetClock();
        });
        head.append(label, input);
        row.append(head);
        return row;
    }

    /* buildInputRow: free-variable row (slider + number) with the challenge data */
    function buildInputRow() {
        const row = document.createElement("div");
        row.className = "parameter-row game-row";
        const head = document.createElement("div");
        head.className = "row-head";
        elements.label = document.createElement("label");
        elements.label.htmlFor = "slider_game_value";
        const wrap = document.createElement("div");
        wrap.className = "value-wrap";
        elements.number = document.createElement("input");
        elements.number.type = "number";
        elements.number.id = "number_game_value";
        elements.unit = document.createElement("span");
        elements.unit.className = "unit";
        wrap.append(elements.number, elements.unit);
        head.append(elements.label, wrap);
        elements.slider = document.createElement("input");
        elements.slider.type = "range";
        elements.slider.id = "slider_game_value";
        elements.fill_rule = document.createElement("div");
        elements.fill_rule.className = "game-data";
        elements.data = document.createElement("ul");
        elements.data.className = "game-data";
        row.append(head, elements.slider, elements.fill_rule, elements.data);
        document.getElementById("parameter_rows").append(row, buildDropRow());
        for (const [input, mirror] of [[elements.slider, elements.number], [elements.number, elements.slider]]) {
            input.addEventListener("input", () => {
                const spec = VARIABLES[challenge.variable];
                const next = Number(input.value);
                if (input.value === "" || !Number.isFinite(next) || next < spec.min || next > spec.max) {
                    return;
                }
                value = next;
                mirror.value = input.value;
                run_dirty = true;
                resetClock();
            });
        }
    }

    /* buildUi: mode tabs, free-variable row, stats panel in place of the formulas */
    function buildUi() {
        const tabs = document.createElement("div");
        tabs.className = "mode-tabs";
        elements.tabs = ["tab_simulation", "tab_game"].map((key, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.gameI18n = key;
            button.addEventListener("click", () => setActive(index === 1));
            tabs.append(button);
            return button;
        });
        elements.tabs[0].classList.add("active");
        document.getElementById("game_mode_mount").append(tabs);
        buildInputRow();

        elements.panel = document.createElement("section");
        elements.panel.className = "panel game-panel";
        elements.panel.hidden = true;
        const panel_head = document.createElement("div");
        panel_head.className = "panel-head";
        const title = document.createElement("h2");
        title.dataset.gameI18n = "panel_title";
        elements.goal = document.createElement("span");
        elements.goal.className = "game-data";
        const button = document.createElement("button");
        button.type = "button";
        button.id = "new_challenge_button";
        button.dataset.gameI18n = "new_challenge";
        button.addEventListener("click", newChallenge);
        panel_head.append(title, elements.goal, button);
        elements.grid = document.createElement("div");
        elements.grid.className = "formula-grid";
        elements.assumption = document.createElement("p");
        elements.assumption.className = "assumption";
        elements.panel.append(panel_head, elements.assumption, elements.grid);
        elements.objective = createCard("card_objective");
        elements.tier = createCard("card_tier");
        elements.totals = createCard("card_totals");
        elements.rate = createCard("card_rate");
        elements.result = createCard("card_result");
        document.querySelector(".formula-panel").before(elements.panel);
        updatePanel();
    }

    /* viewTransform: fixed world → screen mapping around the pivot */
    function viewTransform(canvas) {
        const scale = Math.min(canvas.width / (VIEW.right - VIEW.left), canvas.height / (VIEW.top - VIEW.bottom));
        const offset_x = (canvas.width - scale * (VIEW.right - VIEW.left)) / 2;
        return {
            scale,
            toScreenX: (x) => offset_x + (x - VIEW.left) * scale,
            toScreenY: (y) => canvas.height - (y - VIEW.bottom) * scale,
            bounds: {
                left: VIEW.left - offset_x / scale,
                right: VIEW.right + offset_x / scale,
                bottom: VIEW.bottom,
                top: VIEW.bottom + canvas.height / scale,
            },
        };
    }

    /* drawStand: floor and A-frame mast under the pivot */
    function drawStand(context, transform) {
        const ground_y = transform.toScreenY(0);
        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.18)";
        context.fillRect(0, ground_y, context.canvas.width, context.canvas.height - ground_y);
        context.strokeStyle = "rgba(120, 130, 145, 0.85)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, ground_y);
        context.lineTo(context.canvas.width, ground_y);
        context.stroke();
        context.strokeStyle = "#78909c";
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(transform.toScreenX(-0.45), ground_y);
        context.lineTo(transform.toScreenX(0), transform.toScreenY(PIVOT_HEIGHT));
        context.lineTo(transform.toScreenX(0.45), ground_y);
        context.stroke();
        context.restore();
    }

    /* drawBar: rigid bar from the pivot to its tip, with the pivot hub */
    function drawBar(context, transform, pivot, tip) {
        context.save();
        context.strokeStyle = "#455a64";
        context.lineWidth = 7;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(transform.toScreenX(pivot[0]), transform.toScreenY(pivot[1]));
        context.lineTo(transform.toScreenX(tip[0]), transform.toScreenY(tip[1]));
        context.stroke();
        context.fillStyle = "#263238";
        context.beginPath();
        context.arc(transform.toScreenX(pivot[0]), transform.toScreenY(pivot[1]), 7, 0, 2 * Math.PI);
        context.fill();
        context.restore();
    }

    /* drawRope: smooth curve through the rope nodes (midpoint quadratic splines) */
    function drawRope(context, transform, points) {
        const screen = points.map(([x, y]) => [transform.toScreenX(x), transform.toScreenY(y)]);
        context.save();
        context.strokeStyle = "#8d6e63";
        context.lineWidth = 3;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(screen[0][0], screen[0][1]);
        for (let i = 1; i < screen.length - 1; i++) {
            context.quadraticCurveTo(screen[i][0], screen[i][1], (screen[i][0] + screen[i + 1][0]) / 2, (screen[i][1] + screen[i + 1][1]) / 2);
        }
        context.lineTo(screen[screen.length - 1][0], screen[screen.length - 1][1]);
        context.stroke();
        context.restore();
    }

    /* drawBucket: open bucket in the frame handle → centre of mass, with its handle */
    function drawBucket(context, transform, handle, center, ink) {
        const length = Math.hypot(center[0] - handle[0], center[1] - handle[1]);
        const axis = [(center[0] - handle[0]) / length, (center[1] - handle[1]) / length];
        const normal = [-axis[1], axis[0]];
        const point = (along, across) => [
            transform.toScreenX(handle[0] + along * axis[0] + across * normal[0]),
            transform.toScreenY(handle[1] + along * axis[1] + across * normal[1]),
        ];
        const wall = BUCKET.half_width + 0.012;
        const top_left = point(BUCKET.rim, -wall - 0.01);
        const top_right = point(BUCKET.rim, wall + 0.01);
        const outline = [top_left, point(BUCKET.bottom + 0.012, -wall + 0.012), point(BUCKET.bottom + 0.012, wall - 0.012), top_right];
        const tip = point(0, 0);
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(top_left[0], top_left[1]);
        context.quadraticCurveTo(2 * tip[0] - (top_left[0] + top_right[0]) / 2, 2 * tip[1] - (top_left[1] + top_right[1]) / 2, top_right[0], top_right[1]);
        context.stroke();
        context.fillStyle = "rgba(176, 190, 197, 0.5)";
        context.strokeStyle = "#546e7a";
        context.lineWidth = 3;
        context.lineJoin = "round";
        context.beginPath();
        outline.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
        context.fill();
        context.stroke();
        context.restore();
    }

    /* drawDrops: water drops as discs */
    function drawDrops(context, transform, drops, radius) {
        context.save();
        context.fillStyle = "#1e88e5";
        context.strokeStyle = "#0d47a1";
        context.lineWidth = 1;
        for (const [x, y] of drops) {
            context.beginPath();
            context.arc(transform.toScreenX(x), transform.toScreenY(y), radius * transform.scale, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
        }
        context.restore();
    }

    /* drawForces: the only forces on the bucket — its weight P and the rope
       tension T at the handle (same scale), the rope being pulled by the bar */
    function drawForces(context, transform, frame, parameters) {
        const draw = globalThis.canvas_draw;
        const center = frame.nodes[CENTER];
        const handle = frame.nodes[HANDLE];
        const rope = frame.nodes[HANDLE - 1];
        const scale = 0.7 * transform.scale / challenge.tension_max;
        const style = { font: `bold ${Math.round(13 * ui_scale)}px system-ui, sans-serif`, line_width: 2.5 * ui_scale };
        draw.drawVector(context, transform.toScreenX(center[0]), transform.toScreenY(center[1]), 0, parameters.mass * parameters.gravity * scale, { ...style, color: WEIGHT_COLOR, label: "P" });
        if (frame.tension > 0 && !frame.snapped) {
            const length = Math.hypot(rope[0] - handle[0], rope[1] - handle[1]) || 1;
            draw.drawVector(context, transform.toScreenX(handle[0]), transform.toScreenY(handle[1]),
                (rope[0] - handle[0]) / length * frame.tension * scale, -(rope[1] - handle[1]) / length * frame.tension * scale,
                { ...style, color: TENSION_COLOR, label: "T" });
        }
    }

    /* drawStatus: phase of the attempt, turn counter, live tension, and the result
       once its time has come */
    function drawStatus(context, frame, time, ink) {
        const line = (k) => ui_scale * (12 + 18 * k);
        context.save();
        context.font = `bold ${Math.round(13 * ui_scale)}px system-ui, sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillStyle = ink;
        const phase = frame.released
            ? `${text("phase_free", { v: formatValue(run.launch_speed, 2) })} — ${text("turns", { count: formatValue(Math.min(frame.turns, WIN_TURNS), 2) })}`
            : text(`phase_${frame.motor_phase}`);
        context.fillText(phase, line(0), line(0));
        context.fillStyle = TENSION_COLOR;
        context.fillText(`T = ${formatValue(frame.snapped ? 0 : frame.tension, 1)} N  (T_max = ${formatValue(challenge.tension_max, 0)} N)`, line(0), line(1));
        if (time >= run.event_time - 1e-9) {
            const key = outcomeKey();
            context.font = `bold ${Math.round(22 * ui_scale)}px system-ui, sans-serif`;
            context.textAlign = "center";
            context.fillStyle = key === "success" ? SUCCESS_COLOR : FAILURE_COLOR;
            context.fillText(text(`result_${key}`), context.canvas.width / 2, line(0));
        }
        context.restore();
    }

    /* overlay: whole game scene at main.js's clock; true when the game painted */
    function overlay(context, payload) {
        if (!active) {
            return false;
        }
        if (language() !== last_language) {
            updatePanel();
        }
        if (pending_new_challenge && payload.time === 0 && last_time > 0) {
            newChallenge();
        }
        ensureRun();
        const time = Math.min(payload.time, run.duration);
        if (!recorded && time >= run.duration - 1e-9 && last_time < time) {
            recordAttempt();
        }
        last_time = payload.time;

        const canvas = context.canvas;
        const ink = matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
        const transform = viewTransform(canvas);
        ui_scale = Math.min(Math.max(Math.min(canvas.width / UI_REFERENCE_WIDTH, canvas.height / UI_REFERENCE_HEIGHT), 1), 1.8);
        const frame = frameAt(run, time);
        context.clearRect(0, 0, canvas.width, canvas.height);
        globalThis.canvas_draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds, { font: `${Math.round(11 * ui_scale)}px system-ui, sans-serif` });
        drawStand(context, transform);
        drawRope(context, transform, frame.nodes.slice(frame.snapped ? 2 : 1, HANDLE + 1));
        drawBar(context, transform, frame.nodes[0], frame.nodes[1]);
        drawDrops(context, transform, frame.drops, frame.drop_radius);
        drawBucket(context, transform, frame.nodes[HANDLE], frame.nodes[CENTER], ink);
        drawForces(context, transform, frame, currentParameters());
        drawStatus(context, frame, time, ink);
        return true;
    }

    buildUi();
    globalThis.loop_wagon_game_overlay = overlay;
    globalThis.loop_wagon_game_duration = () => {
        if (!active) {
            return null;
        }
        ensureRun();
        return run.duration;
    };
})();
