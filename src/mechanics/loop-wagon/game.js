/*
 * game.js — EXPERIMENTAL "bucket on a rope" game mode for the wagon loop
 * exercise. It is the wagon's loop with a rope instead of a rail: the water
 * stays in iff the rope stays taut at the top, T_s = m (v₀²/R − 5 g) ≥ 0 ⇔
 * v₀² ≥ 5 g R (the counterpart of h ≥ 5R/2), and the rope snaps iff its
 * tension exceeds T_max, at the bottom T = m (v₀²/R + g). The student sets the
 * ONE free variable of each challenge (v₀, L or m — the bucket must then be
 * filled to at least 90 % of the largest mass the rope holds) so that the
 * bucket makes 2 full turns without losing a drop; result "réussi" / "raté".
 * Setup: a rigid bar (L_b = 0.9 m, 0.3 kg) turns on a frictionless pivot; a
 * flexible inextensible rope (L = 0.15–0.6 m, 0.15 kg/m, 10 links that may
 * shorten but never stretch) hangs from its tip and is tied to the bail of a
 * rigid cylindrical bucket (inner Ø 26 cm, 24 cm deep, 12.7 L, shell 0.45 kg with its moment
 * of inertia, bail 0.05 kg on 15 cm, hinged at the ears with a little
 * friction). The water, m − 0.5 kg at 1 kg/L, is a set of balls (10 by default,
 * each m_eau/n, hexagonal rows 8 % apart, the pile as high as the water) that roll without friction on
 * the walls, push each other and push the bucket; R is the distance from the
 * pivot to the centre of mass of the filled bucket at rest, computed from those
 * very drops. Air is neglected.
 * Every force on the bucket comes through the bar and the rope: at t = 0
 * everything hangs at rest, then a motor at the pivot drives the bar — swings
 * at the pendulum's own rhythm up to about 70°, then, from a backswing, a throw
 * that brings the energy of the bucket's centre of mass to E* by +90°, holds it
 * over the top, lines the bar up over the last 60° and lets it go as the bucket
 * passes the lowest point; v₀ is the speed of the centre of mass measured at
 * that instant. E* is found by shooting (secant, cheap shots that stop at the
 * release) aiming at 0.01 % on the measured v₀ (reached within about 0.5 % with
 * the default 10 drops, 0.05 % with many small ones: the sloshing makes the
 * outcome slightly chaotic in E*; never kept
 * more than 0.1 % too fast); the two
 * free turns then start exactly as in the theory. The motor never pushes the
 * bucket itself: it sets the bar's lead δ over the bucket so that the rope,
 * pulling from the bar's tip, makes the angle ψ with the bucket's inward radial
 * that gives the wanted tangential pull (L_b sin(δ + ψ) = r sin(ψ)).
 * Simulation (pure, deterministic, also used by the solvability checker):
 * extended position-based dynamics with small steps (at least 1200 substeps/s
 * during the swings and 2400 from the throw on, both fast enough for the
 * transverse waves of the rope; zero compliance). One chain: fixed pivot → bar
 * tip (effective mass m_b/3, weight m_b g/2) → rope nodes → handle (bail top) →
 * the ears of the rigid bucket; all links projected at once by a direct solve
 * of the tridiagonal system of their Lagrange multipliers (Thomas algorithm,
 * active set for the one-sided rope links), the bucket entering with its
 * generalised inverse mass 1/M + (r × n)²/I, M and I including the water at
 * rest in it (implicit coupling: no added-mass instability). Water: a pass
 * from the bottom up (shock propagation: the pressure of a resting stack
 * reaches the bottom at once) against smooth walls that hold still, a drop
 * landing from flight kicks the shell back (momentum conserved), a viscous
 * drag (8 s⁻¹) of the drops in contact relative to the wall; a drop whose
 * centre crosses the rim plane is lost. Friction torque pairs at the bar tip
 * and at the ears (8 s⁻¹, momentum conserved, energy only removed). The rope
 * tension is T = −λ/Δt² of its most loaded link, low-pass filtered over 20 ms.
 * Measured against the theory (see the report): success threshold within
 * −6 %/+6 % of √(5 g R) (within ±1.3 % on most Earth and Mars setups, up to
 * +5.5 % on the Moon), peak tension 0.96–1.34 times the ideal bottom tension
 * (the bucket rocks on its ears; a slack rope snaps taut after the top). The game
 * fails an attempt when a drop crosses the rim, not when T vanishes at the top.
 * Every challenge is provably solvable: constructive generation around a
 * reference solution, then the pure checker isChallengeFeasible replays the full
 * simulation, wind-up included (the pumping does not depend on v₀: it is
 * simulated once per setup and cloned for every probe), at both ends and in the
 * middle of the guaranteed window (v₀ at least 4 % above √(5 g R), the bottom
 * tension, rope load included, at most 0.7 T_max), rejection sampling with a
 * deterministic fallback, Monte-Carlo tests. Milestone tiers as elsewhere. On
 * the page, attempts and challenges are computed in a Web Worker built from
 * physicsModule's source (on the page itself if the browser refuses it).
 * Self-contained: to remove, delete this file, its test file, the GAME MODE
 * blocks in index.html and the lines marked "Game mode hook" in main.js.
 * Integration surface: the "game-mode" body class (set here),
 * globalThis.loop_wagon_game_overlay (called by main.js each frame; returns
 * true when it painted the scene) and globalThis.loop_wagon_game_duration
 * (run length used by main.js for its clock, 0 while an attempt is computed).
 * Pure logic is exposed as globalThis.loop_wagon_game.
 */
(() => {
    /* physicsModule: the whole pure model (constants, theory, simulation,
       challenges); returns the public API. Self-contained — its source text
       also builds the Web Worker that computes the attempts off the page */
    function physicsModule() {
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
            mass: { weight: 3, min: 0.6, max: 8, step: 0.01, default_value: 2 },
        };
        const VARIABLE_KEYS = Object.keys(VARIABLES);
        const BAR_LENGTH = 0.9;
        const BAR_MASS = 0.3;
        const BAR_WEIGHT_FACTOR = 1.5;
        const PIVOT_HEIGHT = 1.95;
        const ROPE_LINKS = 10;
        const ROPE_LINEAR_DENSITY = 0.15;
        const BUCKET = { radius: 0.13, depth: 0.24, bail: 0.15, shell_mass: 0.45, bail_mass: 0.05 };
        const EMPTY_MASS = BUCKET.shell_mass + BUCKET.bail_mass;
        const SIDE_SHARE = 2 * BUCKET.depth / (2 * BUCKET.depth + BUCKET.radius);
        const SHELL_CENTER = SIDE_SHARE * BUCKET.depth / 2 + (1 - SIDE_SHARE) * BUCKET.depth;
        const SHELL_INERTIA = BUCKET.shell_mass * (
            SIDE_SHARE * (BUCKET.radius ** 2 / 2 + BUCKET.depth ** 2 / 12 + (BUCKET.depth / 2 - SHELL_CENTER) ** 2)
            + (1 - SIDE_SHARE) * (BUCKET.radius ** 2 / 4 + (BUCKET.depth - SHELL_CENTER) ** 2));
        const WATER_DENSITY = 1000;
        const DEFAULT_DROP_COUNT = 10;
        const DROP_GAP = 1.08;
            const CONTACT_GAP = 0.05;
        const MAX_DROP_PUSH = 0.5;
        const WATER_DRAG_RATE = 8;
        const SUBSTEP_RATE = 2400;
        const WINDUP_SUBSTEP_RATE = 1200;
        const FRAME_RATE = 60;
        const TENSION_FILTER_SECONDS = 0.02;
        const WIN_TURNS = 2;
        const POST_EVENT_SECONDS = 1.6;
        const MAX_RUN_SECONDS = 30;
        const WINDOW_MARGIN = 0.04;
        const TENSION_SHARE = 0.7;
        const MINIMUM_RELATIVE_WINDOW = 0.05;
        const MASS_FILL_RATIO = 0.9;
        const HALF_FULL = [0.4, 0.58];
        const FALLBACK_CHALLENGES = [
            { variable: "launch_speed", place: "earth", gravity: 9.81, launch_speed: null, rope_length: 0.4, mass: 6.9, tension_max: 711 },
            { variable: "launch_speed", place: "mars", gravity: 3.71, launch_speed: null, rope_length: 0.5, mass: 6.9, tension_max: 269 },
        ];
        const PIVOT = 0;
        const TIP = 1;
        const HANDLE = ROPE_LINKS + 1;
        const ATTACH = ROPE_LINKS + 2;
        const FIRST_ROPE_LINK = 1;
        const MIN_ROPE_LINKS = 2;
        const MAX_ROPE_LINKS = 40;
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
        const ALIGN_ANGLE = 60 * Math.PI / 180;
        const ALIGN_TANGENT = 0.05;
        const SPEED_TOLERANCE = 1e-4;
        const MISSED_SHOT_STEP = 0.1;
        const MAX_OVERSHOOT = 1e-3;
        const MAX_SHOTS = 8;
        const SWING_BACK_ANGLE = 0.1;
        const PUMP_CACHE_SIZE = 64;
        const PUMP_CACHE = new Map();
        const LAYOUT_CACHE = new Map();
        let progress_hook = null;
        let progress_scope = { offset: 0, scale: 1, label: 0 };
        let progress_tick = 0;

        /* setProgressHook: hook(fraction, label) told how far the current
           computation is (testing aid; the label is the candidate number while a
           challenge is drawn, 0 otherwise); null to stop */
        function setProgressHook(hook) {
            progress_hook = hook;
        }

        /* report: fraction ∈ [0, 1] of the current stage, mapped to the whole computation */
        function report(fraction) {
            if (progress_hook !== null) {
                progress_hook(progress_scope.offset + progress_scope.scale * Math.min(Math.max(fraction, 0), 1), progress_scope.label);
            }
        }

        /* inStage: run task as the share [base, base + span] of the current stage */
        function inStage(base, span, task, label = progress_scope.label) {
            const saved = progress_scope;
            progress_scope = { offset: saved.offset + saved.scale * base, scale: saved.scale * span, label };
            try {
                return task();
            } finally {
                progress_scope = saved;
            }
        }

        /* waterMass: water in a filled bucket of total mass m (empty bucket 0.5 kg: shell 0.45 kg, bail 0.05 kg) */
        function waterMass(mass) {
            return Math.max(mass - EMPTY_MASS, 0);
        }

        /* fillHeight: water depth f = V/(π a²) in the cylindrical bucket, V = m_eau/ρ_eau */
        function fillHeight(mass) {
            return waterMass(mass) / (WATER_DENSITY * Math.PI * BUCKET.radius ** 2);
        }

        /* waterLayout: the water as n drops (10 by default), each carrying m_eau/n,
           at rest in hexagonal rows on the bottom with an 8 % gap between drops (no
           drop starts squeezed between its neighbours or the walls); the radius is
           the largest that keeps the pile no taller than the real water depth
           f = V/(π a²) (bisection), so the water level depends on the mass only, not
           on the number of drops. Cached per (m, n). along: mean depth of the drop
           centres below the ears */
        function waterLayout(mass, drop_count = null) {
            const count = drop_count > 0 ? Math.round(drop_count) : DEFAULT_DROP_COUNT;
            const key = `${mass}|${count}`;
            if (!LAYOUT_CACHE.has(key)) {
                if (LAYOUT_CACHE.size >= PUMP_CACHE_SIZE) {
                    LAYOUT_CACHE.delete(LAYOUT_CACHE.keys().next().value);
                }
                LAYOUT_CACHE.set(key, computeLayout(mass, count));
            }
            return LAYOUT_CACHE.get(key);
        }

        /* computeLayout: see waterLayout */
        function computeLayout(mass, count) {
            const water = waterMass(mass);
            if (water <= 0) {
                return { count: 0, radius: 0.01, drop_mass: 0, along: BUCKET.depth, positions: [] };
            }
            const fill = fillHeight(mass);
            let low = 0;
            let high = BUCKET.radius / 3;
            for (let i = 0; i < 40; i++) {
                const middle = (low + high) / 2;
                if (stackHeight(dropPositions(count, middle), middle) <= fill) {
                    low = middle;
                } else {
                    high = middle;
                }
            }
            const radius = low;
            const positions = dropPositions(count, radius);
            const along = positions.reduce((sum, [, depth]) => sum + depth, 0) / count;
            return { count, radius, drop_mass: water / count, along, positions };
        }

        /* stackHeight: height of the pile of drops above the bottom */
        function stackHeight(positions, radius) {
            return BUCKET.depth - Math.min(...positions.map(([, depth]) => depth)) + radius;
        }

        /* rowLength: drops of radius ρ, 2 ρ × 1.08 apart, that fit across the inner
           width 2 a with at least 0.2 ρ to spare (a row never touches both walls) */
        function rowLength(radius) {
            return Math.max(1, Math.floor((2 * BUCKET.radius - 2.2 * radius) / (2 * radius * DROP_GAP) + 1));
        }

        /* dropPositions: (across, depth below the ears) of n drops at rest in hexagonal
           rows on the bottom, alternating n_row and n_row − 1 drops 2 ρ × 1.08 apart,
           each row centred; an incomplete top row takes the middle places of its full
           row (so that it sits in the hollows of the row below); a single column is
           stacked 2 ρ × 1.08 apart */
        function dropPositions(count, radius) {
            const per_row = rowLength(radius);
            const spacing = 2 * radius * DROP_GAP;
            const positions = [];
            const row_step = per_row > 1 ? Math.sqrt(3) / 2 * spacing : spacing;
            for (let row = 0; positions.length < count; row++) {
                const full = per_row > 1 && row % 2 === 1 ? per_row - 1 : per_row;
                const in_row = Math.min(full, count - positions.length);
                const start = Math.floor((full - in_row) / 2);
                for (let k = start; k < start + in_row; k++) {
                    positions.push([(k - (full - 1) / 2) * spacing, BUCKET.depth - radius - row * row_step]);
                }
            }
            return positions;
        }

        /* bucketRadius: R, pivot → centre of mass of the filled bucket hanging at rest
           (bail at the rope's end L_b + L, shell centre s_c below the ears, water
           centre at the mean depth of its drops) */
        function bucketRadius(rope_length, mass, drop_count = null) {
            const handle = BAR_LENGTH + rope_length;
            const ears = handle + BUCKET.bail;
            const water = waterMass(mass);
            return (BUCKET.bail_mass * handle + BUCKET.shell_mass * (ears + SHELL_CENTER) + water * (ears + waterLayout(mass, drop_count).along))
                / (EMPTY_MASS + water);
        }

        /* tensionPerMass: T/m = v²/R + g cos(θ) = v₀²/R + g (3 cos(θ) − 2), θ from the
           lowest point, energy v² = v₀² − 2 g R (1 − cos(θ)) (massless rope and bar) */
        function tensionPerMass(gravity, radius, launch_speed, theta) {
            return launch_speed * launch_speed / radius + gravity * (3 * Math.cos(theta) - 2);
        }

        /* idealWindow: v₀ interval of the massless-rope pendulum, T ≥ 0 at the top
           (v₀ ≥ √(5 g R)) and T ≤ T_max at the bottom (v₀ ≤ √((T_max/m − g) R)) */
        function idealWindow(gravity, rope_length, mass, tension_max) {
            const radius = bucketRadius(rope_length, mass);
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

        /* winningWindow: values of the free variable guaranteed to win, from the
           ideal conditions with v₀ kept 4 % above the water limit (q = 1.04; the
           simulated limit lies within about ±6 % of √(5 g R): the checker replays
           every challenge) and the bottom tension,
           rope load included, below 0.7 T_max (the simulated peak reaches 1.34 times
           the ideal bottom tension, when the slack rope snaps taut after the top):
           v₀: q √(5 g R) ≤ v₀ ≤ √((0.7 T_max − (m + μL) g) / (m/R + μL r_mid/R²))
           L:  R = R(0, m) + L between the shortest rope that holds and the longest
               that keeps the water (v₀² ≥ 5 g R q²), within the input range
           m:  0.9 m_max ≤ m ≤ m_max, the heaviest bucket the rope holds (R depends
               on m through the water's centre; fill the bucket; needs v₀ ≥ q √(5 g R)
               at both ends) */
        function winningWindow(challenge) {
            const gravity = challenge.gravity;
            const low = (1 + WINDOW_MARGIN) ** 2;
            const allowed = TENSION_SHARE * challenge.tension_max;
            const empty = { minimum: Infinity, maximum: -Infinity };
            if (challenge.variable === "launch_speed") {
                const radius = bucketRadius(challenge.rope_length, challenge.mass);
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
                const longest = speed_squared / (5 * gravity * low) - bucketRadius(0, challenge.mass);
                return shortest === null ? empty : {
                    minimum: Math.max(shortest, VARIABLES.rope_length.min),
                    maximum: Math.min(longest, VARIABLES.rope_length.max),
                };
            }
            const mass_max = heaviestBucket(challenge, allowed);
            const keeps_water = (mass) => speed_squared >= 5 * gravity * bucketRadius(challenge.rope_length, mass) * low;
            if (mass_max === null || !keeps_water(mass_max) || !keeps_water(MASS_FILL_RATIO * mass_max)) {
                return empty;
            }
            return { minimum: MASS_FILL_RATIO * mass_max, maximum: mass_max };
        }

        /* bottomTension: ideal bottom tension at the bar end, m (v₀²/R + g) + μ L (ω² r_milieu + g),
           ω = v₀/R, r_milieu = L_b + L/2 (rigid rotation, R from L and m) */
        function bottomTension(rope_length, mass, speed_squared, gravity) {
            const radius = bucketRadius(rope_length, mass);
            return mass * (speed_squared / radius + gravity)
                + ROPE_LINEAR_DENSITY * rope_length * (speed_squared / (radius * radius) * (BAR_LENGTH + rope_length / 2) + gravity);
        }

        /* shortestRope: smallest L whose bottom tension stays within the allowed
           tension (bisection, the tension decreases with L over the input range);
           null if even the longest rope is too loaded */
        function shortestRope(challenge, allowed) {
            const speed_squared = challenge.launch_speed * challenge.launch_speed;
            const tension = (rope_length) => bottomTension(rope_length, challenge.mass, speed_squared, challenge.gravity);
            return bisect((rope_length) => tension(rope_length) > allowed, 0, 3, true);
        }

        /* heaviestBucket: largest m (empty bucket at least) whose bottom tension stays
           within the allowed tension (bisection, the tension grows with m); null if
           even the empty bucket is too heavy */
        function heaviestBucket(challenge, allowed) {
            const speed_squared = challenge.launch_speed * challenge.launch_speed;
            const tension = (mass) => bottomTension(challenge.rope_length, mass, speed_squared, challenge.gravity);
            return bisect((mass) => tension(mass) <= allowed, EMPTY_MASS, 100, false);
        }

        /* bisect: boundary of a predicate true below it and false above it on
           [low, high] — the smallest value where it is false (falling = true), or
           the largest where it is still true (falling = false); null when the
           wanted side is empty */
        function bisect(predicate, low, high, falling) {
            if (falling ? predicate(high) : !predicate(low)) {
                return null;
            }
            for (let i = 0; i < 60; i++) {
                const middle = (low + high) / 2;
                if (predicate(middle)) {
                    low = middle;
                } else {
                    high = middle;
                }
            }
            return falling ? high : low;
        }

        /* initialState: everything at rest, hanging straight down, the bar held by the
           motor (tip with zero inverse mass until it lets go). Chain: pivot, tip, the
           rope nodes (the last one, the handle, carries the bail), then the attach
           point at the bucket's ears, which follows the rigid bucket. Water drops
           settled on the bottom in hexagonal rows */
        function initialState(parameters) {
            const rope_links = ropeLinks(parameters);
            const link_length = parameters.rope_length / rope_links;
            const node_mass = ROPE_LINEAR_DENSITY * link_length;
            const ears = BAR_LENGTH + parameters.rope_length + BUCKET.bail;
            const nodes = [point(0, PIVOT_HEIGHT, 0), point(0, PIVOT_HEIGHT - BAR_LENGTH, 0)];
            for (let i = 1; i <= rope_links; i++) {
                nodes.push(point(0, PIVOT_HEIGHT - BAR_LENGTH - i * link_length, 1 / (i === rope_links ? node_mass + BUCKET.bail_mass : node_mass)));
            }
            nodes.push(point(0, PIVOT_HEIGHT - ears, 0));
            const body = { ...point(0, PIVOT_HEIGHT - ears - SHELL_CENTER, 0), angle: 0, previous_angle: 0, angular_velocity: 0 };
            const layout = waterLayout(parameters.mass, parameters.drop_count);
            const drops = settledDrops(PIVOT_HEIGHT - ears, layout);
            return {
                nodes,
                body,
                drops,
                drop_radius: layout.radius,
                drop_mass: layout.drop_mass,
                link_lengths: [BAR_LENGTH, ...new Array(rope_links).fill(link_length), BUCKET.bail],
                rope_flags: [false, ...new Array(rope_links).fill(true), false],
                snapped: false,
                mass: EMPTY_MASS + waterMass(parameters.mass),
                tension: (EMPTY_MASS + waterMass(parameters.mass) + ROPE_LINEAR_DENSITY * parameters.rope_length) * parameters.gravity,
                released: false,
                turned: 0,
                previous_angle: 0,
                work: createWorkspace(rope_links + 2, layout.count, layout.radius),
            };
        }

        /* point: material point at rest */
        function point(x, y, inverse_mass) {
            return { x, y, previous_x: x, previous_y: y, velocity_x: 0, velocity_y: 0, inverse_mass };
        }

        /* settledDrops: drops at rest on the bottom of the hanging bucket (ears at height ears_y) */
        function settledDrops(ears_y, layout) {
            return (layout.positions ?? []).map(([across, depth]) => {
                const drop = point(across, ears_y - depth, 0);
                drop.spilled = false;
                drop.resting = false;
                drop.supported = true;
                return drop;
            });
        }

        /* ropeLinks: number of rope links (10 by default; a test setting may change
           it, clamped to 2–40) — the chain is pivot, tip, the rope nodes, then the
           attach point at the ears (last node, nodes.length − 1) */
        function ropeLinks(parameters) {
            return Math.min(Math.max(Math.round(parameters.rope_links ?? ROPE_LINKS), MIN_ROPE_LINKS), MAX_ROPE_LINKS);
        }

        /* createWorkspace: preallocated arrays of the chain and water solvers (no allocation per substep) */
        function createWorkspace(link_count, drop_count, drop_radius) {
            const cells = (Math.ceil(BUCKET.radius / drop_radius) + 1) * (Math.ceil(BUCKET.depth / (2 * drop_radius)) + 1);
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
                touched: new Uint8Array(drop_count),
                flying: new Uint8Array(drop_count),
                next: new Int32Array(drop_count),
                along: new Float64Array(drop_count),
                across: new Float64Array(drop_count),
                cells: new Int32Array(cells),
                grid: { size: 0, columns: 0, rows: 0 },
                order: Int32Array.from({ length: drop_count }, (_, i) => i),
                depth: new Float64Array(drop_count),
                reaction: { x: 0, y: 0, moment: 0 },
                composite: { center_x: 0, center_y: 0, mass: 0, inertia: 0, attach_x: 0, attach_y: 0, shift_x: 0, shift_y: 0, turn: 0 },
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
           x_i −= w_i n_i Δλ_i and x_{i+1} += w_{i+1} n_i Δλ_i. With a composite (the
           rigid bucket and the water it carries), the last node is its attach point,
           of generalised inverse mass w = 1/M + (r × n)²/I (r from the composite's
           centre of mass): the correction translates the composite by n Δλ/M and turns
           it by (r × n) Δλ/I, accumulated in the composite. One-sided rope links
           form a linear complementarity problem (C_i ≤ 0, λ_i ≤ 0, λ_i C_i = 0), solved
           by active set: every unbroken link starts active (except a rope link already
           slack by more than 10⁻⁶ of its length), the rope link pushing the
           most (largest Δλ > 0) is released, an inactive rope link that the correction
           would stretch is taken back, until neither happens. Two linearisations per
           substep. Returns work.lambdas, λ of every link. */
        function solveChain(nodes, lengths, rope_flags, broken_link, work, composite = null) {
            const count = lengths.length;
            const last = nodes[count];
            const { unit_x, unit_y, violation, active, delta, lambdas } = work;
            lambdas.fill(0);
            for (let iteration = 0; iteration < 2; iteration++) {
                if (composite !== null) {
                    last.x = composite.attach_x;
                    last.y = composite.attach_y;
                }
                for (let i = 0; i < count; i++) {
                    const delta_x = nodes[i + 1].x - nodes[i].x;
                    const delta_y = nodes[i + 1].y - nodes[i].y;
                    const distance = Math.max(Math.sqrt(delta_x * delta_x + delta_y * delta_y), 1e-12);
                    unit_x[i] = delta_x / distance;
                    unit_y[i] = delta_y / distance;
                    violation[i] = distance - lengths[i];
                }
                if (composite !== null) {
                    const cross = (composite.attach_x - composite.center_x) * unit_y[count - 1] - (composite.attach_y - composite.center_y) * unit_x[count - 1];
                    last.inverse_mass = 1 / composite.mass + cross * cross / composite.inertia;
                }
                for (let i = 0; i < count; i++) {
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
                    if (composite !== null && i === count - 1) {
                        moveComposite(composite, unit_x[i], unit_y[i], delta[i]);
                        b.x = composite.attach_x;
                        b.y = composite.attach_y;
                    } else {
                        b.x += b.inverse_mass * unit_x[i] * delta[i];
                        b.y += b.inverse_mass * unit_y[i] * delta[i];
                    }
                    lambdas[i] += delta[i];
                }
            }
            return lambdas;
        }

        /* moveComposite: rigid correction of the composite by the impulse n Δλ at its
           attach point — translation n Δλ/M, rotation (r × n) Δλ/I about its centre */
        function moveComposite(composite, normal_x, normal_y, lambda) {
            const arm_x = composite.attach_x - composite.center_x;
            const arm_y = composite.attach_y - composite.center_y;
            const turn = (arm_x * normal_y - arm_y * normal_x) * lambda / composite.inertia;
            const shift_x = normal_x * lambda / composite.mass;
            const shift_y = normal_y * lambda / composite.mass;
            const cosine = Math.cos(turn);
            const sine = Math.sin(turn);
            composite.center_x += shift_x;
            composite.center_y += shift_y;
            composite.attach_x = composite.center_x + cosine * arm_x - sine * arm_y;
            composite.attach_y = composite.center_y + sine * arm_x + cosine * arm_y;
            composite.shift_x += shift_x;
            composite.shift_y += shift_y;
            composite.turn += turn;
        }

        /* bodyFrame: ears point E (rim centre), unit axis e (ears → bottom) and the
           across direction of the rigid bucket at angle φ (0 when hanging) */
        function bodyFrame(body) {
            const axis_x = Math.sin(body.angle);
            const axis_y = -Math.cos(body.angle);
            return { x: body.x - SHELL_CENTER * axis_x, y: body.y - SHELL_CENTER * axis_y, axis_x, axis_y, across_x: -axis_y, across_y: axis_x };
        }

        /* collideWithBucket: projection of a drop on the inner walls (bottom and
           both sides) of the bucket, which holds still during the water step (normal
           only: the walls are smooth); with react, the wall's opposite impulse
           − m_d Δx is added to work.reaction for the shell. A drop whose centre
           crosses the rim plane is spilled. Returns true when the drop touches a
           wall (gap below 5 % of its radius) */
        function collideWithBucket(drop, state, frame, react) {
            const radius = state.drop_radius;
            const reaction = state.work.reaction;
            let touched = false;
            for (let wall = 0; wall < 3; wall++) {
                const relative_x = drop.x - frame.x;
                const relative_y = drop.y - frame.y;
                const along = relative_x * frame.axis_x + relative_y * frame.axis_y;
                const across = relative_x * frame.across_x + relative_y * frame.across_y;
                if (along < 0) {
                    drop.spilled = true;
                    return touched;
                }
                const sign = wall === 0 ? 0 : (wall === 1 ? 1 : -1);
                const depth = wall === 0 ? along - (BUCKET.depth - radius) : sign * across - (BUCKET.radius - radius);
                if (depth <= -CONTACT_GAP * radius) {
                    continue;
                }
                touched = true;
                if (depth <= 0) {
                    continue;
                }
                const normal_x = wall === 0 ? -frame.axis_x : -sign * frame.across_x;
                const normal_y = wall === 0 ? -frame.axis_y : -sign * frame.across_y;
                drop.x += depth * normal_x;
                drop.y += depth * normal_y;
                if (!react) {
                    continue;
                }
                const push_x = -state.drop_mass * depth * normal_x;
                const push_y = -state.drop_mass * depth * normal_y;
                reaction.x += push_x;
                reaction.y += push_y;
                reaction.moment += drop.x * push_y - drop.y * push_x;
            }
            return touched;
        }

        /* applyReaction: the landing kicks of the water, impulse P = Σ(− m_d Δx) with
           moment M_O = Σ x × p about the origin, go to the bucket together with the
           water resting in it, one rigid body of mass M and inertia I about its
           centre c: displacement P/M and rotation (M_O − c × P)/I, applied to the
           shell and to the resting drops (momentum conserved; a light shell kicked
           alone would push the resting water without reaction and create energy);
           the chain solve that follows holds it back on the rope */
        function applyReaction(state) {
            const { work } = state;
            const reaction = work.reaction;
            if (reaction.x !== 0 || reaction.y !== 0 || reaction.moment !== 0) {
                const composite = buildComposite(state);
                composite.turn = (reaction.moment - (composite.center_x * reaction.y - composite.center_y * reaction.x)) / composite.inertia;
                composite.shift_x = reaction.x / composite.mass;
                composite.shift_y = reaction.y / composite.mass;
                composite.center_x += composite.shift_x;
                composite.center_y += composite.shift_y;
                carryComposite(state, composite, true);
            }
            work.reaction.x = 0;
            work.reaction.y = 0;
            work.reaction.moment = 0;
        }

        /* buildGrid: drops in the bucket sorted into cells of side 2ρ in the bucket's
           frame (linked lists work.cells → work.next), local coordinates kept */
        function buildGrid(state) {
            const { drops, drop_radius, work } = state;
            const frame = bodyFrame(state.body);
            const grid = work.grid;
            grid.size = 2 * drop_radius;
            grid.columns = Math.ceil(2 * BUCKET.radius / grid.size) + 1;
            grid.rows = Math.ceil(BUCKET.depth / grid.size) + 1;
            work.cells.fill(-1, 0, grid.columns * grid.rows);
            for (let i = 0; i < drops.length; i++) {
                work.next[i] = -1;
                if (drops[i].spilled) {
                    continue;
                }
                const relative_x = drops[i].x - frame.x;
                const relative_y = drops[i].y - frame.y;
                work.along[i] = relative_x * frame.axis_x + relative_y * frame.axis_y;
                work.across[i] = relative_x * frame.across_x + relative_y * frame.across_y;
                const cell = cellRow(work.along[i], grid) * grid.columns + cellColumn(work.across[i], grid);
                work.next[i] = work.cells[cell];
                work.cells[cell] = i;
            }
            return grid;
        }

        /* cellColumn, cellRow: grid cell of a local point (across, along), clamped to the grid */
        function cellColumn(across, grid) {
            return Math.min(Math.max(Math.floor((across + BUCKET.radius) / grid.size), 0), grid.columns - 1);
        }

        function cellRow(along, grid) {
            return Math.min(Math.max(Math.floor(along / grid.size), 0), grid.rows - 1);
        }

        /* separateDrops: non-overlap |p_i − p_j| ≥ 2 ρ between drops in the bucket
           (equal masses, half correction each, at most ρ/2 per pass so that a deep
           overlap is undone over a few steps instead of shooting the drops away),
           neighbours from the 3 × 3 cells of the grid */
        function separateDrops(state) {
            const { drops, drop_radius, work } = state;
            const grid = buildGrid(state);
            const minimum = 2 * drop_radius;
            for (let i = 0; i < drops.length; i++) {
                if (drops[i].spilled) {
                    continue;
                }
                const a = drops[i];
                const column = cellColumn(work.across[i], grid);
                const row = cellRow(work.along[i], grid);
                for (let r = Math.max(row - 1, 0); r <= Math.min(row + 1, grid.rows - 1); r++) {
                    for (let c = Math.max(column - 1, 0); c <= Math.min(column + 1, grid.columns - 1); c++) {
                        for (let j = work.cells[r * grid.columns + c]; j >= 0; j = work.next[j]) {
                            if (j <= i) {
                                continue;
                            }
                            const b = drops[j];
                            const delta_x = b.x - a.x;
                            const delta_y = b.y - a.y;
                            const distance_squared = delta_x * delta_x + delta_y * delta_y;
                            if (distance_squared >= minimum * minimum || distance_squared < 1e-24) {
                                continue;
                            }
                            const distance = Math.sqrt(distance_squared);
                            const push = Math.min(minimum - distance, MAX_DROP_PUSH * drop_radius) / 2 / distance;
                            a.x -= delta_x * push;
                            a.y -= delta_y * push;
                            b.x += delta_x * push;
                            b.y += delta_y * push;
                        }
                    }
                }
            }
        }

        /* settleWater: water pass against the bucket holding still, from the bottom
           up (shock propagation) — drops in order of depth along the bucket's
           axis, deepest first; each is
           projected on the walls, then off the deeper drops it overlaps, moving
           alone when the deeper drop rests on the bucket (water is nearly
           incompressible: the pressure reaches the bottom at once), sharing the
           correction otherwise. A drop rests on the bucket (supported) when it
           touches a wall or a deeper resting drop. Resting water belongs to the
           bucket's inertia in the chain solve (buildComposite); only a drop that was
           in flight (not supported before this pass) gives the shell the reaction
           − m_d Δx of its landing, and only when react is set */
        function settleWater(state, frame, react) {
            const { drops, drop_radius, work } = state;
            const grid = buildGrid(state);
            const reach = 2 * drop_radius * (1 + CONTACT_GAP);
            const minimum = 2 * drop_radius;
            const order = work.order;
            for (let i = 0; i < drops.length; i++) {
                work.flying[i] = drops[i].supported ? 0 : 1;
                drops[i].supported = false;
                work.touched[i] = 0;
                work.depth[i] = drops[i].spilled ? -Infinity : drops[i].x * frame.axis_x + drops[i].y * frame.axis_y;
            }
            for (let i = 1; i < order.length; i++) {
                const index = order[i];
                const depth = work.depth[index];
                let k = i - 1;
                while (k >= 0 && work.depth[order[k]] < depth) {
                    order[k + 1] = order[k];
                    k--;
                }
                order[k + 1] = index;
            }
            for (let n = 0; n < order.length; n++) {
                const j = order[n];
                const drop = drops[j];
                if (drop.spilled) {
                    break;
                }
                const reacting = react && work.flying[j] === 1;
                let supported = collideWithBucket(drop, state, frame, reacting);
                const column = cellColumn(work.across[j], grid);
                const row = cellRow(work.along[j], grid);
                for (let r = Math.max(row - 1, 0); r <= Math.min(row + 1, grid.rows - 1); r++) {
                    for (let c = Math.max(column - 1, 0); c <= Math.min(column + 1, grid.columns - 1); c++) {
                        for (let i = work.cells[r * grid.columns + c]; i >= 0; i = work.next[i]) {
                            if (!work.touched[i]) {
                                continue;
                            }
                            const lower = drops[i];
                            const delta_x = drop.x - lower.x;
                            const delta_y = drop.y - lower.y;
                            const distance_squared = delta_x * delta_x + delta_y * delta_y;
                            if (distance_squared > reach * reach || distance_squared < 1e-24) {
                                continue;
                            }
                            supported ||= lower.supported;
                            if (distance_squared >= minimum * minimum) {
                                continue;
                            }
                            const distance = Math.sqrt(distance_squared);
                            const push = Math.min(minimum - distance, MAX_DROP_PUSH * drop_radius) / distance;
                            if (!lower.supported) {
                                drop.x += delta_x * push / 2;
                                drop.y += delta_y * push / 2;
                                lower.x -= delta_x * push / 2;
                                lower.y -= delta_y * push / 2;
                                continue;
                            }
                            drop.x += delta_x * push;
                            drop.y += delta_y * push;
                            if (reacting) {
                                const push_x = -state.drop_mass * delta_x * push;
                                const push_y = -state.drop_mass * delta_y * push;
                                work.reaction.x += push_x;
                                work.reaction.y += push_y;
                                work.reaction.moment += lower.x * push_y - lower.y * push_x;
                            }
                        }
                    }
                }
                if (!drop.spilled) {
                    supported = collideWithBucket(drop, state, frame, reacting) || supported;
                }
                drop.supported = supported && !drop.spilled;
                work.touched[j] = 1;
            }
        }

        /* buildComposite: the shell and the water resting in it as the chain's last
           rigid body — mass M, centre of mass, inertia I about it, attach point at
           the ears; the chain's correction then moves the shell alone (carryComposite)
           and the walls bring the resting water along (second settleWater pass) */
        function buildComposite(state) {
            const { body, drops, drop_mass } = state;
            let mass = BUCKET.shell_mass;
            let moment_x = BUCKET.shell_mass * body.x;
            let moment_y = BUCKET.shell_mass * body.y;
            for (const drop of drops) {
                if (drop.supported) {
                    mass += drop_mass;
                    moment_x += drop_mass * drop.x;
                    moment_y += drop_mass * drop.y;
                }
            }
            const center_x = moment_x / mass;
            const center_y = moment_y / mass;
            let inertia = SHELL_INERTIA + BUCKET.shell_mass * ((body.x - center_x) ** 2 + (body.y - center_y) ** 2);
            for (const drop of drops) {
                if (drop.supported) {
                    inertia += drop_mass * ((drop.x - center_x) ** 2 + (drop.y - center_y) ** 2);
                }
            }
            const frame = bodyFrame(body);
            return Object.assign(state.work.composite, { center_x, center_y, mass, inertia, attach_x: frame.x, attach_y: frame.y, shift_x: 0, shift_y: 0, turn: 0 });
        }

        /* carryComposite: a rigid correction of the composite (rotation by the
           accumulated turn about its initial centre, then translation) applied to
           the shell — and, with with_water, to the drops resting in it */
        function carryComposite(state, composite, with_water = false) {
            const origin_x = composite.center_x - composite.shift_x;
            const origin_y = composite.center_y - composite.shift_y;
            const cosine = Math.cos(composite.turn);
            const sine = Math.sin(composite.turn);
            const carry = (item) => {
                const arm_x = item.x - origin_x;
                const arm_y = item.y - origin_y;
                item.x = composite.center_x + cosine * arm_x - sine * arm_y;
                item.y = composite.center_y + sine * arm_x + cosine * arm_y;
            };
            carry(state.body);
            state.body.angle += composite.turn;
            if (with_water) {
                for (const drop of state.drops) {
                    if (drop.supported) {
                        carry(drop);
                    }
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

        /* predictBody: the same for the rigid bucket, plus φ ← φ + ω Δt */
        function predictBody(body, gravity, dt) {
            predict(body, gravity, dt);
            body.previous_angle = body.angle;
            body.angle += body.angular_velocity * dt;
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

        /* dampEars: friction of the ears hinge between the bail (ears → handle) and
           the rigid shell — a torque pair: the couple +J on the shell, −J on the bail
           (impulse Q = −J r⊥/|r|² on the handle, −Q on the shell at the ears), so
           momentum is conserved; J makes the relative rotation ω_s − ω_bail decay at
           the given rate */
        function dampEars(state, rate, dt) {
            const handle = state.nodes[state.nodes.length - 2];
            const body = state.body;
            const frame = bodyFrame(body);
            const arm_x = handle.x - frame.x;
            const arm_y = handle.y - frame.y;
            const arm_squared = arm_x * arm_x + arm_y * arm_y;
            const ears_x = frame.x - body.x;
            const ears_y = frame.y - body.y;
            const relative = (handle_x, handle_y, body_x, body_y, spin) => {
                const ears_velocity_x = body_x - spin * ears_y;
                const ears_velocity_y = body_y + spin * ears_x;
                return spin - (arm_x * (handle_y - ears_velocity_y) - arm_y * (handle_x - ears_velocity_x)) / arm_squared;
            };
            const kicks = (couple) => {
                const impulse_x = couple * arm_y / arm_squared;
                const impulse_y = -couple * arm_x / arm_squared;
                return {
                    handle_x: impulse_x * handle.inverse_mass,
                    handle_y: impulse_y * handle.inverse_mass,
                    body_x: -impulse_x / BUCKET.shell_mass,
                    body_y: -impulse_y / BUCKET.shell_mass,
                    spin: (couple - (ears_x * impulse_y - ears_y * impulse_x)) / SHELL_INERTIA,
                };
            };
            const unit = kicks(1);
            const response = relative(unit.handle_x, unit.handle_y, unit.body_x, unit.body_y, unit.spin);
            if (!(response > 0)) {
                return;
            }
            const couple = -relative(handle.velocity_x, handle.velocity_y, body.velocity_x, body.velocity_y, body.angular_velocity) * (1 - Math.exp(-rate * dt)) / response;
            const kick = kicks(couple);
            handle.velocity_x += kick.handle_x;
            handle.velocity_y += kick.handle_y;
            body.velocity_x += kick.body_x;
            body.velocity_y += kick.body_y;
            body.angular_velocity += kick.spin;
        }

        /* dragWater: viscous drag (rate 8 s⁻¹) of the velocity of every drop in contact
           relative to the bucket wall at its place, two-way: the shell takes the
           opposite impulse at the drop's place */
        function dragWater(state, dt) {
            const body = state.body;
            const keep = Math.exp(-WATER_DRAG_RATE * dt);
            for (const drop of state.drops) {
                if (!drop.supported) {
                    continue;
                }
                const arm_x = drop.x - body.x;
                const arm_y = drop.y - body.y;
                const impulse_x = state.drop_mass * (body.velocity_x - body.angular_velocity * arm_y - drop.velocity_x) * (1 - keep);
                const impulse_y = state.drop_mass * (body.velocity_y + body.angular_velocity * arm_x - drop.velocity_y) * (1 - keep);
                drop.velocity_x += impulse_x / state.drop_mass;
                drop.velocity_y += impulse_y / state.drop_mass;
                body.velocity_x -= impulse_x / BUCKET.shell_mass;
                body.velocity_y -= impulse_y / BUCKET.shell_mass;
                body.angular_velocity -= (arm_x * impulse_y - arm_y * impulse_x) / SHELL_INERTIA;
            }
        }

        /* stepState: one substep — prediction (the motor places the bar tip while it
           drives it, driven_angle ≠ null), water pass (smooth walls holding still,
           drop against drop, landing kicks on the shell), chain projection with the
           shell and its resting water as the last rigid body, the correction moving
           the shell, a second water pass bringing the water along, floor, velocities from positions
           (v = Δx/Δt), joint friction, water drag; returns the raw rope tension,
           largest −λ/Δt² over the rope links (0 when slack or broken) */
        function stepState(state, gravity, dt, driven_angle = null) {
            const { nodes, body, drops, work } = state;
            if (driven_angle === null) {
                predict(nodes[TIP], BAR_WEIGHT_FACTOR * gravity, dt);
            } else {
                nodes[TIP].previous_x = nodes[TIP].x;
                nodes[TIP].previous_y = nodes[TIP].y;
                nodes[TIP].x = BAR_LENGTH * Math.sin(driven_angle);
                nodes[TIP].y = PIVOT_HEIGHT - BAR_LENGTH * Math.cos(driven_angle);
            }
            for (let i = TIP + 1; i < nodes.length - 1; i++) {
                predict(nodes[i], gravity, dt);
            }
            predictBody(body, gravity, dt);
            for (const drop of drops) {
                if (!drop.resting) {
                    predict(drop, gravity, dt);
                }
            }
            separateDrops(state);
            settleWater(state, bodyFrame(body), true);
            applyReaction(state);
            const composite = buildComposite(state);
            const lambdas = solveChain(nodes, state.link_lengths, state.rope_flags, state.snapped ? FIRST_ROPE_LINK : -1, work, composite);
            carryComposite(state, composite);
            settleWater(state, bodyFrame(body), false);
            for (let i = TIP + 1; i < nodes.length - 1; i++) {
                settleOnGround(nodes[i], 0.01);
            }
            if (state.snapped && body.y < BUCKET.depth) {
                body.y = BUCKET.depth;
                body.x = body.previous_x;
                body.angle = body.previous_angle;
            }
            for (const drop of drops) {
                if (drop.spilled && !drop.resting && settleOnGround(drop, state.drop_radius)) {
                    drop.resting = true;
                }
            }
            for (let i = TIP; i < nodes.length - 1; i++) {
                updateVelocity(nodes[i], dt);
            }
            updateVelocity(body, dt);
            body.angular_velocity = (body.angle - body.previous_angle) / dt;
            for (const drop of drops) {
                updateVelocity(drop, dt);
            }
            if (state.released && !state.snapped) {
                dampJoint(nodes[PIVOT], nodes[TIP], nodes[TIP + 1], HINGE_DAMPING_RATE, dt);
            }
            dampEars(state, HINGE_DAMPING_RATE, dt);
            dragWater(state, dt);
            if (state.snapped) {
                return 0;
            }
            let largest = 0;
            for (let i = FIRST_ROPE_LINK; i <= nodes.length - 3; i++) {
                largest = Math.max(largest, -lambdas[i]);
            }
            return largest / (dt * dt);
        }

        /* bucketCenter: centre of mass of the filled bucket — bail (at the handle),
           shell and the drops not lost — with its velocity and mass */
        function bucketCenter(state) {
            const handle = state.nodes[state.nodes.length - 2];
            const body = state.body;
            let mass = BUCKET.bail_mass + BUCKET.shell_mass;
            let x = BUCKET.bail_mass * handle.x + BUCKET.shell_mass * body.x;
            let y = BUCKET.bail_mass * handle.y + BUCKET.shell_mass * body.y;
            let velocity_x = BUCKET.bail_mass * handle.velocity_x + BUCKET.shell_mass * body.velocity_x;
            let velocity_y = BUCKET.bail_mass * handle.velocity_y + BUCKET.shell_mass * body.velocity_y;
            for (const drop of state.drops) {
                if (!drop.spilled) {
                    mass += state.drop_mass;
                    x += state.drop_mass * drop.x;
                    y += state.drop_mass * drop.y;
                    velocity_x += state.drop_mass * drop.velocity_x;
                    velocity_y += state.drop_mass * drop.velocity_y;
                }
            }
            return { x: x / mass, y: y / mass, velocity_x: velocity_x / mass, velocity_y: velocity_y / mass, mass };
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
            state.most_turned = Math.max(state.most_turned ?? 0, state.turned);
            return change;
        }

        /* bucketAngle: angle of the filled bucket's centre of mass around the pivot, from the lowest point */
        function bucketAngle(state) {
            const center = bucketCenter(state);
            return Math.atan2(center.x, PIVOT_HEIGHT - center.y);
        }

        /* bucketMotion: distance r of the bucket's centre of mass from the pivot, its
           angular speed (r × v)/r² and its energy per unit mass ½ v² + g (y − y_bas)
           from the lowest point of the circle of radius R */
        function bucketMotion(state, gravity, radius) {
            const center = bucketCenter(state);
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

        /* startThrow: switch the motor to the throw toward its target energy E* (set
           by the shooting in runAttempt), released at the lowest point after the top
           (θ = 360°) — or at θ = 0 when ½ v₀² ≤ 1.2 g R */
        function startThrow(motor, state, parameters, radius) {
            const motion = bucketMotion(state, parameters.gravity, radius);
            motor.phase = "throw";
            motor.start_angle = motor.bucket_angle;
            motor.start_energy = motion.energy;
            motor.release_angle = parameters.launch_speed ** 2 / 2 <= BOTTOM_RELEASE_RATIO * parameters.gravity * radius ? 0 : RELEASE_ANGLE;
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
                   E* the target energy, θ_r = 90°: feed-forward
                   tan(ψ) = (dE_d/dθ)/(2 E + g R (3 cos(θ) − 2)) plus (E_d − E)/(g R);
           hold  — after θ_r the curve is flat: the feedback keeps E = E* (it makes
                   up for the numerical and friction losses) through the top;
           align — over the last 60° before the lowest point (θ = 360°) the bar comes
                   back in line with the bucket, only a small feedback lead remains
                   (tan(ψ) = (E* − E)/(g R), |tan(ψ)| ≤ 0.05), and the motor lets go
                   as the bucket passes the lowest point. For ½ v₀² ≤ 1.2 g R (the
                   bucket cannot go over the top) the throw ends at the lowest point
                   instead, θ_r = 0: once the energy, with what the alignment will
                   still add, reaches E*, no lead, and release when the chain no
                   longer bends (< 3°, at most 0.6 s) */
        function motorLead(motor, state, parameters, radius, time) {
            const motion = bucketMotion(state, parameters.gravity, radius);
            const angle = motor.bucket_angle;
            const gravity_radius = parameters.gravity * radius;
            const inward = motion.distance * motion.angular_speed ** 2 + parameters.gravity * Math.cos(angle);
            const sine_limit = PULL_SAFETY * Math.min(BAR_LENGTH / motion.distance, 1);
            const tangent_limit = Math.min(sine_limit / Math.sqrt(1 - sine_limit * sine_limit), MAX_PULL_TANGENT);
            motor.previous_speed = motion.angular_speed;
            if (motor.phase === "align" && motor.release_angle === 0) {
                return 0;
            }
            let tangent;
            if (motor.phase === "align") {
                tangent = Math.min(Math.max(ENERGY_GAIN * (motor.target_energy - motion.energy) / gravity_radius, -ALIGN_TANGENT), ALIGN_TANGENT);
            } else if (motor.phase === "swing") {
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

        /* chainWobble: largest bend of the chain at the bar tip (bar / rope) and
           between the rope and the bucket's axis, in radians */
        function chainWobble(state) {
            const direction = (from, to) => Math.atan2(to.x - from.x, from.y - to.y);
            const bend = (first, second) => Math.abs(((second - first + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
            const nodes = state.nodes;
            const bar = direction({ x: 0, y: PIVOT_HEIGHT }, nodes[TIP]);
            const rope = direction(nodes[TIP], nodes[nodes.length - 2]);
            return Math.max(bend(bar, rope), bend(rope, state.body.angle));
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
            state.most_turned = 0;
            state.previous_angle = bucketAngle(state);
        }

        /* captureFrame: copy of the drawable state at a given time — chain nodes,
           bucket pose (centre of the shell, angle), centre of mass, drops */
        function captureFrame(state, time, motor) {
            const center = bucketCenter(state);
            return {
                time,
                released: state.released,
                motor_phase: motor === null ? "rest" : motor.phase,
                drop_radius: state.drop_radius,
                nodes: state.nodes.map((node) => [node.x, node.y]),
                bucket: [state.body.x, state.body.y, state.body.angle],
                center: [center.x, center.y],
                drops: state.drops.map((drop) => [drop.x, drop.y, drop.spilled]),
                tension: state.tension,
                snapped: state.snapped,
                turns: Math.max(state.turned, 0) / (2 * Math.PI),
            };
        }

        /* restFrame: drawable frame of the hanging system at rest (shown while an attempt is computed) */
        function restFrame(parameters) {
            return captureFrame(initialState(parameters), 0, null);
        }

        /* waveRate: substeps per second at least `minimum` and fast enough for the
           transverse waves of the rope under the tension T, rate ≥ 1.3 c/ℓ with
           c = √(T/μ) (a short rope under a heavy bucket), rounded up to 120 Hz */
        function waveRate(parameters, tension, minimum) {
            const wave = Math.sqrt(tension / ROPE_LINEAR_DENSITY) / (parameters.rope_length / ropeLinks(parameters));
            return stepFactor(parameters) * Math.max(minimum, Math.ceil(1.3 * wave / 120) * 120);
        }

        /* stepFactor: test setting dividing every time step (1 by default, 1–8) */
        function stepFactor(parameters) {
            return Math.min(Math.max(Math.round(parameters.step_factor ?? 1), 1), 8);
        }

        /* substepRate: substeps per second from the throw on — at least 2400, waves
           under T ≈ 1.3 m (v₀²/R + g) */
        function substepRate(parameters) {
            const radius = bucketRadius(parameters.rope_length, parameters.mass, parameters.drop_count);
            return waveRate(parameters, 1.3 * parameters.mass * (parameters.launch_speed ** 2 / radius + parameters.gravity), SUBSTEP_RATE);
        }

        /* windupRate: substeps per second during the pumping — at least 1200, waves
           under T ≈ 1.3 m g (3 − 2 cos(70°)) (bottom of a 70° swing); independent of
           v₀ and T_max, as the pumping cache requires */
        function windupRate(parameters) {
            return waveRate(parameters, 1.3 * parameters.mass * parameters.gravity * (3 - 2 * Math.cos(PUMP_AMPLITUDE)), WINDUP_SUBSTEP_RATE);
        }

        /* newAttempt: mutable context of one attempt (state, motor, clock, results);
           a ghost attempt only notes its failures and stops at the release (see runAttempt) */
        function newAttempt(parameters, record) {
            const state = initialState(parameters);
            const motor = {
                phase: "swing", angle: 0, rate: 0, lead: 0, bucket_angle: 0, previous_speed: 0,
                target_energy: parameters.launch_speed ** 2 / 2, start_angle: 0, start_energy: 0, release_angle: RELEASE_ANGLE, align_time: null,
            };
            return {
                state, motor, record, frames: [captureFrame(state, 0, motor)],
                outcome: "success", event_time: null, end_time: MAX_DRIVE_SECONDS + MAX_RUN_SECONDS,
                release_time: null, max_tension: 0, min_tension: Infinity,
                time: 0, frame_index: 0, previous_angle: 0,
                ghost: false, would_fail: false, forced_release: false, bottom_speed: null, measure_angle: null, measure_speed: 0,
            };
        }

        /* measureBottom: speed of the bucket's centre of mass at its first passage
           through the lowest point after the release (θ changes sign near 0),
           interpolated linearly between the two substeps around the crossing — for
           a release at θ = 0, which may come just after the lowest point */
        function measureBottom(attempt) {
            const center = bucketCenter(attempt.state);
            const angle = Math.atan2(center.x, PIVOT_HEIGHT - center.y);
            const speed = Math.hypot(center.velocity_x, center.velocity_y);
            const previous = attempt.measure_angle;
            if (previous !== null && Math.abs(angle) < 1 && Math.abs(previous) < 1 && (angle >= 0) !== (previous >= 0)) {
                attempt.bottom_speed = attempt.measure_speed + (speed - attempt.measure_speed) * previous / (previous - angle);
            }
            attempt.measure_angle = angle;
            attempt.measure_speed = speed;
        }

        /* advanceAttempt: run the attempt's substeps until its end — or, with
           stop_at_throw, until the pumping is over (before that substep: what happened
           so far does not depend on v₀), returning "throw"; watch_tension, if given,
           sees the filtered tension after every substep; a ghost attempt stops right
           after the release ("released") and only notes its failures (would_fail).
           Returns "end" otherwise.
           For a release at the lowest point after the top, v₀ is measured there:
           the speed of the centre of mass interpolated at θ = 360° between the two
           substeps around it, and the bar is let go on that substep */
        function advanceAttempt(attempt, parameters, stop_at_throw, watch_tension = null) {
            const radius = bucketRadius(parameters.rope_length, parameters.mass, parameters.drop_count);
            const free_rate = substepRate(parameters);
            const windup_rate = windupRate(parameters);
            const { state, motor } = attempt;
            while (attempt.time < attempt.end_time) {
                if (throwReady(motor, state, parameters, radius)) {
                    if (stop_at_throw) {
                        return "throw";
                    }
                    startThrow(motor, state, parameters, radius);
                }
                const dt = 1 / (motor.phase === "swing" ? windup_rate : free_rate);
                attempt.time += dt;
                if (progress_hook !== null && attempt.progress !== undefined && ++progress_tick % 600 === 0) {
                    report((attempt.time - attempt.progress.start) / (attempt.progress.end - attempt.progress.start));
                }
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
                    const previous_angle = motor.bucket_angle;
                    motor.bucket_angle += change;
                    attempt.previous_angle = angle;
                    const center = bucketCenter(state);
                    const speed = Math.hypot(center.velocity_x, center.velocity_y);
                    const over_top = motor.release_angle !== 0;
                    if (motor.phase === "throw" && change > 0 && (over_top
                        ? motor.bucket_angle >= 2 * Math.PI - ALIGN_ANGLE
                        : predictedEnergy(motor, state, parameters, radius) >= motor.target_energy || motor.bucket_angle >= LATEST_RELEASE_ANGLE)) {
                        motor.phase = "align";
                    }
                    if (motor.phase === "align" && motor.align_time === null) {
                        motor.align_time = time;
                    }
                    const at_bottom = over_top && motor.phase === "align" && previous_angle < 2 * Math.PI && motor.bucket_angle >= 2 * Math.PI;
                    const reached = at_bottom || (!over_top && motor.phase === "align"
                        && ((Math.abs(motor.lead) <= ALIGNED_LEAD && chainWobble(state) <= ALIGNED_WOBBLE) || time - motor.align_time >= MAX_ALIGN_SECONDS));
                    if (at_bottom) {
                        attempt.bottom_speed = attempt.measure_speed + (speed - attempt.measure_speed) * (2 * Math.PI - previous_angle) / (motor.bucket_angle - previous_angle);
                    }
                    attempt.measure_speed = speed;
                    if (reached || time >= MAX_DRIVE_SECONDS) {
                        releaseBar(state);
                        motor.phase = "free";
                        attempt.release_time = time;
                    }
                }
                const change = state.released ? trackTurns(state) : 0;
                if (state.released && attempt.bottom_speed === null && !attempt.forced_release) {
                    measureBottom(attempt);
                }
                const spilled = state.drops.some((drop) => drop.spilled);
                if (attempt.event_time === null) {
                    if (state.released) {
                        attempt.max_tension = Math.max(attempt.max_tension, state.tension);
                        attempt.min_tension = Math.min(attempt.min_tension, state.tension);
                    }
                    let failure = null;
                    if (state.tension > parameters.tension_max) {
                        failure = "snap";
                    } else if (spilled) {
                        failure = "spill";
                    } else if (state.released && state.turned < state.most_turned - SWING_BACK_ANGLE && state.turned < 2 * Math.PI) {
                        failure = "swing";
                    }
                    if (attempt.ghost) {
                        attempt.would_fail ||= failure !== null;
                    } else if (failure !== null) {
                        attempt.outcome = failure;
                        attempt.event_time = time;
                        attempt.end_time = attempt.record ? time + POST_EVENT_SECONDS : time;
                        if (failure === "snap") {
                            state.snapped = true;
                            state.tension = 0;
                        }
                        if (!state.released) {
                            releaseBar(state);
                            attempt.forced_release = true;
                            motor.phase = "free";
                            attempt.release_time = time;
                        }
                    } else if (state.released && state.turned >= WIN_TURNS * 2 * Math.PI) {
                        attempt.event_time = time;
                        attempt.end_time = time;
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
                if (attempt.ghost && state.released) {
                    return "released";
                }
            }
            return "end";
        }

        /* pumpedAttempt: the attempt at the end of the pumping, which depends neither
           on v₀ nor, unless the rope snaps, on T_max — simulated once per (g, L, m,
           drops, links, record) with an unbreakable rope, its peak tension kept;
           the caller clones it (structuredClone) for every shot, so that the
           checker's probes and the display replay only the throw; null if the
           pumping ended the run or would snap this rope (the caller then runs the
           attempt from t = 0) */
        function pumpedAttempt(parameters, record) {
            const key = [parameters.gravity, parameters.rope_length, parameters.mass, parameters.drop_count ?? 0, ropeLinks(parameters), stepFactor(parameters), record].join("|");
            if (!PUMP_CACHE.has(key)) {
                const pumping = { ...parameters, launch_speed: 0, tension_max: Infinity };
                const attempt = newAttempt(pumping, record);
                attempt.progress = { start: 0, end: 12 };
                let peak_tension = 0;
                const reached = advanceAttempt(attempt, pumping, true, (tension) => {
                    peak_tension = Math.max(peak_tension, tension);
                }) === "throw";
                if (PUMP_CACHE.size >= PUMP_CACHE_SIZE) {
                    PUMP_CACHE.delete(PUMP_CACHE.keys().next().value);
                }
                PUMP_CACHE.set(key, reached ? { attempt, peak_tension } : null);
            }
            const cached = PUMP_CACHE.get(key);
            return cached === null || cached.peak_tension > parameters.tension_max ? null : cached.attempt;
        }

        /* shootTarget: next throw energy E* from the shots so far, (E*, v_bas) —
           secant on ln(v_bas/v₀) against ln(E*) (first step with v_bas ∝ √E*),
           the slope kept between 0.05 and 2 */
        function shootTarget(shots, launch_speed) {
            const last = shots[shots.length - 1];
            let slope = 0.5;
            if (shots.length >= 2) {
                const before = shots[shots.length - 2];
                const measured = Math.log(last.speed / before.speed) / Math.log(last.target / before.target);
                slope = Number.isFinite(measured) ? Math.min(Math.max(measured, 0.05), 2) : slope;
            }
            return last.target * Math.exp(Math.log(launch_speed / last.speed) / slope);
        }

        /* runAttempt: one attempt. The motor pumps (cached, see pumpedAttempt), then
           throws (motorLead): the bucket's energy follows the curve up to E* by +90°
           and is held there over the top; the bar lines up over the last 60° and is
           let go as the bucket passes the lowest point, where its speed is measured.
           E* is found by shooting: ghost shots (failures only noted) run from the
           end of the pumping to the release, E* = ½ v₀² first, then shootTarget,
           until the measured speed is v₀ within 0.01 % (at most 8 shots, the closest
           kept, never one more than 0.1 % too fast: a success must not come from a
           harder throw than asked; a shot that never reaches the release point — too weak to go over
           the top — raises E* by 10 % and does not count as a measurement); the
           kept shot goes on as the real attempt if nothing failed before its
           release, else it is replayed with its failures on; its measured speed is
           returned either way, so an inexact launch shows. Ends at success (2
           turns after the release), or the first lost drop / snapped rope (at any
           time: every force goes through the rope) / swing back (the bucket turns
           backwards before its first free turn) plus 1.6 s of aftermath; frames at
           60 Hz. Returns { frames, outcome, event_time, duration, release_time,
           launch_speed (speed measured at the release, null when the attempt failed before it),
           shots, max_tension, min_tension } */
        function runAttempt(parameters, record) {
            const pumped = inStage(0, 0.3, () => pumpedAttempt(parameters, record));
            const fresh = (target) => {
                const attempt = pumped === null ? newAttempt(parameters, record) : structuredClone(pumped);
                attempt.motor.target_energy = target;
                return attempt;
            };
            const shots = [];
            let best = null;
            let target = parameters.launch_speed ** 2 / 2;
            for (let shot = 0; pumped !== null && shot < MAX_SHOTS; shot++) {
                const attempt = fresh(target);
                attempt.ghost = true;
                attempt.progress = { start: attempt.time, end: attempt.time + 3 };
                inStage(0.3 + 0.5 * shot / MAX_SHOTS, 0.5 / MAX_SHOTS, () => advanceAttempt(attempt, parameters, false));
                if (attempt.bottom_speed === null) {
                    target *= 1 + MISSED_SHOT_STEP;
                    continue;
                }
                shots.push({ target, speed: attempt.bottom_speed });
                const error = Math.abs(attempt.bottom_speed / parameters.launch_speed - 1);
                const too_fast = attempt.bottom_speed > (1 + MAX_OVERSHOOT) * parameters.launch_speed;
                if (!too_fast && (best === null || error < best.error)) {
                    best = { attempt, error, target };
                }
                if (error <= SPEED_TOLERANCE) {
                    break;
                }
                target = shootTarget(shots, parameters.launch_speed);
            }
            let attempt;
            if (best !== null && !best.attempt.would_fail) {
                attempt = best.attempt;
                attempt.ghost = false;
            } else {
                attempt = fresh(best === null ? parameters.launch_speed ** 2 / 2 : best.target);
            }
            attempt.progress = { start: attempt.time, end: attempt.time + 4 * Math.PI * Math.sqrt(bucketRadius(parameters.rope_length, parameters.mass, parameters.drop_count) / parameters.gravity) + 1 };
            inStage(0.8, 0.2, () => advanceAttempt(attempt, parameters, false));
            report(1);
            const { state, motor } = attempt;
            attempt.frames.push(captureFrame(state, attempt.time, motor));
            if (attempt.event_time === null) {
                attempt.outcome = "swing";
                attempt.event_time = attempt.time;
            }
            return {
                frames: attempt.frames, outcome: attempt.outcome, event_time: attempt.event_time, duration: attempt.time,
                release_time: attempt.release_time, launch_speed: attempt.forced_release ? null : (best === null ? attempt.bottom_speed : best.attempt.bottom_speed), shots,
                max_tension: attempt.max_tension, min_tension: attempt.min_tension,
            };
        }

        /* simulateRun: whole attempt for parameters { gravity, launch_speed,
           rope_length, mass, tension_max, drop_count?, rope_links? }: the motor swings
           the bar, throws the bucket and lets go, free turns (see runAttempt). v₀ = 0:
           nobody launches the bucket, it just hangs ("swing"). record = false skips
           the frames and the aftermath (outcome only, used by the checker) */
        function simulateRun(parameters, record = true) {
            if (parameters.launch_speed <= 0) {
                const state = initialState(parameters);
                const frames = [captureFrame(state, 0, null), captureFrame(state, POST_EVENT_SECONDS, null)];
                return { frames, outcome: "swing", event_time: 0, duration: POST_EVENT_SECONDS, release_time: null, launch_speed: 0, shots: [], max_tension: state.tension, min_tension: state.tension };
            }
            return runAttempt(parameters, record);
        }

        /* frameAt: last frame at or before the given time */
        function frameAt(run, time) {
            const index = Math.min(Math.max(Math.floor(time * FRAME_RATE + 1e-9), 0), run.frames.length - 1);
            return run.frames[index];
        }

        /* fillThreshold: smallest accepted mass when m is the free variable (90 % of
           the guaranteed m_max), 0 otherwise */
        function fillThreshold(challenge) {
            return challenge.variable === "mass" ? winningWindow(challenge).minimum : 0;
        }

        /* evaluate: outcome of the attempt with the free variable set to value; a
           successful run with an under-filled bucket is "underfilled" */
        function evaluate(challenge, value) {
            const outcome = simulateRun({ gravity: challenge.gravity, tension_max: challenge.tension_max, ...resolveParameters(challenge, value) }, false).outcome;
            return outcome === "success" && value < fillThreshold(challenge) ? "underfilled" : outcome;
        }

        /* isChallengeFeasible: the guaranteed window lies inside the input range, is
           wide enough (≥ 5 % and ≥ 3 input steps), and the full simulation succeeds at
           both of its ends (first: a candidate fails there most often) and in its middle */
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
            const probes = [0, 1, 0.5].map((share) => window.minimum + share * (window.maximum - window.minimum));
            return probes.every((value, index) => inStage(index / probes.length, 1 / probes.length, () => evaluate(challenge, value)) === "success");
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
           and m drawn (the bucket about half full: water 40 to 58 % of its 12.7 L), reference v₀ with v₀² = (5.8 … 7.5) g R (above 5 g R), T_max set
           above the reference bottom tension, T_max = m (v₀²/R + g) × (1.25 … 1.6) */
        function drawCandidate(rng, variable) {
            const place = PLACES[Math.floor(rng() * PLACES.length)];
            const gravity = place.gravity;
            const rope_length = Math.round(randomBetween(rng, 0.2, 0.55, 0.01) * 100) / 100;
            const capacity = WATER_DENSITY * Math.PI * BUCKET.radius ** 2 * BUCKET.depth;
            const mass = Math.round((EMPTY_MASS + randomBetween(rng, HALF_FULL[0], HALF_FULL[1], 0.01) * capacity) * 10) / 10;
            const radius = bucketRadius(rope_length, mass);
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
                if (!repeats && inStage(0, 1, () => isChallengeFeasible(candidate), attempt + 1)) {
                    return candidate;
                }
            }
            return { ...FALLBACK_CHALLENGES[Math.floor(rng() * FALLBACK_CHALLENGES.length)] };
        }

        /* nextMilestone: next tier above the score (null once every tier is reached) */
        function nextMilestone(score) {
            return MILESTONES.find((milestone) => milestone > score) ?? null;
        }

        const api = {
            MILESTONES,
            PLACES,
            VARIABLES,
            BAR_LENGTH,
            BAR_MASS,
            PIVOT_HEIGHT,
            ROPE_LINKS,
            ROPE_LINEAR_DENSITY,
            HANDLE,
            MIN_ROPE_LINKS,
            MAX_ROPE_LINKS,
            ATTACH,
            BUCKET,
            EMPTY_MASS,
            SHELL_CENTER,
            SHELL_INERTIA,
            DEFAULT_DROP_COUNT,
            SUBSTEP_RATE,
            WIN_TURNS,
            WINDOW_MARGIN,
            TENSION_SHARE,
            MASS_FILL_RATIO,
            FALLBACK_CHALLENGES,
            waterMass,
            fillHeight,
            waterLayout,
            bucketRadius,
            tensionPerMass,
            idealWindow,
            resolveParameters,
            winningWindow,
            bottomTension,
            initialState,
            restFrame,
            solveChain,
            bucketCenter,
            runAttempt,
            simulateRun,
            setProgressHook,
            frameAt,
            fillThreshold,
            evaluate,
            isChallengeFeasible,
            drawVariable,
            randomChallenge,
            nextMilestone,
        };
        return api;
    }

    globalThis.loop_wagon_game = physicsModule();

    if (typeof document === "undefined") {
        return;
    }

    const {
        MILESTONES, VARIABLES, DEFAULT_DROP_COUNT, BAR_LENGTH, PIVOT_HEIGHT, ROPE_LINKS, BUCKET, SHELL_CENTER, WIN_TURNS, MIN_ROPE_LINKS, MAX_ROPE_LINKS,
        bucketRadius, resolveParameters, winningWindow, restFrame, simulateRun, frameAt, fillThreshold, randomChallenge, nextMilestone,
    } = globalThis.loop_wagon_game;

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Jeu : le seau d'eau", en: "Game: the water bucket" },
        panel_title: { fr: "Défi", en: "Challenge" },
        new_challenge: { fr: "Nouveau défi", en: "New challenge" },
        assumption: {
            fr: "Hypothèses : barre rigide (0,9 m, 0,3 kg) sur un pivot sans frottement ; corde souple et inextensible (0,15 kg/m, dix tronçons : elle plie mais ne pousse pas) ; seau rigide cylindrique (Ø 26 cm, 24 cm de profondeur, 12,7 L, 0,5 kg à vide) pendu à son anse, qui pivote aux oreilles avec un léger frottement ; l'eau (m − 0,5 kg, 1 L par kg) est faite de petites billes qui roulent sans frottement sur les parois, se poussent entre elles et poussent le seau ; R va du pivot au centre de masse du seau rempli au repos. Air négligé. Au départ tout pend au repos ; seul un moteur au pivot agit : il balance la barre au rythme du pendule, puis la lance, la remet dans l'alignement de la corde et la lâche quand le seau passe au point bas. v₀ est la vitesse du centre de masse mesurée à cet instant : le lancer est réglé pour qu'elle vaille la valeur choisie (à quelques dixièmes de pour cent près, sans jamais la dépasser de plus de 0,1 %). Ensuite la barre tourne librement pendant les deux tours. La corde peut casser à tout moment ; une goutte qui franchit le bord du seau est perdue.",
            en: "Assumptions: rigid bar (0.9 m, 0.3 kg) on a frictionless pivot; flexible inextensible rope (0.15 kg/m, ten segments: it bends but never pushes); rigid cylindrical bucket (Ø 26 cm, 24 cm deep, 12.7 L, 0.5 kg empty) hanging from its bail, which pivots at the ears with a little friction; the water (m − 0.5 kg, 1 L per kg) is made of small balls that roll without friction on the walls, push each other and push the bucket; R runs from the pivot to the centre of mass of the filled bucket at rest. Air neglected. At the start everything hangs at rest; only a motor at the pivot acts: it swings the bar at the pendulum's rhythm, then throws it, brings it back in line with the rope and lets it go as the bucket passes the lowest point. v₀ is the speed of the centre of mass measured at that instant: the throw is tuned so that it equals the chosen value (within a few tenths of a percent, never more than 0.1 % above it). From then on the bar turns freely for the two turns. The rope can snap at any time; a drop that crosses the rim of the bucket is lost.",
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
        data_bucket: { fr: "Seau", en: "Bucket" },
        bucket_description: { fr: "12,7 L, Ø 26 cm, 0,5 kg à vide", en: "12.7 L, Ø 26 cm, 0.5 kg empty" },
        data_center: { fr: "Anse → centre de masse", en: "Handle → centre of mass" },
        full_bucket: { fr: "(seau rempli au maximum)", en: "(bucket filled to the maximum)" },
        data_rope: { fr: "Corde", en: "Rope" },
        data_mass: { fr: "Seau rempli", en: "Filled bucket" },
        data_speed: { fr: "Lancement (point bas)", en: "Launch (lowest point)" },
        data_tension: { fr: "Tension de rupture", en: "Breaking tension" },
        turns: { fr: "tour {count} / 2", en: "turn {count} / 2" },
        phase_rest: { fr: "seau au repos", en: "bucket at rest" },
        phase_swing: { fr: "élan : le moteur balance la barre", en: "wind-up: the motor swings the bar" },
        phase_throw: { fr: "le moteur accélère la barre", en: "the motor speeds the bar up" },
        phase_align: { fr: "la barre s'aligne sur la corde", en: "the bar lines up with the rope" },
        phase_free: { fr: "barre libre, v₀ mesurée = {v} m/s", en: "bar free, measured v₀ = {v} m/s" },
        computing: { fr: "calcul de l'essai…", en: "computing the attempt…" },
        preparing: { fr: "préparation du défi…", en: "preparing the challenge…" },
        drop_count: { fr: "Gouttes (test)", en: "Drops (test)" },
        preset: { fr: "Simulation (test)", en: "Simulation (test)" },
        preset_light: { fr: "légère", en: "light" },
        preset_medium: { fr: "moyenne", en: "medium" },
        preset_hard: { fr: "dure", en: "hard" },
        preset_very_hard: { fr: "très dure", en: "very hard" },
        candidate: { fr: "candidat {n}", en: "candidate {n}" },
        rope_links: { fr: "Tronçons de corde (test)", en: "Rope segments (test)" },
        step_factor: { fr: "Pas de temps divisé par (test)", en: "Time step divided by (test)" },
        magnifier: { fr: "Seau (loupe ×{zoom})", en: "Bucket (magnified ×{zoom})" },
    };
    const UNITS = { launch_speed: "m/s", rope_length: "m", mass: "kg" };
    const PRESETS = [["light", 10, 10, 1], ["medium", 10, 20, 2], ["hard", 10, 30, 4], ["very_hard", 10, 40, 8]];
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
    let drop_count = DEFAULT_DROP_COUNT;
    let rope_links = ROPE_LINKS;
    let step_factor = 1;
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
    let run_token = 0;
    let challenge_token = 0;
    let preparing = false;
    let prefetched = null;
    let message_id = 0;
    const pending = new Map();
    const progress = { run: null, challenge: null };
    const elements = {};
    const workers = { run: createWorker("run"), challenge: createWorker("challenge") };

    /* createWorker: Web Worker built from physicsModule's source (a Blob URL, so
       it also works over file://) — one for the attempts, one for the challenges,
       so that an attempt never waits behind a challenge; null when the browser
       refuses it, in which case compute runs on the page */
    function createWorker(kind) {
        try {
            const source = `const api = (${physicsModule.toString()})();
let current = 0;
let last = 0;
api.setProgressHook((fraction, label) => {
    const now = Date.now();
    if (now - last >= 80) {
        last = now;
        self.postMessage({ id: current, progress: fraction, label });
    }
});
self.onmessage = (event) => {
    const { id, type, parameters, excluded } = event.data;
    current = id;
    self.postMessage({ id, result: type === "run" ? api.simulateRun(parameters) : api.randomChallenge(Math.random, excluded) });
};`;
            const created = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
            created.onmessage = (event) => {
                if ("progress" in event.data) {
                    progress[kind] = { fraction: event.data.progress, label: event.data.label };
                    return;
                }
                const entry = pending.get(event.data.id);
                pending.delete(event.data.id);
                entry?.resolve(event.data.result);
            };
            created.onerror = () => {
                workers[kind] = null;
                created.terminate();
                for (const [id, entry] of pending) {
                    if (entry.message.type === kind) {
                        pending.delete(id);
                        setTimeout(() => entry.resolve(computeHere(entry.message)), 0);
                    }
                }
            };
            return created;
        } catch {
            return null;
        }
    }

    /* computeHere: an attempt or a new challenge, computed on the page */
    function computeHere(message) {
        return message.type === "run" ? simulateRun(message.parameters) : randomChallenge(Math.random, message.excluded);
    }

    /* compute: an attempt ({ type: "run", parameters }) or a new challenge
       ({ type: "challenge", excluded }), in its worker when there is one */
    function compute(message) {
        const worker = workers[message.type];
        if (worker === null) {
            return new Promise((resolve) => setTimeout(() => resolve(computeHere(message)), 0));
        }
        progress[message.type] = { fraction: 0, label: 0 };
        return new Promise((resolve) => {
            const id = ++message_id;
            pending.set(id, { message, resolve });
            worker.postMessage({ id, ...message });
        });
    }

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
        return { gravity: challenge.gravity, tension_max: challenge.tension_max, drop_count: drop_count === DEFAULT_DROP_COUNT ? null : drop_count, rope_links, step_factor, ...resolveParameters(challenge, value) };
    }

    /* invalidateRun: the attempt must be recomputed (the panel says so at once) */
    function invalidateRun() {
        run_dirty = true;
        setState("computing");
    }

    /* setState: computation state on the game panel, data-state = "preparing"
       (new challenge), "computing" (attempt) or "ready" */
    function setState(state) {
        if (elements.panel !== undefined) {
            elements.panel.dataset.state = state;
        }
    }

    /* ensureRun: recompute the attempt once after any change, in the background;
       the clock goes back to t = 0 when it arrives (a newer change wins) */
    function ensureRun() {
        if (!run_dirty || challenge === null) {
            return;
        }
        run_dirty = false;
        run = null;
        recorded = false;
        const token = ++run_token;
        compute({ type: "run", parameters: currentParameters() }).then((result) => {
            if (token === run_token) {
                run = result;
                setState("ready");
                resetClock();
            }
        });
    }

    /* configureInput: range, step, unit and value of the free-variable input */
    function configureInput() {
        const spec = VARIABLES[challenge === null ? "launch_speed" : challenge.variable];
        for (const input of [elements.slider, elements.number]) {
            input.min = spec.min;
            input.max = spec.max;
            input.step = spec.step;
            input.value = value;
        }
        elements.unit.textContent = UNITS[challenge === null ? "launch_speed" : challenge.variable];
    }

    /* newChallenge: a solvable challenge — the one prepared in the background
       if the last value does not win it, else a fresh one (the last value never
       wins the next one); nothing runs until it arrives, and the next one is
       prepared as soon as it does */
    function newChallenge() {
        const previous = challenge === null ? null : { variable: challenge.variable, value };
        const token = ++challenge_token;
        const source = prefetched ?? compute({ type: "challenge", excluded: previous });
        prefetched = null;
        challenge = null;
        run = null;
        run_token += 1;
        preparing = true;
        pending_new_challenge = false;
        setState("preparing");
        updatePanel();
        source.then((next) => (repeats(next, previous) ? compute({ type: "challenge", excluded: previous }) : next)).then((next) => {
            if (token !== challenge_token) {
                return;
            }
            challenge = next;
            preparing = false;
            const spec = VARIABLES[challenge.variable];
            if (previous === null || previous.variable !== challenge.variable) {
                value = spec.default_value;
            }
            value = Math.min(Math.max(value, spec.min), spec.max);
            invalidateRun();
            configureInput();
            updatePanel();
            resetClock();
            prefetched = compute({ type: "challenge", excluded: null });
        });
    }

    /* repeats: the previous value would win this challenge of the same variable */
    function repeats(next, previous) {
        if (previous === null || previous.variable !== next.variable) {
            return false;
        }
        const window = winningWindow(next);
        return previous.value >= window.minimum && previous.value <= window.maximum;
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
            elements.data.replaceChildren();
            elements.fill_rule.textContent = "";
            return;
        }
        elements.label.textContent = text(`variable_${challenge.variable}`);
        elements.fill_rule.textContent = challenge.variable === "mass" ? text("fill_rule") : "";
        elements.data.replaceChildren(
            dataLine(text("data_place"), `${text(`place_${challenge.place}`)}, g = ${formatValue(challenge.gravity)} m/s²`),
            dataLine(text("data_bar"), `L_b = ${formatValue(BAR_LENGTH)} m`),
            dataLine(text("data_bucket"), text("bucket_description")),
            dataLine(text("data_center"), `d = ${formatValue(bucketRadius(0, challenge.mass ?? winningWindow(challenge).maximum) - BAR_LENGTH, 3)} m`
                + (challenge.variable === "mass" ? ` ${text("full_bucket")}` : "")),
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
        invalidateRun();
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

    /* buildTestRow: temporary test row — an integer setting of the simulation
       (number of drops, 0 = from the water volume; number of rope segments) */
    function buildTestRow(key, minimum, maximum, current, apply) {
        const row = document.createElement("div");
        row.className = "parameter-row game-row";
        const head = document.createElement("div");
        head.className = "row-head";
        const label = document.createElement("label");
        label.htmlFor = `number_game_${key}`;
        label.dataset.gameI18n = key;
        const input = document.createElement("input");
        input.type = "number";
        input.id = `number_game_${key}`;
        input.min = minimum;
        input.max = maximum;
        input.step = 1;
        input.value = current;
        input.addEventListener("change", () => {
            const next = Number(input.value);
            if (!Number.isInteger(next) || next < minimum || next > maximum) {
                input.value = current;
                return;
            }
            current = next;
            apply(next);
            invalidateRun();
            resetClock();
        });
        head.append(label, input);
        row.append(head);
        return row;
    }

    /* buildPresetRow: temporary test row — simulation detail presets (light,
       medium, hard, very hard: more drops and rope segments) that set the two
       test inputs below */
    function buildPresetRow() {
        const row = document.createElement("div");
        row.className = "parameter-row game-row";
        const head = document.createElement("div");
        head.className = "row-head";
        const label = document.createElement("span");
        label.dataset.gameI18n = "preset";
        const buttons = document.createElement("div");
        buttons.className = "preset-buttons";
        for (const [key, drops, links, factor] of PRESETS) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.gameI18n = `preset_${key}`;
            button.addEventListener("click", () => {
                drop_count = drops;
                rope_links = links;
                document.getElementById("number_game_drop_count").value = drops;
                document.getElementById("number_game_rope_links").value = links;
                step_factor = factor;
                document.getElementById("number_game_step_factor").value = factor;
                invalidateRun();
                resetClock();
            });
            buttons.append(button);
        }
        head.append(label);
        row.append(head, buttons);
        return row;
    }

    /* buildInputRow: free-variable row (slider + number) with the challenge data;
       the attempt is recomputed when the slider is released or the number is
       confirmed (change), not at every move */
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
        document.getElementById("parameter_rows").append(
            row,
            buildPresetRow(),
            buildTestRow("drop_count", 1, 400, drop_count, (next) => {
                drop_count = next;
            }),
            buildTestRow("rope_links", MIN_ROPE_LINKS, MAX_ROPE_LINKS, rope_links, (next) => {
                rope_links = next;
            }),
            buildTestRow("step_factor", 1, 8, step_factor, (next) => {
                step_factor = next;
            }),
        );
        for (const [input, mirror] of [[elements.slider, elements.number], [elements.number, elements.slider]]) {
            input.addEventListener("input", () => {
                if (challenge === null) {
                    return;
                }
                const spec = VARIABLES[challenge.variable];
                const next = Number(input.value);
                if (input.value === "" || !Number.isFinite(next) || next < spec.min || next > spec.max) {
                    return;
                }
                value = next;
                mirror.value = input.value;
            });
            input.addEventListener("change", () => {
                if (challenge !== null) {
                    invalidateRun();
                    resetClock();
                }
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
        elements.panel.append(panel_head, elements.grid, elements.assumption);
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

    /* bucketPoint: world point at (along the axis from the ears, across) of the
       bucket in the pose [x, y, φ] of its shell's centre of mass */
    function bucketPoint(pose, along, across) {
        const axis_x = Math.sin(pose[2]);
        const axis_y = -Math.cos(pose[2]);
        return [pose[0] + (along - SHELL_CENTER) * axis_x - across * axis_y, pose[1] + (along - SHELL_CENTER) * axis_y + across * axis_x];
    }

    /* drawBucket: open bucket in its pose, ears at the rim, and the bail from
       ear to ear through the handle (where the rope is tied) */
    function drawBucket(context, transform, pose, handle, ink) {
        const screen = ([x, y]) => [transform.toScreenX(x), transform.toScreenY(y)];
        const corner = (along, across) => screen(bucketPoint(pose, along, across));
        const wall = BUCKET.radius + 0.008;
        const left_ear = corner(0, -wall);
        const right_ear = corner(0, wall);
        const outline = [left_ear, corner(BUCKET.depth + 0.008, -0.9 * wall), corner(BUCKET.depth + 0.008, 0.9 * wall), right_ear];
        const tip = screen(handle);
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(left_ear[0], left_ear[1]);
        context.quadraticCurveTo(2 * tip[0] - (left_ear[0] + right_ear[0]) / 2, 2 * tip[1] - (left_ear[1] + right_ear[1]) / 2, right_ear[0], right_ear[1]);
        context.stroke();
        context.fillStyle = "rgba(176, 190, 197, 0.5)";
        context.strokeStyle = "#546e7a";
        context.lineWidth = 3;
        context.lineJoin = "round";
        context.beginPath();
        outline.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
        context.fill();
        context.stroke();
        context.fillStyle = "#37474f";
        for (const [x, y] of [left_ear, right_ear]) {
            context.beginPath();
            context.arc(x, y, 2.5, 0, 2 * Math.PI);
            context.fill();
        }
        context.restore();
    }

    /* drawDrops: water as small balls, over a soft halo that merges the drops
       still in the bucket into a body of water */
    function drawDrops(context, transform, drops, radius) {
        const pixels = radius * transform.scale;
        context.save();
        context.fillStyle = "rgba(66, 165, 245, 0.35)";
        for (const [x, y, spilled] of drops) {
            if (!spilled) {
                context.beginPath();
                context.arc(transform.toScreenX(x), transform.toScreenY(y), 1.5 * pixels, 0, 2 * Math.PI);
                context.fill();
            }
        }
        context.fillStyle = "#1e88e5";
        context.strokeStyle = "#0d47a1";
        context.lineWidth = 1;
        for (const [x, y] of drops) {
            context.beginPath();
            context.arc(transform.toScreenX(x), transform.toScreenY(y), Math.max(pixels, 1.5), 0, 2 * Math.PI);
            context.fill();
            context.stroke();
        }
        context.restore();
    }

    /* drawMagnifier: the bucket alone, magnified, in its own frame (ears up,
       bottom down), with the bail and the water inside — the sloshing shows even
       when the bucket is small on the scene */
    function drawMagnifier(context, frame, ink) {
        const pose = frame.bucket;
        const ears = bucketPoint(pose, 0, 0);
        const axis = [Math.sin(pose[2]), -Math.cos(pose[2])];
        const local = ([x, y]) => [(x - ears[0]) * -axis[1] + (y - ears[1]) * axis[0], -((x - ears[0]) * axis[0] + (y - ears[1]) * axis[1])];
        const size = Math.min(context.canvas.width, context.canvas.height) * 0.25;
        const box = { x: context.canvas.width - size - 10 * ui_scale, y: context.canvas.height - size - 10 * ui_scale, width: size, height: size };
        const zoom = 0.78 * size / (BUCKET.bail + BUCKET.depth + 0.04);
        const origin_x = box.x + box.width / 2;
        const origin_y = box.y + 0.12 * box.height + BUCKET.bail * zoom;
        const inset = { scale: zoom, toScreenX: (x) => origin_x + x * zoom, toScreenY: (y) => origin_y - y * zoom };
        context.save();
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches ? "rgba(22, 27, 34, 0.9)" : "rgba(255, 255, 255, 0.92)";
        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(box.x, box.y, box.width, box.height, 8 * ui_scale);
        context.fill();
        context.stroke();
        context.beginPath();
        context.roundRect(box.x, box.y, box.width, box.height, 8 * ui_scale);
        context.clip();
        drawBucket(context, inset, [0, -SHELL_CENTER, 0], local(frame.nodes[frame.nodes.length - 2]), ink);
        drawDrops(context, inset, frame.drops.map((drop) => [...local(drop), drop[2]]), frame.drop_radius);
        context.fillStyle = ink;
        context.font = `bold ${Math.round(11 * ui_scale)}px system-ui, sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText(text("magnifier", { zoom: formatValue(zoom / currentScale(context.canvas), 0) }).toUpperCase(), box.x + 8 * ui_scale, box.y + 6 * ui_scale);
        context.restore();
    }

    /* currentScale: pixels per metre of the scene */
    function currentScale(canvas) {
        return viewTransform(canvas).scale;
    }

    /* drawForces: the only forces on the filled bucket — its weight P at its
       centre of mass and the rope tension T at the handle (same scale), the rope
       being pulled by the bar */
    function drawForces(context, transform, frame, parameters) {
        const draw = globalThis.canvas_draw;
        const center = frame.center;
        const handle = frame.nodes[frame.nodes.length - 2];
        const rope = frame.nodes[frame.nodes.length - 3];
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
        if (run === null) {
            const state = progress[preparing ? "challenge" : "run"];
            const share = state === null ? 0 : state.fraction;
            const detail = state !== null && state.label > 0 ? ` — ${text("candidate", { n: state.label })}` : "";
            context.fillText(`${text(preparing ? "preparing" : "computing")} ${formatValue(100 * share, 0)} %${detail}`, line(0), line(0));
            const width = 240 * ui_scale;
            const height = 8 * ui_scale;
            context.fillStyle = "rgba(120, 130, 145, 0.25)";
            context.fillRect(line(0), line(1) + 4 * ui_scale, width, height);
            context.fillStyle = "#1976d2";
            context.fillRect(line(0), line(1) + 4 * ui_scale, width * share, height);
            context.restore();
            return;
        }
        const phase = frame.released
            ? `${text("phase_free", { v: run.launch_speed === null ? "—" : formatValue(run.launch_speed, 2) })} — ${text("turns", { count: formatValue(Math.min(frame.turns, WIN_TURNS), 2) })}`
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
        const canvas = context.canvas;
        const ink = matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
        const transform = viewTransform(canvas);
        ui_scale = Math.min(Math.max(Math.min(canvas.width / UI_REFERENCE_WIDTH, canvas.height / UI_REFERENCE_HEIGHT), 1), 1.8);
        context.clearRect(0, 0, canvas.width, canvas.height);
        globalThis.canvas_draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds, { font: `${Math.round(11 * ui_scale)}px system-ui, sans-serif` });
        drawStand(context, transform);
        if (challenge === null) {
            drawStatus(context, null, 0, ink);
            return true;
        }
        const time = run === null ? 0 : Math.min(payload.time, run.duration);
        if (run !== null && !recorded && time >= run.duration - 1e-9 && last_time < time) {
            recordAttempt();
        }
        last_time = payload.time;
        const frame = run === null ? restFrame(currentParameters()) : frameAt(run, time);
        drawRope(context, transform, frame.nodes.slice(frame.snapped ? 2 : 1, frame.nodes.length - 1));
        drawBar(context, transform, frame.nodes[0], frame.nodes[1]);
        drawBucket(context, transform, frame.bucket, frame.nodes[frame.nodes.length - 2], ink);
        drawDrops(context, transform, frame.drops, frame.drop_radius);
        drawMagnifier(context, frame, ink);
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
        return run === null ? 0 : run.duration;
    };
})();
