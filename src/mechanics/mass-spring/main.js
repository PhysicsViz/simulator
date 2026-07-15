/*
 * main.js — Mass-on-spring page logic: animated scene with the vertical coil
 * spring compressing under the falling mass, drop-height / lowest-point /
 * equilibrium-compression markers, weight / spring-force / velocity /
 * acceleration vectors and a free-body diagram inset; shared pan/zoom camera
 * with auto-follow; transport controls over two full bounce cycles (exact
 * piecewise motion, no losses); parameters m, h, g and the LINKED pair k ↔ d
 * (editing the depression d recomputes the stiffness through the course
 * answer k = 2·m·g·(h+d)/d², editing k or anything else recomputes d);
 * formulas showing the energy conservation, the course question, the impact
 * speed, x_eq, ω and the per-phase equations; time graphs of y, v, a and the
 * three energies. Classic script (works via file://); reads the globals of
 * calcul.js, canvas_draw.js, scene_camera.js, graph_plot.js. The spring's
 * rest length is a display choice only.
 */
(() => {
    const calc = globalThis.mass_spring_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Masse et ressort (trampoline)", en: "Mass on a spring (trampoline)" },
        assumption: {
            fr: "Hypothèses : ressort vertical idéal (masse nulle, réponse linéaire F = k·x, aucune perte) ; la masse est ponctuelle et reste guidée verticalement ; pas de frottement ni de résistance de l'air ; la masse n'est pas attachée au ressort (elle le quitte dès que x = 0). y est mesuré depuis le sommet du ressort au repos ; lâcher sans vitesse depuis y = h. Mouvement exact par morceaux : chute libre (MRUA), contact harmonique x(t') autour de x_éq = m·g/k, remontée symétrique jusqu'à h — mouvement périodique. Les curseurs k et d sont liés : modifier l'un recalcule l'autre via m·g·(h+d) = ½·k·d². Longueur à vide du ressort : choix d'affichage uniquement.",
            en: "Assumptions: ideal vertical spring (massless, linear response F = k·x, no losses); point mass, vertically guided; no friction or air resistance; the mass is not attached to the spring (it leaves as soon as x = 0). y is measured from the top of the relaxed spring; released from rest at y = h. Exact piecewise motion: free fall (MRUA), harmonic contact x(t') about x_eq = m·g/k, symmetric ascent back to h — periodic. The k and d sliders are linked: editing one recomputes the other through m·g·(h+d) = ½·k·d². The spring's rest length is a display choice only.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_position: { fr: "Hauteur y (m)", en: "Height y (m)" },
        graph_velocity: { fr: "Vitesse v (m/s, vers le haut > 0)", en: "Velocity v (m/s, upward > 0)" },
        graph_acceleration: { fr: "Accélération a (m/s²)", en: "Acceleration a (m/s²)" },
        graph_energy: { fr: "Énergies (J)", en: "Energies (J)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au montage", en: "Fit view to the setup" },
        mass: { fr: "Masse m", en: "Mass m" },
        drop_height: { fr: "Hauteur de chute h", en: "Drop height h" },
        stiffness: { fr: "Raideur du ressort k", en: "Spring constant k" },
        depression: { fr: "Enfoncement maximal d", en: "Maximum depression d" },
        gravity: { fr: "Pesanteur g", en: "Gravity g" },
        legend_weight: { fr: "Poids P = m·g", en: "Weight P = m·g" },
        legend_spring: { fr: "Force du ressort F = k·x", en: "Spring force F = k·x" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        marker_height: { fr: "h = {v} m", en: "h = {v} m" },
        marker_depression: { fr: "point le plus bas : d = {v} m", en: "lowest point: d = {v} m" },
        marker_equilibrium: { fr: "x_éq", en: "x_eq" },
        formula_energy: { fr: "Conservation de l'énergie", en: "Energy conservation" },
        formula_course: { fr: "Question du cours : raideur k", en: "Course question: stiffness k" },
        formula_depression: { fr: "Enfoncement maximal", en: "Maximum depression" },
        formula_impact: { fr: "Vitesse d'impact", en: "Impact speed" },
        formula_xeq: { fr: "Compression d'équilibre", en: "Equilibrium compression" },
        formula_omega: { fr: "Pulsation du contact", en: "Contact angular frequency" },
        formula_contact: { fr: "Durée du contact", en: "Contact duration" },
        formula_phase: { fr: "Équation de la phase en cours", en: "Equation of the current phase" },
        formula_energies: { fr: "Bilan d'énergie à l'instant t", en: "Energy budget at time t" },
        phase_fall: { fr: "chute libre (MRUA)", en: "free fall (MRUA)" },
        phase_contact: { fr: "contact (harmonique)", en: "contact (harmonic)" },
        phase_ascent: { fr: "remontée (MRUA)", en: "ascent (MRUA)" },
        math_fall: { fr: "y(t) = h − g·t²/2", en: "y(t) = h − g·t²/2" },
        math_contact: { fr: "x(t′) = x_éq·(1 − cos ω·t′) + (v/ω)·sin ω·t′", en: "x(t′) = x_eq·(1 − cos ω·t′) + (v/ω)·sin ω·t′" },
        math_ascent: { fr: "y(t″) = v·t″ − g·t″²/2", en: "y(t″) = v·t″ − g·t″²/2" },
    };

    const parameter_config = [
        { key: "mass", min: 10, max: 120, step: 1, unit: "kg" },
        { key: "drop_height", min: 0, max: 5, step: 0.05, unit: "m" },
        { key: "stiffness", min: 500, max: 200000, step: 10, unit: "N/m" },
        { key: "depression", min: 0.05, max: 2, step: 0.01, unit: "m" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        mass: 68,
        drop_height: 3,
        stiffness: 0,
        depression: 0.45,
        gravity: 9.81,
    };

    const CYCLES_SHOWN = 2;
    const MASS_WIDTH = 0.8;
    const MASS_HEIGHT = 0.5;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 160;
    const FORCE_ARROW_PIXELS = 60;
    const MOTION_ARROW_PIXELS = 45;
    const WEIGHT_COLOR = "#d32f2f";
    const SPRING_COLOR = "#1976d2";

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const camera = globalThis.scene_camera.createCamera(canvas);
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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

    /* syncDepressionFromStiffness: recompute d from the current k (and m, h, g) */
    function syncDepressionFromStiffness() {
        parameters.depression = calc.maxDepression(
            parameters.mass, parameters.gravity, parameters.drop_height, parameters.stiffness,
        );
    }

    /* syncStiffnessFromDepression: recompute k from the current d — the course answer */
    function syncStiffnessFromDepression() {
        parameters.stiffness = calc.springConstantFromDepression(
            parameters.mass, parameters.gravity, parameters.drop_height, parameters.depression,
        );
    }

    /* setInputPair: push a computed value into a slider + number pair */
    function setInputPair(key, value) {
        const rounded = Math.round(value * 100) / 100;
        document.getElementById(`slider_${key}`).value = rounded;
        document.getElementById(`number_${key}`).value = rounded;
    }

    /* totalTime: two full bounce cycles */
    function totalTime() {
        return CYCLES_SHOWN * calc.cyclePeriod(
            parameters.mass, parameters.gravity, parameters.drop_height, parameters.stiffness,
        );
    }

    /* springRestLength: display length, always longer than the deepest compression */
    function springRestLength() {
        return Math.max(1.2, 1.25 * parameters.depression + 0.2);
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the drop height and the fully compressed spring */
    function fitView() {
        camera.fitTo({
            left: -3,
            right: 3,
            bottom: -springRestLength() - 0.6,
            top: parameters.drop_height + MASS_HEIGHT + 0.8,
        });
    }

    /* drawGroundAndSpring: hatched floor, coil from the floor up to the spring top */
    function drawGroundAndSpring(transform, spring_top, ink) {
        const rest_length = springRestLength();
        const floor_screen = transform.toScreenY(-rest_length);
        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, floor_screen);
        context.lineTo(canvas.width, floor_screen);
        context.stroke();
        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.lineWidth = 1;
        context.beginPath();
        for (let x = 0; x < canvas.width; x += 14) {
            context.moveTo(x, floor_screen);
            context.lineTo(x - 8, floor_screen + 8);
        }
        context.stroke();

        const coils = 9;
        const amplitude = 0.45;
        context.strokeStyle = ink;
        context.lineWidth = 2.2;
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(transform.toScreenX(0), floor_screen);
        for (let i = 1; i <= coils; i++) {
            const world_y = -rest_length + (rest_length + spring_top) * i / coils;
            const world_x = i === coils ? 0 : (i % 2 === 1 ? -amplitude : amplitude);
            context.lineTo(transform.toScreenX(world_x), transform.toScreenY(world_y));
        }
        context.stroke();
        context.restore();
    }

    /* drawMarkers: drop height, lowest point and equilibrium compression lines */
    function drawMarkers(transform, ink) {
        const lines = [
            {
                world_y: parameters.drop_height,
                color: "rgba(120, 130, 145, 0.75)",
                label: strings.marker_height[current_language].replace("{v}", formatNumber(parameters.drop_height)),
            },
            {
                world_y: -parameters.depression,
                color: "#b8860b",
                label: strings.marker_depression[current_language].replace("{v}", formatNumber(parameters.depression)),
            },
            {
                world_y: -calc.equilibriumCompression(parameters.mass, parameters.gravity, parameters.stiffness),
                color: "rgba(67, 160, 71, 0.8)",
                label: strings.marker_equilibrium[current_language],
            },
        ];
        context.save();
        for (const line of lines) {
            const screen_y = transform.toScreenY(line.world_y);
            context.strokeStyle = line.color;
            context.lineWidth = 1.5;
            context.setLineDash([7, 6]);
            context.beginPath();
            context.moveTo(0, screen_y);
            context.lineTo(canvas.width, screen_y);
            context.stroke();
            context.setLineDash([]);
            context.fillStyle = line.color;
            context.font = "bold 12px system-ui, sans-serif";
            context.textAlign = "left";
            context.textBaseline = "bottom";
            context.fillText(line.label, 10, screen_y - 4);
        }
        context.restore();
    }

    /* drawMass: the block with its bottom at the spring top / current height */
    function drawMass(transform, bottom_height, ink) {
        const left = transform.toScreenX(-MASS_WIDTH / 2);
        const top = transform.toScreenY(bottom_height + MASS_HEIGHT);
        const width = transform.toScreenX(MASS_WIDTH / 2) - left;
        const height = transform.toScreenY(bottom_height) - top;
        context.save();
        context.fillStyle = "rgba(25, 118, 210, 0.25)";
        context.strokeStyle = "#1976d2";
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(left, top, width, height, 5);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`m = ${formatNumber(parameters.mass)} kg`, left + width / 2, top + height / 2);
        context.restore();
    }

    /* drawMassVectors: P, spring force, v and a on the mass */
    function drawMassVectors(transform, state, references, ink) {
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(state.height + MASS_HEIGHT / 2);
        const bottom_y = transform.toScreenY(state.height);
        const force_scale = FORCE_ARROW_PIXELS / references.force;
        const spring_force = state.in_contact ? parameters.stiffness * Math.max(-state.height, 0) : 0;
        draw.drawVector(context, center_x, center_y, 0, parameters.mass * parameters.gravity * force_scale, {
            color: WEIGHT_COLOR,
            label: "P",
        });
        if (spring_force > 0) {
            draw.drawVector(context, center_x, bottom_y, 0, -spring_force * force_scale, {
                color: SPRING_COLOR,
                label: "F = k·x",
            });
        }
        if (references.speed > 0 && Math.abs(state.velocity) > 1e-9) {
            draw.drawVector(context, center_x - 40, center_y, 0, -state.velocity * MOTION_ARROW_PIXELS / references.speed, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (references.acceleration > 0 && Math.abs(state.acceleration) > 1e-9) {
            draw.drawVector(context, center_x + 40, center_y, 0, -state.acceleration * MOTION_ARROW_PIXELS / references.acceleration, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
        return spring_force;
    }

    /* drawFreeBodyInset: the mass alone with P and the spring force */
    function drawFreeBodyInset(spring_force, ink) {
        const box_width = 190;
        const box_height = 180;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 86;
        const weight = parameters.mass * parameters.gravity;
        const inset_scale = 52 / Math.max(weight, spring_force, 1e-9);

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

        context.fillStyle = "rgba(25, 118, 210, 0.25)";
        context.strokeStyle = "#1976d2";
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(center_x - 15, center_y - 11, 30, 22, 3);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, center_x, center_y + 11, 0, Math.max(weight * inset_scale, 12), {
            color: WEIGHT_COLOR,
            label: "P",
        });
        if (spring_force > 0) {
            draw.drawVector(context, center_x, center_y - 11, 0, -Math.max(spring_force * inset_scale, 12), {
                color: SPRING_COLOR,
                label: "F",
            });
        }
        context.save();
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = WEIGHT_COLOR;
        context.fillText(`P = ${formatNumber(weight)} N`, center_x, box_y + box_height - 42);
        context.fillStyle = SPRING_COLOR;
        context.fillText(`F = ${formatNumber(spring_force)} N`, center_x, box_y + box_height - 26);
        context.restore();
    }

    /* drawScene: full scene for a given time; returns the live quantities */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = calc.motionAt(
            parameters.mass, parameters.gravity, parameters.drop_height, parameters.stiffness, time,
        );
        const impact = calc.impactSpeed(parameters.gravity, parameters.drop_height);
        const omega = calc.angularFrequency(parameters.stiffness, parameters.mass);
        const references = {
            force: Math.max(parameters.mass * parameters.gravity, parameters.stiffness * parameters.depression, 1e-9),
            speed: Math.max(Math.hypot(impact, omega * calc.equilibriumCompression(parameters.mass, parameters.gravity, parameters.stiffness)), 1e-9),
            acceleration: Math.max(calc.maxAcceleration(parameters.mass, parameters.gravity, parameters.drop_height, parameters.stiffness), parameters.gravity),
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        const spring_top = Math.min(state.height, 0);
        drawGroundAndSpring(transform, spring_top, ink);

        /* Game mode hook — remove together with game.js (the lowest-point and
           x_eq markers pre-reveal the depression the game asks to bound) */
        if (!document.body.classList.contains("game-mode")) {
            drawMarkers(transform, ink);
        }

        drawMass(transform, state.height, ink);
        const spring_force = drawMassVectors(transform, state, references, ink);
        drawFreeBodyInset(spring_force, ink);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.mass_spring_game_overlay === "function") {
            globalThis.mass_spring_game_overlay(context, transform, {
                time,
                total_time: Math.max(totalTime(), 1e-9),
                compression: Math.max(-state.height, 0),
                acceleration: state.acceleration,
                in_contact: state.in_contact,
            });
        }
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const weight = parameters.mass * parameters.gravity;
        const impact = calc.impactSpeed(parameters.gravity, parameters.drop_height);
        const omega = calc.angularFrequency(parameters.stiffness, parameters.mass);
        const rest_compression = calc.equilibriumCompression(parameters.mass, parameters.gravity, parameters.stiffness);
        const energy = calc.energies(parameters.mass, parameters.gravity, parameters.stiffness, state);
        const total_energy = energy.kinetic + energy.gravitational + energy.elastic;
        const phase_key = state.in_contact ? "phase_contact" : (state.velocity > 0 ? "phase_ascent" : "phase_fall");
        const math_key = state.in_contact ? "math_contact" : (state.velocity > 0 ? "math_ascent" : "math_fall");
        document.getElementById("math_phase").textContent = strings[math_key][current_language];

        const cards = {
            energy: {
                substitution: `${formatNumber(weight)} × (${formatNumber(parameters.drop_height)} + ${formatNumber(parameters.depression)}) = ½ × ${formatNumber(parameters.stiffness)} × ${formatNumber(parameters.depression)}²`,
                result: `${formatNumber(weight * (parameters.drop_height + parameters.depression))} J ✓`,
            },
            course: {
                substitution: `2 × ${formatNumber(parameters.mass)} × ${formatNumber(parameters.gravity)} × (${formatNumber(parameters.drop_height)} + ${formatNumber(parameters.depression)}) / ${formatNumber(parameters.depression)}²`,
                result: `${formatNumber(parameters.stiffness)} N/m`,
            },
            depression: {
                substitution: `${formatNumber(rest_compression)} + √(${formatNumber(rest_compression)}² + (${formatNumber(impact)}/${formatNumber(omega)})²)`,
                result: `${formatNumber(parameters.depression)} m`,
            },
            impact: {
                substitution: `√(2 × ${formatNumber(parameters.gravity)} × ${formatNumber(parameters.drop_height)})`,
                result: `${formatNumber(impact)} m/s`,
            },
            xeq: {
                substitution: `${formatNumber(weight)} / ${formatNumber(parameters.stiffness)}`,
                result: `${formatNumber(rest_compression * 100)} cm`,
            },
            omega: {
                substitution: `√(${formatNumber(parameters.stiffness)} / ${formatNumber(parameters.mass)})`,
                result: `${formatNumber(omega)} rad/s`,
            },
            contact: {
                substitution: `(2π − 2 × ${formatNumber(Math.atan2(impact / omega, rest_compression))}) / ${formatNumber(omega)}`,
                result: `${formatNumber(calc.contactDuration(parameters.mass, parameters.gravity, parameters.drop_height, parameters.stiffness))} s`,
            },
            phase: {
                substitution: strings[phase_key][current_language],
                result: `y = ${formatNumber(state.height)} m`,
            },
            energies: {
                substitution: `${formatNumber(energy.kinetic)} + ${formatNumber(energy.gravitational)} + ${formatNumber(energy.elastic)}`,
                result: `${formatNumber(total_energy)} J = m·g·h ✓`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: y, v, a and the three energies versus time with live cursor */
    function drawGraphs(time) {
        const total_time = Math.max(totalTime(), 1e-9);
        const y_points = [];
        const v_points = [];
        const a_points = [];
        const kinetic_points = [];
        const gravitational_points = [];
        const elastic_points = [];
        const total_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            const state = calc.motionAt(
                parameters.mass, parameters.gravity, parameters.drop_height, parameters.stiffness, sample_time,
            );
            const energy = calc.energies(parameters.mass, parameters.gravity, parameters.stiffness, state);
            y_points.push([sample_time, state.height]);
            v_points.push([sample_time, state.velocity]);
            a_points.push([sample_time, state.acceleration]);
            kinetic_points.push([sample_time, energy.kinetic]);
            gravitational_points.push([sample_time, energy.gravitational]);
            elastic_points.push([sample_time, energy.elastic]);
            total_points.push([sample_time, energy.kinetic + energy.gravitational + energy.elastic]);
        }
        graph.drawTimeGraph(document.getElementById("graph_position"), [
            { label: "y", color: "#1976d2", points: y_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocity"), [
            { label: "v", color: "#d32f2f", points: v_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_acceleration"), [
            { label: "a", color: "#43a047", points: a_points },
        ], { cursor_time: time, unit: "m/s²" });
        graph.drawTimeGraph(document.getElementById("graph_energy"), [
            { label: "E_c", color: "#d32f2f", points: kinetic_points },
            { label: "E_p", color: "#1976d2", points: gravitational_points },
            { label: "E_él", color: "#43a047", points: elastic_points },
            { label: "E_tot", color: "#8e24aa", points: total_points },
        ], { cursor_time: time, unit: "J" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const total_time = totalTime();
        const time = Math.min(simulation_time, total_time);
        const state = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        const timeline = document.getElementById("timeline");
        timeline.max = Math.max(total_time, 0.01);
        timeline.value = time;
        updateFormulas(time, state);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs(time);
        }
    }

    /* animationFrame: advance simulation time while playing, then render */
    function animationFrame(timestamp) {
        if (is_playing) {
            if (last_frame_timestamp !== null) {
                const delta_seconds = Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
                simulation_time += delta_seconds * playback_speed;
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

    /* stepTime: shift simulation time by a signed amount, clamped to the window */
    function stepTime(delta_seconds) {
        simulation_time = Math.min(Math.max(simulation_time + delta_seconds, 0), totalTime());
    }

    /* buildControls: slider + number pair per parameter, rows carry ids for the game */
    function buildControls() {
        const container = document.getElementById("parameter_rows");
        for (const config of parameter_config) {
            const row = document.createElement("div");
            row.className = "parameter-row";
            row.id = `row_${config.key}`;
            const label = document.createElement("label");
            label.dataset.i18n = config.key;
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
                input.value = Math.round(parameters[config.key] * 100) / 100;
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

    /* applyParameter: update a parameter and keep k and d consistent —
       editing d drives k (the course direction), anything else drives d */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        if (!Number.isFinite(value) || (key === "depression" && value <= 0)) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        if (key === "depression") {
            syncStiffnessFromDepression();
            setInputPair("stiffness", parameters.stiffness);
        } else {
            syncDepressionFromStiffness();
            setInputPair("depression", parameters.depression);
        }
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

    /* init: sync the linked pair, build controls, bind transport, camera, language */
    function init() {
        syncStiffnessFromDepression();
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
        document.getElementById("step_back_button").addEventListener("click", () => stepTime(-TIME_STEP));
        document.getElementById("step_forward_button").addEventListener("click", () => stepTime(TIME_STEP));
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
