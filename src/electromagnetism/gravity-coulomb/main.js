/*
 * main.js — Gravity–Coulomb equilibrium page logic: animated scene with the two
 * charged bodies on a starfield, gravitational / electric / net force vectors,
 * velocity and acceleration vectors, a separation annotation and a free-body
 * diagram inset; shared pan/zoom camera with auto-follow; transport controls
 * with an acceleration-factor readout (the forces are tiny, so the animation is
 * heavily sped up and the displayed time is the simulated physical time);
 * parameters (m, q in nC, charge-sign toggle, initial separation d₀); formulas
 * answering the three course questions (q_éq = m·√(G/k), same-sign requirement,
 * N = q_éq/e) plus live d(t), ΣF, a and the energy-conservation speed; time
 * graphs of d, ḋ and d̈ with auto-scaled unit prefixes.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js. Body radius fixed at 0.5 m
 * (contact at d = 1 m), bodies released at rest.
 */
(() => {
    const calc = globalThis.gravity_coulomb_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Équilibre gravitation–Coulomb", en: "Gravity–Coulomb equilibrium" },
        assumption: {
            fr: "Hypothèses : deux corps identiques (masse m, charge de valeur absolue q chacun) seuls dans le vide sidéral — aucune autre force (pas de poids extérieur, pas de frottement). Sphères de rayon 0,5 m assimilées à des masses et charges ponctuelles ; contact lorsque d = 1 m. Lâchés sans vitesse initiale à la distance d₀, les corps se déplacent le long de la droite qui les joint (mouvement radial, solution exacte). Constantes : G = 6,674 × 10⁻¹¹ N·m²/kg², k = 1/(4πε₀) = 8,988 × 10⁹ N·m²/C², e = 1,602 × 10⁻¹⁹ C. Les forces étant minuscules, l'animation est fortement accélérée (facteur affiché sous la barre de temps) ; le temps affiché est le temps physique simulé.",
            en: "Assumptions: two identical bodies (mass m, charge of absolute value q each) alone in deep space — no other force (no external weight, no friction). Spheres of radius 0.5 m treated as point masses and charges; contact at d = 1 m. Released at rest at separation d₀, the bodies move along the line joining them (radial motion, exact solution). Constants: G = 6.674 × 10⁻¹¹ N·m²/kg², k = 1/(4πε₀) = 8.988 × 10⁹ N·m²/C², e = 1.602 × 10⁻¹⁹ C. The forces are tiny, so the animation is heavily sped up (factor shown under the timeline); the displayed time is the simulated physical time.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_separation: { fr: "Séparation d (m)", en: "Separation d (m)" },
        graph_rate: { fr: "Vitesse relative ḋ", en: "Relative velocity ḋ" },
        graph_acceleration: { fr: "Accélération relative d̈", en: "Relative acceleration d̈" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−1 %", en: "−1 %" },
        step_forward: { fr: "+1 %", en: "+1 %" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        time_scale: { fr: "Animation accélérée ×{factor}", en: "Animation sped up ×{factor}" },
        zoom_fit_hint: { fr: "Ajuster la vue aux deux corps", en: "Fit view to the two bodies" },
        mass: { fr: "Masse m de chaque corps", en: "Mass m of each body" },
        charge_nanocoulombs: { fr: "Charge |q| de chaque corps", en: "Charge |q| of each body" },
        same_signs: { fr: "Charges de même signe (q₁·q₂ > 0)", en: "Same-sign charges (q₁·q₂ > 0)" },
        initial_distance: { fr: "Distance initiale d₀", en: "Initial separation d₀" },
        legend_gravity: { fr: "Force gravitationnelle F_g", en: "Gravitational force F_g" },
        legend_electric: { fr: "Force électrique F_e", en: "Electric force F_e" },
        legend_net: { fr: "Résultante ΣF", en: "Net force ΣF" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces (corps 1)", en: "Free-body diagram (body 1)" },
        formula_fg: { fr: "Force gravitationnelle", en: "Gravitational force" },
        formula_fe: { fr: "Force électrique (Coulomb)", en: "Electric force (Coulomb)" },
        formula_net: { fr: "Résultante sur chaque corps", en: "Net force on each body" },
        formula_acceleration: { fr: "Accélération de chaque corps", en: "Acceleration of each body" },
        formula_qeq: { fr: "1. Charge d'équilibre", en: "1. Equilibrium charge" },
        formula_signs: { fr: "2. Signe des charges", en: "2. Sign of the charges" },
        formula_count: { fr: "3. Nombre de charges élémentaires", en: "3. Number of elementary charges" },
        formula_speed: { fr: "Vitesse relative (énergie)", en: "Relative speed (energy)" },
        formula_distance: { fr: "Séparation d(t)", en: "Separation d(t)" },
        state_attraction: { fr: "attraction", en: "attraction" },
        state_repulsion: { fr: "répulsion", en: "repulsion" },
        state_equilibrium: { fr: "équilibre", en: "equilibrium" },
        signs_same_ok: {
            fr: "q₁·q₂ > 0 : F_e est répulsive et peut compenser F_g → équilibre possible",
            en: "q₁·q₂ > 0: F_e is repulsive and can balance F_g → equilibrium possible",
        },
        signs_opposite_bad: {
            fr: "q₁·q₂ < 0 : F_e et F_g attirent toutes les deux → équilibre impossible",
            en: "q₁·q₂ < 0: F_e and F_g both attract → equilibrium impossible",
        },
        distance_info: { fr: "d₀ = {d0} m · contact à d = 1 m", en: "d₀ = {d0} m · contact at d = 1 m" },
        protons_or_electrons: { fr: "protons ou électrons", en: "protons or electrons" },
        unit_seconds: { fr: "s", en: "s" },
        unit_minutes: { fr: "min", en: "min" },
        unit_hours: { fr: "h", en: "h" },
        unit_days: { fr: "j", en: "d" },
    };

    const parameter_config = [
        { key: "mass", min: 1, max: 10000, step: 1, unit: "kg" },
        { key: "charge_nanocoulombs", min: 0, max: 1000, step: 0.01, unit: "nC" },
        { key: "same_signs", type: "toggle" },
        { key: "initial_distance", min: 2, max: 50, step: 0.5, unit: "m" },
    ];
    const parameters = {
        mass: 1000,
        charge_nanocoulombs: 40,
        same_signs: true,
        initial_distance: 10,
    };

    const BODY_RADIUS = 0.5;
    const CONTACT_DISTANCE = 2 * BODY_RADIUS;
    const WINDOW_FACTOR = 6;
    const ANIMATION_SECONDS = 30;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const GRAPH_SAMPLES = 80;
    const FORCE_ARROW_PIXELS = 70;
    const MOTION_ARROW_PIXELS = 55;
    const SUPERSCRIPT_DIGITS = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    const CONSTANT_TEXT = {
        gravitational: { fr: "6,674 × 10⁻¹¹", en: "6.674 × 10⁻¹¹" },
        coulomb: { fr: "8,988 × 10⁹", en: "8.988 × 10⁹" },
        elementary: { fr: "1,602 × 10⁻¹⁹", en: "1.602 × 10⁻¹⁹" },
    };

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const camera = globalThis.scene_camera.createCamera(canvas);
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
    const integer_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 }),
        en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    };

    let current_language = localStorage.getItem("simulator_language") || "fr";
    let simulation_time = 0;
    let is_playing = false;
    let playback_speed = 1;
    let last_frame_timestamp = null;

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* formatScientific: mantissa × 10^exponent with superscripts for very small
       or very large magnitudes, plain 2-decimal format otherwise */
    function formatScientific(value) {
        const magnitude = Math.abs(value);
        if (magnitude === 0) {
            return "0";
        }
        if (magnitude >= 0.01 && magnitude < 10000) {
            return formatNumber(value);
        }
        const exponent = Math.floor(Math.log10(magnitude));
        const mantissa = value / Math.pow(10, exponent);
        const superscript = String(exponent).split("").map((digit) => SUPERSCRIPT_DIGITS[digit]).join("");
        return `${formatNumber(mantissa)} × 10${superscript}`;
    }

    /* currentCharge: |q| in coulombs from the nC parameter */
    function currentCharge() {
        return parameters.charge_nanocoulombs * 1e-9;
    }

    /* currentMu: μ of the relative motion for the current parameters */
    function currentMu() {
        return calc.relativeMu(parameters.mass, currentCharge(), parameters.same_signs);
    }

    /* gravityWindow: observation window — WINDOW_FACTOR times the gravity-only
       collapse time, so near-equilibrium runs end on a finite timeline */
    function gravityWindow() {
        const gravity_mu = calc.relativeMu(parameters.mass, 0, true);
        return WINDOW_FACTOR * calc.contactTime(parameters.initial_distance, gravity_mu, CONTACT_DISTANCE);
    }

    /* totalTime: until contact when attractive, until d = 3·d₀ when repulsive,
       both capped by the observation window (equilibrium shows the full window) */
    function totalTime() {
        const mu = currentMu();
        const window_seconds = gravityWindow();
        if (mu > 0) {
            return Math.min(calc.contactTime(parameters.initial_distance, mu, CONTACT_DISTANCE), window_seconds);
        }
        if (mu < 0) {
            return Math.min(
                calc.separationTime(parameters.initial_distance, mu, 3 * parameters.initial_distance),
                window_seconds,
            );
        }
        return window_seconds;
    }

    /* timeUnit: readable unit for the current event duration */
    function timeUnit(total_seconds) {
        if (total_seconds >= 2 * 86400) {
            return { factor: 86400, label: strings.unit_days[current_language] };
        }
        if (total_seconds >= 7200) {
            return { factor: 3600, label: strings.unit_hours[current_language] };
        }
        if (total_seconds >= 180) {
            return { factor: 60, label: strings.unit_minutes[current_language] };
        }
        return { factor: 1, label: strings.unit_seconds[current_language] };
    }

    /* unitPrefix: scale factor + prefixed unit so the maximum lands in [1, 1000) */
    function unitPrefix(max_magnitude, base_unit) {
        const prefixes = [
            { factor: 1, prefix: "" },
            { factor: 1e3, prefix: "m" },
            { factor: 1e6, prefix: "µ" },
            { factor: 1e9, prefix: "n" },
            { factor: 1e12, prefix: "p" },
        ];
        for (const candidate of prefixes) {
            if (max_magnitude * candidate.factor >= 1) {
                return { factor: candidate.factor, unit: candidate.prefix + base_unit };
            }
        }
        const last = prefixes[prefixes.length - 1];
        return { factor: last.factor, unit: last.prefix + base_unit };
    }

    /* computeSamples: exact d, ḋ, d̈ at evenly spaced times over the event */
    function computeSamples(total_time) {
        const mu = currentMu();
        const samples = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const time = (total_time * i) / GRAPH_SAMPLES;
            const separation = Math.max(
                calc.separationAt(parameters.initial_distance, mu, time),
                CONTACT_DISTANCE,
            );
            samples.push({
                time,
                separation,
                rate: calc.separationRate(parameters.initial_distance, mu, separation),
                acceleration: calc.relativeAcceleration(mu, separation),
            });
        }
        return samples;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* maximumSeparation: largest d over the event (d₀ when attractive) */
    function maximumSeparation() {
        const mu = currentMu();
        if (mu >= 0) {
            return parameters.initial_distance;
        }
        return Math.max(
            calc.separationAt(parameters.initial_distance, mu, totalTime()),
            parameters.initial_distance,
        );
    }

    /* fitView: frame both bodies over the whole event, with breathing room */
    function fitView() {
        const half_extent = maximumSeparation() / 2 + 2;
        const vertical = Math.max(half_extent * 0.35, 3);
        camera.fitTo({ left: -half_extent, right: half_extent, bottom: -vertical, top: vertical });
    }

    /* starHash: deterministic pseudo-random in [0, 1) from integer cell coordinates */
    function starHash(cell_x, cell_y, salt) {
        const value = Math.sin(cell_x * 127.1 + cell_y * 311.7 + salt * 74.7) * 43758.5453;
        return value - Math.floor(value);
    }

    /* drawStars: sparse deterministic starfield anchored in world space */
    function drawStars(transform) {
        const cell_size = 3;
        context.save();
        for (let i = Math.floor(transform.bounds.left / cell_size); i * cell_size <= transform.bounds.right; i++) {
            for (let j = Math.floor(transform.bounds.bottom / cell_size); j * cell_size <= transform.bounds.top; j++) {
                if (starHash(i, j, 0) > 0.32) {
                    continue;
                }
                const world_x = (i + starHash(i, j, 1)) * cell_size;
                const world_y = (j + starHash(i, j, 2)) * cell_size;
                context.fillStyle = `rgba(140, 150, 170, ${0.15 + 0.35 * starHash(i, j, 3)})`;
                context.beginPath();
                context.arc(transform.toScreenX(world_x), transform.toScreenY(world_y), 1 + starHash(i, j, 4), 0, 2 * Math.PI);
                context.fill();
            }
        }
        context.restore();
    }

    /* drawBody: shaded sphere with its charge sign */
    function drawBody(transform, world_x, sign_text) {
        const screen_x = transform.toScreenX(world_x);
        const screen_y = transform.toScreenY(0);
        const radius = Math.max(Math.abs(transform.toScreenX(BODY_RADIUS) - transform.toScreenX(0)), 6);
        const gradient = context.createRadialGradient(
            screen_x - radius * 0.35, screen_y - radius * 0.35, radius * 0.15,
            screen_x, screen_y, radius,
        );
        gradient.addColorStop(0, "#aeb9c9");
        gradient.addColorStop(1, "#5b6a7e");
        context.save();
        context.fillStyle = gradient;
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(screen_x, screen_y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = sign_text === "+" ? "#d32f2f" : "#1976d2";
        context.font = `bold ${Math.max(radius * 0.9, 11)}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(sign_text, screen_x, screen_y);
        context.restore();
    }

    /* drawSeparationAnnotation: double-headed arrow with the current d below the bodies */
    function drawSeparationAnnotation(transform, separation, ink) {
        const left_x = transform.toScreenX(-separation / 2);
        const right_x = transform.toScreenX(separation / 2);
        const line_y = transform.toScreenY(0) + Math.max(Math.abs(transform.toScreenX(BODY_RADIUS) - transform.toScreenX(0)), 6) + 26;
        draw.drawVector(context, (left_x + right_x) / 2, line_y, (right_x - left_x) / 2, 0, { color: "rgba(120, 130, 145, 0.8)", line_width: 1.5 });
        draw.drawVector(context, (left_x + right_x) / 2, line_y, (left_x - right_x) / 2, 0, { color: "rgba(120, 130, 145, 0.8)", line_width: 1.5 });
        context.save();
        context.fillStyle = ink;
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`d = ${formatNumber(separation)} m`, (left_x + right_x) / 2, line_y + 8);
        context.restore();
    }

    /* drawBodyVectors: F_g, F_e, ΣF, v and a on one body (direction = ±1 toward the other) */
    function drawBodyVectors(screen_x, screen_y, direction, forces, motion, ink) {
        const force_scale = FORCE_ARROW_PIXELS / forces.reference;
        draw.drawVector(context, screen_x, screen_y, direction * forces.gravity * force_scale, 0, {
            color: "#d32f2f",
            label: "F_g",
        });
        if (forces.electric > 0) {
            const electric_direction = parameters.same_signs ? -direction : direction;
            draw.drawVector(context, screen_x, screen_y, electric_direction * forces.electric * force_scale, 0, {
                color: "#1976d2",
                label: "F_e",
            });
        }
        const net_pixels = forces.net * force_scale;
        if (Math.abs(net_pixels) > 1) {
            draw.drawVector(context, screen_x, screen_y - 26, direction * net_pixels, 0, {
                color: ink,
                line_width: 4,
                label: "ΣF",
            });
        }
        if (motion.speed_reference > 0 && motion.speed > 0) {
            const speed_pixels = MOTION_ARROW_PIXELS * motion.speed / motion.speed_reference;
            const speed_direction = motion.approaching ? direction : -direction;
            draw.drawVector(context, screen_x, screen_y + 30, speed_direction * speed_pixels, 0, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (motion.acceleration_reference > 0 && Math.abs(motion.acceleration) > 0) {
            const acceleration_pixels = MOTION_ARROW_PIXELS * Math.abs(motion.acceleration) / motion.acceleration_reference;
            const acceleration_direction = motion.acceleration > 0 ? direction : -direction;
            draw.drawVector(context, screen_x, screen_y + 52, acceleration_direction * acceleration_pixels, 0, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
    }

    /* drawFreeBodyInset: body 1 alone with F_g, F_e and ΣF, values included */
    function drawFreeBodyInset(ink, forces) {
        const box_width = 196;
        const box_height = 196;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 78;

        context.save();
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches
            ? "rgba(22, 27, 34, 0.92)"
            : "rgba(255, 255, 255, 0.92)";
        context.strokeStyle = "rgba(120, 130, 145, 0.45)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(box_x, box_y, box_width, box_height, 8);
        context.fill();
        context.stroke();

        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(strings.fbd_title[current_language], center_x, box_y + 10);

        context.fillStyle = "#5b6a7e";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, 9, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        const inset_scale = 56 / forces.reference;
        draw.drawVector(context, center_x, center_y, forces.gravity * inset_scale, 0, { color: "#d32f2f", label: "F_g" });
        if (forces.electric > 0) {
            const electric_direction = parameters.same_signs ? -1 : 1;
            draw.drawVector(context, center_x, center_y, electric_direction * forces.electric * inset_scale, 0, {
                color: "#1976d2",
                label: "F_e",
            });
        }
        if (Math.abs(forces.net) * inset_scale > 1) {
            draw.drawVector(context, center_x, center_y + 24, forces.net * inset_scale, 0, {
                color: inkColor(),
                line_width: 4,
                label: "ΣF",
            });
        }

        context.save();
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = "#d32f2f";
        context.fillText(`F_g = ${formatScientific(forces.gravity)} N`, center_x, center_y + 48);
        context.fillStyle = "#1976d2";
        context.fillText(`F_e = ${formatScientific(forces.electric)} N`, center_x, center_y + 66);
        context.fillStyle = inkColor();
        context.fillText(`ΣF = ${formatScientific(forces.net)} N`, center_x, center_y + 84);
        context.restore();
    }

    /* drawScene: starfield, grid, bodies, force/velocity/acceleration vectors,
       separation annotation and free-body inset; returns the live quantities */
    function drawScene(transform, time, samples) {
        const ink = inkColor();
        const mu = currentMu();
        const separation = Math.max(
            calc.separationAt(parameters.initial_distance, mu, time),
            CONTACT_DISTANCE,
        );
        const rate = calc.separationRate(parameters.initial_distance, mu, separation);
        const gravity = calc.gravityForce(parameters.mass, separation);
        const electric = calc.coulombForce(currentCharge(), separation);
        const net = calc.netAttraction(parameters.mass, currentCharge(), parameters.same_signs, separation);
        const forces = { gravity, electric, net, reference: Math.max(gravity, electric, 1e-30) };
        let speed_reference = 0;
        let acceleration_reference = 0;
        for (const sample of samples) {
            speed_reference = Math.max(speed_reference, Math.abs(sample.rate));
            acceleration_reference = Math.max(acceleration_reference, Math.abs(sample.acceleration));
        }
        const motion = {
            speed: Math.abs(rate) / 2,
            speed_reference: speed_reference / 2,
            approaching: rate < 0,
            acceleration: net / parameters.mass,
            acceleration_reference: acceleration_reference / 2,
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        drawStars(transform);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        drawBody(transform, -separation / 2, "+");
        drawBody(transform, separation / 2, parameters.same_signs ? "+" : "−");
        drawSeparationAnnotation(transform, separation, ink);

        /* Game mode hook — remove together with game.js (forces and the FBD
           reveal the equilibrium balance, so they are hidden while playing) */
        const hide_forces = document.body.classList.contains("game-mode");
        if (!hide_forces) {
            const screen_y = transform.toScreenY(0);
            drawBodyVectors(transform.toScreenX(-separation / 2), screen_y, 1, forces, motion, ink);
            drawBodyVectors(transform.toScreenX(separation / 2), screen_y, -1, forces, motion, ink);
            drawFreeBodyInset(ink, forces);
        }

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.gravity_coulomb_game_overlay === "function") {
            globalThis.gravity_coulomb_game_overlay(context, transform, {
                time,
                total_time: Math.max(totalTime(), 1e-9),
                separation,
                relative_speed: Math.abs(rate),
                attracting: mu > 0,
                contact_distance: CONTACT_DISTANCE,
            });
        }
        return { separation, rate, forces, mu };
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const mass = parameters.mass;
        const charge = currentCharge();
        const distance = state.separation;
        const equilibrium_charge = calc.equilibriumCharge(mass);
        const coefficient = calc.forceCoefficient(mass, charge, parameters.same_signs);
        const state_key = state.forces.net > 0 ? "state_attraction" : (state.forces.net < 0 ? "state_repulsion" : "state_equilibrium");
        const gravity_text = formatScientific(state.forces.gravity);
        const electric_text = formatScientific(state.forces.electric);

        document.getElementById("math_net").textContent = parameters.same_signs ? "ΣF = F_g − F_e" : "ΣF = F_g + F_e";
        const cards = {
            fg: {
                substitution: `${CONSTANT_TEXT.gravitational[current_language]} × ${formatNumber(mass)}² / ${formatNumber(distance)}²`,
                result: `${gravity_text} N`,
            },
            fe: {
                substitution: `${CONSTANT_TEXT.coulomb[current_language]} × (${formatNumber(parameters.charge_nanocoulombs)} × 10⁻⁹)² / ${formatNumber(distance)}²`,
                result: `${electric_text} N`,
            },
            net: {
                substitution: `${gravity_text} ${parameters.same_signs ? "−" : "+"} ${electric_text}`,
                result: `${formatScientific(state.forces.net)} N (${strings[state_key][current_language]})`,
            },
            acceleration: {
                substitution: `${formatScientific(state.forces.net)} / ${formatNumber(mass)}`,
                result: `${formatScientific(state.forces.net / mass)} m/s²`,
            },
            qeq: {
                substitution: `${formatNumber(mass)} × √(${CONSTANT_TEXT.gravitational[current_language]} / ${CONSTANT_TEXT.coulomb[current_language]})`,
                result: `${formatScientific(equilibrium_charge)} C = ${formatNumber(equilibrium_charge * 1e9)} nC`,
            },
            signs: {
                substitution: strings[parameters.same_signs ? "signs_same_ok" : "signs_opposite_bad"][current_language],
                result: parameters.same_signs ? "q₁·q₂ > 0 ✓" : "q₁·q₂ < 0 ✗",
            },
            count: {
                substitution: `${formatScientific(equilibrium_charge)} / ${CONSTANT_TEXT.elementary[current_language]}`,
                result: `${formatScientific(calc.elementaryChargeCount(equilibrium_charge))} ${strings.protons_or_electrons[current_language]}`,
            },
            speed: {
                substitution: `√(4 × ${formatScientific(coefficient)} × (1/${formatNumber(distance)} − 1/${formatNumber(parameters.initial_distance)}) / ${formatNumber(mass)})`,
                result: `${formatScientific(Math.abs(state.rate))} m/s`,
            },
            distance: {
                substitution: strings.distance_info[current_language].replace("{d0}", formatNumber(parameters.initial_distance)),
                result: `d = ${formatNumber(distance)} m`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: d, ḋ and d̈ versus time with auto-prefixed units and live cursor */
    function drawGraphs(time, samples, unit) {
        let rate_max = 0;
        let acceleration_max = 0;
        for (const sample of samples) {
            rate_max = Math.max(rate_max, Math.abs(sample.rate));
            acceleration_max = Math.max(acceleration_max, Math.abs(sample.acceleration));
        }
        const rate_prefix = unitPrefix(Math.max(rate_max, 1e-30), "m/s");
        const acceleration_prefix = unitPrefix(Math.max(acceleration_max, 1e-30), "m/s²");
        const cursor = time / unit.factor;
        const x_label = `t (${unit.label})`;

        graph.drawTimeGraph(document.getElementById("graph_separation"), [
            { label: "d", color: "#1976d2", points: samples.map((s) => [s.time / unit.factor, s.separation]) },
        ], { cursor_time: cursor, unit: "m", x_label });
        graph.drawTimeGraph(document.getElementById("graph_rate"), [
            { label: "ḋ", color: "#d32f2f", points: samples.map((s) => [s.time / unit.factor, s.rate * rate_prefix.factor]) },
        ], { cursor_time: cursor, unit: rate_prefix.unit, x_label });
        graph.drawTimeGraph(document.getElementById("graph_acceleration"), [
            { label: "d̈", color: "#43a047", points: samples.map((s) => [s.time / unit.factor, s.acceleration * acceleration_prefix.factor]) },
        ], { cursor_time: cursor, unit: acceleration_prefix.unit, x_label });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const total_time = Math.max(totalTime(), 1e-9);
        const time = Math.min(simulation_time, total_time);
        const samples = computeSamples(total_time);
        const state = drawScene(camera.transform(), time, samples);
        const unit = timeUnit(total_time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time / unit.factor)} ${unit.label}`;
        document.getElementById("time_scale_display").textContent = strings.time_scale[current_language]
            .replace("{factor}", integer_formatters[current_language].format(Math.max(playback_speed * total_time / ANIMATION_SECONDS, 1)));
        const timeline = document.getElementById("timeline");
        timeline.max = total_time;
        timeline.step = total_time / 1000;
        timeline.value = time;
        updateFormulas(time, state);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs(time, samples, unit);
        }
    }

    /* animationFrame: advance simulation time while playing, then render.
       ×1 playback runs the whole event in ANIMATION_SECONDS wall seconds. */
    function animationFrame(timestamp) {
        if (is_playing) {
            if (last_frame_timestamp !== null) {
                const delta_seconds = Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
                simulation_time += delta_seconds * playback_speed * totalTime() / ANIMATION_SECONDS;
                if (simulation_time >= totalTime()) {
                    simulation_time = totalTime();
                    setPlaying(false);
                }
            }
            last_frame_timestamp = timestamp;
        }
        render();
        requestAnimationFrame(animationFrame);
    }

    /* setPlaying: toggle play state and keep the button label in sync */
    function setPlaying(playing) {
        is_playing = playing;
        last_frame_timestamp = null;
        document.getElementById("play_pause_button").textContent = playing
            ? strings.pause[current_language]
            : strings.play[current_language];
    }

    /* stepTime: shift simulation time by a fraction of the event, clamped */
    function stepTime(direction) {
        const total_time = totalTime();
        simulation_time = Math.min(Math.max(simulation_time + direction * total_time / 100, 0), total_time);
    }

    /* buildControls: slider + number pair per numeric parameter, checkbox for toggles */
    function buildControls() {
        const container = document.getElementById("parameter_rows");
        for (const config of parameter_config) {
            const row = document.createElement("div");
            row.className = "parameter-row";
            const label = document.createElement("label");
            label.dataset.i18n = config.key;

            if (config.type === "toggle") {
                row.className = "parameter-row parameter-toggle";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = `toggle_${config.key}`;
                checkbox.checked = parameters[config.key];
                label.htmlFor = checkbox.id;
                checkbox.addEventListener("input", () => {
                    parameters[config.key] = checkbox.checked;
                    simulation_time = Math.min(simulation_time, totalTime());
                    if (!camera.isTouched()) {
                        fitView();
                    }
                });
                row.append(checkbox, label);
                container.append(row);
                continue;
            }

            label.htmlFor = `slider_${config.key}`;
            const unit = document.createElement("span");
            unit.className = "unit";
            unit.textContent = config.unit;
            const slider = document.createElement("input");
            slider.type = "range";
            slider.id = `slider_${config.key}`;
            const number = document.createElement("input");
            number.type = "number";
            number.id = `number_${config.key}`;
            for (const input of [slider, number]) {
                input.min = config.min;
                input.max = config.max;
                input.step = config.step;
                input.value = parameters[config.key];
            }
            slider.addEventListener("input", () => applyParameter(config.key, slider.value, number));
            number.addEventListener("input", () => applyParameter(config.key, number.value, slider));
            const value_wrap = document.createElement("div");
            value_wrap.className = "value-wrap";
            value_wrap.append(number, unit);
            row.append(label, slider, value_wrap);
            container.append(row);
        }
    }

    /* applyParameter: update a parameter from either input, mirror it to the other one */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        if (!Number.isFinite(value)) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        simulation_time = Math.min(simulation_time, totalTime());
        if (!camera.isTouched()) {
            fitView();
        }
    }

    /* buildSpeedButtons: segmented ×0.5 … ×4 playback speed control */
    function buildSpeedButtons() {
        const container = document.getElementById("speed_buttons");
        for (const speed of SPEED_OPTIONS) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = `×${speed}`;
            button.classList.toggle("active", speed === playback_speed);
            button.addEventListener("click", () => {
                playback_speed = speed;
                for (const sibling of container.children) {
                    sibling.classList.toggle("active", sibling === button);
                }
            });
            container.append(button);
        }
    }

    /* applyLanguage: swap every known data-i18n element and persist the choice */
    function applyLanguage(language) {
        current_language = language;
        localStorage.setItem("simulator_language", language);
        document.documentElement.lang = language;
        for (const element of document.querySelectorAll("[data-i18n]")) {
            const entry = strings[element.dataset.i18n];
            if (entry) {
                element.textContent = entry[language];
            }
        }
        document.getElementById("reset_button").title = strings.reset_hint[language];
        document.getElementById("zoom_fit_button").title = strings.zoom_fit_hint[language];
        document.getElementById("language_toggle").textContent = language === "fr" ? "EN" : "FR";
        setPlaying(is_playing);
    }

    /* init: build controls, bind transport, camera and language, start the render loop */
    function init() {
        buildControls();
        buildSpeedButtons();
        camera.bind({
            zoom_in_id: "zoom_in_button",
            zoom_out_id: "zoom_out_button",
            zoom_fit_id: "zoom_fit_button",
            onFit: fitView,
        });

        document.getElementById("play_pause_button").addEventListener("click", () => {
            if (!is_playing && simulation_time >= totalTime()) {
                simulation_time = 0;
            }
            setPlaying(!is_playing);
        });
        document.getElementById("reset_button").addEventListener("click", () => {
            simulation_time = 0;
            setPlaying(false);
        });
        document.getElementById("step_back_button").addEventListener("click", () => stepTime(-1));
        document.getElementById("step_forward_button").addEventListener("click", () => stepTime(1));
        document.getElementById("timeline").addEventListener("input", (event) => {
            simulation_time = Number(event.target.value);
        });
        document.getElementById("language_toggle").addEventListener("click", () => {
            applyLanguage(current_language === "fr" ? "en" : "fr");
        });

        applyLanguage(current_language);
        fitView();
        requestAnimationFrame(animationFrame);
    }

    init();
})();
