/*
 * main.js — Inclined plane page logic: animated scene (slope triangle, angle
 * marker, block with weight / normal / friction / velocity / acceleration
 * vectors, free-body diagram inset), shared pan/zoom camera with auto-follow,
 * transport controls with timeline scrubbing over a precomputed piecewise
 * trajectory, parameters (slope angle 0–90°, mass, initial velocity parallel to
 * the slope, friction coefficient), live formulas (N = m·g·cos α, f = μ·N,
 * a = −g·(sin α ± μ·cos α), equilibrium tan α ≤ μ, stopping distance) and time
 * graphs of s, v and a. Classic script (works via file://); reads the globals
 * of calcul.js, canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.incline_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Plan incliné", en: "Inclined plane" },
        assumption: {
            fr: "Hypothèses : bloc ponctuel lancé parallèlement à la pente (s = 0 au départ, positif vers le haut), coefficient de frottement unique μ = μ_s = μ_c, pas de frottement de l'air. En mouvement : a = −g·(sin α + μ·cos α·signe(v)) ; à l'arrêt, le bloc reste immobile si tan α ≤ μ, sinon il redescend. Le bloc se bloque au pied de la pente s'il l'atteint.",
            en: "Assumptions: point block launched parallel to the slope (s = 0 at start, positive up-slope), single friction coefficient μ = μ_s = μ_k, no air friction. While moving: a = −g·(sin α + μ·cos α·sign(v)); at rest the block stays put iff tan α ≤ μ, otherwise it slides back down. The block is stopped by the bottom corner if it reaches it.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_position: { fr: "Position sur la pente s (m)", en: "Position along the slope s (m)" },
        graph_velocity: { fr: "Vitesse v (m/s)", en: "Velocity v (m/s)" },
        graph_acceleration: { fr: "Accélération a (m/s²)", en: "Acceleration a (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue à la pente", en: "Fit view to the slope" },
        angle_degrees: { fr: "Pente α", en: "Slope α" },
        mass: { fr: "Masse m", en: "Mass m" },
        initial_speed: { fr: "Vitesse initiale v₀ (∥ pente)", en: "Initial velocity v₀ (∥ slope)" },
        friction_coefficient: { fr: "Coefficient de frottement μ", en: "Friction coefficient μ" },
        legend_weight: { fr: "Poids P", en: "Weight P" },
        legend_normal: { fr: "Normale N", en: "Normal N" },
        legend_friction: { fr: "Frottement f", en: "Friction f" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        formula_weight: { fr: "Poids", en: "Weight" },
        formula_normal: { fr: "Réaction normale", en: "Normal force" },
        formula_friction: { fr: "Frottement", en: "Friction" },
        formula_acceleration: { fr: "Accélération (le long de la pente)", en: "Acceleration (along the slope)" },
        formula_equilibrium: { fr: "Équilibre statique", en: "Static equilibrium" },
        formula_stopping: { fr: "Distance d'arrêt (montée)", en: "Stopping distance (going up)" },
        formula_position: { fr: "Position sur la pente", en: "Position along the slope" },
        formula_speed: { fr: "Vitesse", en: "Velocity" },
        equilibrium_holds: { fr: "✓ reste immobile", en: "✓ stays put" },
        equilibrium_slides: { fr: "✗ glisse", en: "✗ slides" },
        friction_static_note: { fr: "statique : f = m·g·sin α", en: "static: f = m·g·sin α" },
        stopping_na: { fr: "— (v₀ ≤ 0)", en: "— (v₀ ≤ 0)" },
        position_note: { fr: "intégration par phases (MRUA)", en: "piecewise integration (MRUA)" },
    };

    const parameter_config = [
        { key: "angle_degrees", min: 0, max: 90, step: 1, unit: "°" },
        { key: "mass", min: 0.1, max: 10, step: 0.1, unit: "kg" },
        { key: "initial_speed", min: -10, max: 10, step: 0.1, unit: "m/s" },
        { key: "friction_coefficient", min: 0, max: 1.5, step: 0.01, unit: "" },
    ];
    const parameters = {
        angle_degrees: 25,
        mass: 2,
        initial_speed: 6,
        friction_coefficient: 0.3,
    };

    const GRAVITY = 9.81;
    const START_OFFSET = 2;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const SIMULATION_DURATION = 20;
    const SIMULATION_RATE = 240;
    const GRAPH_STRIDE = 24;
    const PIXELS_PER_METER_PER_SECOND = 8;
    const PIXELS_PER_NEWTON = 2.2;
    const PIXELS_PER_METER_PER_SECOND_SQUARED = 6;

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
    let trajectory = [];

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* formatOperand: like formatNumber, but negative values are parenthesized */
    function formatOperand(value) {
        return value < 0 ? `(${formatNumber(value)})` : formatNumber(value);
    }

    /* slopeAngle: current slope angle in radians */
    function slopeAngle() {
        return calc.degToRad(parameters.angle_degrees);
    }

    /* slopeUnit / slopeNormal: unit vectors along and perpendicular to the slope */
    function slopeUnit() {
        return { x: Math.cos(slopeAngle()), y: Math.sin(slopeAngle()) };
    }
    function slopeNormal() {
        return { x: -Math.sin(slopeAngle()), y: Math.cos(slopeAngle()) };
    }

    /* rebuildTrajectory: precompute the piecewise motion for scrubbing and graphs */
    function rebuildTrajectory() {
        trajectory = calc.simulate(
            parameters.initial_speed,
            slopeAngle(),
            parameters.friction_coefficient,
            GRAVITY,
            1 / SIMULATION_RATE,
            SIMULATION_DURATION * SIMULATION_RATE,
            -START_OFFSET,
        );
    }

    /* stateAt: trajectory sample closest to the requested time */
    function stateAt(time) {
        const index = Math.min(Math.max(Math.round(time * SIMULATION_RATE), 0), trajectory.length - 1);
        return trajectory[index];
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the traveled slope span (and the game target, if any) */
    function fitView() {
        const unit = slopeUnit();
        let max_s = 2;
        for (const frame of trajectory) {
            max_s = Math.max(max_s, frame.position);
        }
        /* Game mode hook — remove together with game.js */
        const game_extent = typeof globalThis.incline_game_view_extent === "function" ? globalThis.incline_game_view_extent() : null;
        if (game_extent !== null) {
            max_s = Math.max(max_s, game_extent.max_position);
        }
        const top_distance = START_OFFSET + max_s + 2;
        camera.fitTo({
            left: -1,
            right: Math.max(top_distance * unit.x, 4),
            bottom: -1,
            top: Math.max(top_distance * unit.y, 2) + 0.6,
        });
    }

    /* worldOfPosition: world coordinates of a point s metres from the start mark */
    function worldOfPosition(position) {
        const unit = slopeUnit();
        return { x: (START_OFFSET + position) * unit.x, y: (START_OFFSET + position) * unit.y };
    }

    /* drawScene: slope triangle, angle marker, start mark, block and its vectors */
    function drawScene(transform, state) {
        const ink = inkColor();
        const angle = slopeAngle();
        const unit = slopeUnit();
        const normal = slopeNormal();

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const slope_length = Math.max((transform.bounds.right + 2) / Math.max(unit.x, 0.05), transform.bounds.top / Math.max(unit.y, 0.05), 10);
        const corner_x = transform.toScreenX(0);
        const corner_y = transform.toScreenY(0);
        const top_x = transform.toScreenX(slope_length * unit.x);
        const top_y = transform.toScreenY(slope_length * unit.y);

        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.12)";
        context.beginPath();
        context.moveTo(corner_x, corner_y);
        context.lineTo(top_x, top_y);
        context.lineTo(top_x, corner_y);
        context.closePath();
        context.fill();
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(corner_x, corner_y);
        context.lineTo(top_x, top_y);
        context.stroke();
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(transform.toScreenX(transform.bounds.left), corner_y);
        context.lineTo(transform.toScreenX(transform.bounds.right), corner_y);
        context.stroke();

        context.strokeStyle = "#1976d2";
        context.beginPath();
        context.arc(corner_x, corner_y, 34, -angle, 0);
        context.stroke();
        context.fillStyle = "#1976d2";
        context.font = "italic bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText("α", corner_x + 42 * Math.cos(angle / 2), corner_y - 42 * Math.sin(angle / 2));

        const start_world = worldOfPosition(0);
        context.strokeStyle = "rgba(67, 160, 71, 0.8)";
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(transform.toScreenX(start_world.x), transform.toScreenY(start_world.y));
        context.lineTo(
            transform.toScreenX(start_world.x + normal.x * 0.6),
            transform.toScreenY(start_world.y + normal.y * 0.6),
        );
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#43a047";
        context.font = "11px system-ui, sans-serif";
        context.fillText(
            "s = 0",
            transform.toScreenX(start_world.x + normal.x * 0.8),
            transform.toScreenY(start_world.y + normal.y * 0.8),
        );
        context.restore();

        const block_center_world = worldOfPosition(state.position);
        const block_x = transform.toScreenX(block_center_world.x + normal.x * 0.25);
        const block_y = transform.toScreenY(block_center_world.y + normal.y * 0.25);

        const weight = parameters.mass * GRAVITY;
        const normal_force = calc.normalForce(parameters.mass, GRAVITY, angle);
        const moving = Math.abs(state.velocity) > 1e-9;
        let friction_force;
        let friction_direction;
        if (moving) {
            friction_force = calc.kineticFriction(parameters.friction_coefficient, normal_force);
            friction_direction = -Math.sign(state.velocity);
        } else if (calc.staysStopped(angle, parameters.friction_coefficient)) {
            friction_force = weight * Math.sin(angle);
            friction_direction = 1;
        } else {
            friction_force = calc.kineticFriction(parameters.friction_coefficient, normal_force);
            friction_direction = 1;
        }

        context.save();
        context.translate(block_x, block_y);
        context.rotate(-angle);
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.rect(-14, -12, 28, 24);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, block_x, block_y, 0, weight * PIXELS_PER_NEWTON, {
            color: "#d32f2f",
            label: "P",
        });
        draw.drawVector(
            context,
            block_x,
            block_y,
            normal.x * normal_force * PIXELS_PER_NEWTON,
            -normal.y * normal_force * PIXELS_PER_NEWTON,
            { color: "#43a047", label: "N" },
        );
        if (friction_force > 0.01) {
            draw.drawVector(
                context,
                block_x,
                block_y,
                unit.x * friction_direction * friction_force * PIXELS_PER_NEWTON,
                -unit.y * friction_direction * friction_force * PIXELS_PER_NEWTON,
                { color: "#e8722c", label: "f" },
            );
        }
        if (moving) {
            draw.drawVector(
                context,
                block_x,
                block_y,
                unit.x * state.velocity * PIXELS_PER_METER_PER_SECOND,
                -unit.y * state.velocity * PIXELS_PER_METER_PER_SECOND,
                { color: ink, dash: [7, 5], line_width: 2, label: "v" },
            );
        }
        if (Math.abs(state.acceleration) > 1e-9) {
            draw.drawVector(
                context,
                block_x,
                block_y,
                unit.x * state.acceleration * PIXELS_PER_METER_PER_SECOND_SQUARED,
                -unit.y * state.acceleration * PIXELS_PER_METER_PER_SECOND_SQUARED,
                { color: ink, dash: [2, 4], line_width: 2, label: "a" },
            );
        }

        drawFreeBodyInset(ink, angle, weight, normal_force, friction_force, friction_direction);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.incline_game_overlay === "function") {
            globalThis.incline_game_overlay(context, transform, {
                time: state.time,
                position: state.position,
                velocity: state.velocity,
            });
        }
        return { weight, normal_force, friction_force, friction_direction };
    }

    /* drawFreeBodyInset: block alone with weight, normal and friction */
    function drawFreeBodyInset(ink, angle, weight, normal_force, friction_force, friction_direction) {
        const box_width = 168;
        const box_height = 190;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 92;
        const unit = slopeUnit();
        const normal = slopeNormal();
        const scale = 46 / Math.max(weight, 1);

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

        context.save();
        context.translate(center_x, center_y);
        context.rotate(-angle);
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.rect(-11, -9, 22, 18);
        context.fill();
        context.stroke();
        context.restore();
        context.restore();

        draw.drawVector(context, center_x, center_y, 0, weight * scale, { color: "#d32f2f", label: "P" });
        draw.drawVector(context, center_x, center_y, normal.x * normal_force * scale, -normal.y * normal_force * scale, {
            color: "#43a047",
            label: "N",
        });
        if (friction_force > 0.01) {
            draw.drawVector(
                context,
                center_x,
                center_y,
                unit.x * friction_direction * friction_force * scale,
                -unit.y * friction_direction * friction_force * scale,
                { color: "#e8722c", label: "f" },
            );
        }
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(state, forces) {
        const angle_degrees = parameters.angle_degrees;
        const mu = parameters.friction_coefficient;
        const holds = calc.staysStopped(slopeAngle(), mu);
        const moving = Math.abs(state.velocity) > 1e-9;
        const cards = {
            weight: {
                substitution: `${formatNumber(parameters.mass)} × ${formatNumber(GRAVITY)}`,
                result: `${formatNumber(forces.weight)} N`,
            },
            normal: {
                substitution: `${formatNumber(parameters.mass)} × ${formatNumber(GRAVITY)} × cos ${angle_degrees}°`,
                result: `${formatNumber(forces.normal_force)} N`,
            },
            friction: {
                substitution: moving || !holds
                    ? `${formatNumber(mu)} × ${formatNumber(forces.normal_force)}`
                    : strings.friction_static_note[current_language],
                result: `${formatNumber(forces.friction_force)} N`,
            },
            acceleration: {
                substitution: `−${formatNumber(GRAVITY)} × (sin ${angle_degrees}° ${moving && state.velocity < 0 ? "−" : "+"} ${formatNumber(mu)} × cos ${angle_degrees}°)`,
                result: `${formatNumber(state.acceleration)} m/s²`,
            },
            equilibrium: {
                substitution: `tan ${angle_degrees}° = ${formatNumber(Math.tan(slopeAngle()))} vs μ = ${formatNumber(mu)}`,
                result: holds
                    ? strings.equilibrium_holds[current_language]
                    : strings.equilibrium_slides[current_language],
            },
            stopping: {
                substitution: parameters.initial_speed > 0
                    ? `${formatNumber(parameters.initial_speed)}² / (2 × ${formatNumber(GRAVITY)} × (sin ${angle_degrees}° + ${formatNumber(mu)} × cos ${angle_degrees}°))`
                    : strings.stopping_na[current_language],
                result: parameters.initial_speed > 0
                    ? `${formatNumber(calc.stoppingDistance(parameters.initial_speed, slopeAngle(), mu, GRAVITY))} m`
                    : "—",
            },
            position: {
                substitution: strings.position_note[current_language],
                result: `s = ${formatNumber(state.position)} m`,
            },
            speed: {
                substitution: `v₀ = ${formatOperand(parameters.initial_speed)}`,
                result: `v = ${formatNumber(state.velocity)} m/s`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: position, velocity and acceleration along the slope versus time */
    function drawGraphs(time) {
        const s_points = [];
        const v_points = [];
        const a_points = [];
        for (let i = 0; i < trajectory.length; i += GRAPH_STRIDE) {
            const frame = trajectory[i];
            s_points.push([frame.time, frame.position]);
            v_points.push([frame.time, frame.velocity]);
            a_points.push([frame.time, frame.acceleration]);
        }
        graph.drawTimeGraph(document.getElementById("graph_position"), [
            { label: "s", color: "#1976d2", points: s_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocity"), [
            { label: "v", color: "#1976d2", points: v_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_acceleration"), [
            { label: "a", color: "#d32f2f", points: a_points },
        ], { cursor_time: time, unit: "m/s²" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const time = Math.min(simulation_time, SIMULATION_DURATION);
        const state = stateAt(time);
        const forces = drawScene(camera.transform(), state);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        document.getElementById("timeline").value = time;
        updateFormulas(state, forces);
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
                if (simulation_time >= SIMULATION_DURATION) {
                    simulation_time = SIMULATION_DURATION;
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
        simulation_time = Math.min(Math.max(simulation_time + delta_seconds, 0), SIMULATION_DURATION);
    }

    /* buildControls: one slider + number input pair per physical parameter */
    function buildControls() {
        const container = document.getElementById("parameter_rows");
        for (const config of parameter_config) {
            const row = document.createElement("div");
            row.className = "parameter-row";

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

    /* applyParameter: update a parameter, rebuild the trajectory, keep auto-follow */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        if (!Number.isFinite(value)) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        rebuildTrajectory();
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
            if (!is_playing && simulation_time >= SIMULATION_DURATION) {
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

        rebuildTrajectory();
        applyLanguage(current_language);
        fitView();
        requestAnimationFrame(animationFrame);
    }

    init();
})();
