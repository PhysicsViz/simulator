/*
 * main.js — Projectile motion page logic: animated scene with force vectors and
 * free-body diagram inset, shared pan/zoom camera with auto-follow, transport
 * controls, parameter inputs (‖v0‖, theta, h0, g), time graphs (positions,
 * velocities, accelerations) and formulas following the course formulary
 * notation: u0/v0 = horizontal/vertical initial velocity components, horizontal
 * motion = MRU, vertical = MRUA, written as separate scalar equations.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js and graph_plot.js. Fixed mass m = 1 kg.
 */
(() => {
    const calc = globalThis.projectile_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Tir parabolique", en: "Projectile motion" },
        assumption: {
            fr: "Hypothèses : champ de pesanteur uniforme, frottements de l'air négligés, lancement depuis la hauteur h₀, masse fixée à m = 1 kg, axe y vers le haut. Mouvement horizontal = MRU, mouvement vertical = MRUA. La seule force appliquée est le poids P = m·g.",
            en: "Assumptions: uniform gravity field, air resistance neglected, launch from height h₀, fixed mass m = 1 kg, y axis pointing up. Horizontal motion = uniform (MRU), vertical = uniformly accelerated (MRUA). The only applied force is the weight P = m·g.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Positions (m)", en: "Positions (m)" },
        graph_velocities: { fr: "Vitesses (m/s)", en: "Velocities (m/s)" },
        graph_accelerations: { fr: "Accélérations (m/s²)", en: "Accelerations (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue à la trajectoire", en: "Fit view to trajectory" },
        initial_speed: { fr: "Vitesse initiale ‖v₀‖", en: "Initial speed ‖v₀‖" },
        launch_angle_degrees: { fr: "Angle de tir θ", en: "Launch angle θ" },
        initial_height: { fr: "Hauteur initiale h₀ = y₀", en: "Initial height h₀ = y₀" },
        gravity: { fr: "Accélération de pesanteur g", en: "Gravitational acceleration g" },
        legend_weight: { fr: "Poids P", en: "Weight P" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a = g", en: "Acceleration a = g" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        formula_u0: { fr: "Vitesse initiale horizontale", en: "Initial horizontal velocity" },
        formula_v0: { fr: "Vitesse initiale verticale", en: "Initial vertical velocity" },
        formula_x: { fr: "Position horizontale", en: "Horizontal position" },
        formula_y: { fr: "Position verticale", en: "Vertical position" },
        formula_u: { fr: "Vitesse horizontale (MRU)", en: "Horizontal velocity (MRU)" },
        formula_v: { fr: "Vitesse verticale (MRUA)", en: "Vertical velocity (MRUA)" },
        formula_a: { fr: "Accélération", en: "Acceleration" },
        formula_a_note: { fr: "MRU horizontal · MRUA vertical", en: "horizontal MRU · vertical MRUA" },
        formula_weight: { fr: "Poids", en: "Weight" },
        formula_flight_time: { fr: "Temps de vol", en: "Flight time" },
        formula_max_height: { fr: "Hauteur maximale", en: "Maximum height" },
        formula_range: { fr: "Portée", en: "Range" },
    };

    const parameter_config = [
        { key: "initial_speed", min: 0, max: 40, step: 0.5, unit: "m/s" },
        { key: "launch_angle_degrees", min: -90, max: 90, step: 1, unit: "°" },
        { key: "initial_height", min: 0, max: 30, step: 0.5, unit: "m" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        initial_speed: 15,
        launch_angle_degrees: 60,
        initial_height: 0,
        gravity: 9.81,
    };

    const PROJECTILE_MASS = 1;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 80;
    const PIXELS_PER_METER_PER_SECOND = 4;
    const PIXELS_PER_NEWTON = 5.5;
    const PIXELS_PER_METER_PER_SECOND_SQUARED = 2.5;

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

    /* formatOperand: like formatNumber, but negative values are parenthesized so
       substitutions like (−6,34)² stay unambiguous */
    function formatOperand(value) {
        return value < 0 ? `(${formatNumber(value)})` : formatNumber(value);
    }

    /* launchAngle: current launch angle in radians */
    function launchAngle() {
        return calc.degToRad(parameters.launch_angle_degrees);
    }

    /* totalFlightTime: flight time for the current parameters (0 when the launch is degenerate) */
    function totalFlightTime() {
        return calc.flightTime(parameters.initial_height, parameters.initial_speed, launchAngle(), parameters.gravity);
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the whole current trajectory (and the game target, if any) */
    function fitView() {
        const angle = launchAngle();
        let range = Math.max(calc.horizontalRange(parameters.initial_height, parameters.initial_speed, angle, parameters.gravity), 1);
        let peak = Math.max(calc.maxHeight(parameters.initial_height, parameters.initial_speed, angle, parameters.gravity), 1);
        /* Game mode hook — remove together with game.js */
        const game_extent = typeof globalThis.projectile_game_view_extent === "function" ? globalThis.projectile_game_view_extent() : null;
        if (game_extent !== null) {
            range = Math.max(range, game_extent.right);
            peak = Math.max(peak, game_extent.top);
        }
        camera.fitTo({ left: 0, right: range, bottom: 0, top: peak });
    }

    /* drawScene: grid, ground, angle marker, trajectory, projectile and its vectors */
    function drawScene(transform, time) {
        const angle = launchAngle();
        const ink = inkColor();

        context.clearRect(0, 0, canvas.width, canvas.height);

        const ground_screen_y = transform.toScreenY(0);
        if (ground_screen_y < canvas.height) {
            context.save();
            context.fillStyle = "rgba(120, 130, 145, 0.10)";
            context.fillRect(0, ground_screen_y, canvas.width, canvas.height - ground_screen_y);
            context.restore();
        }

        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const launch_screen_x = transform.toScreenX(0);
        const launch_screen_y = transform.toScreenY(parameters.initial_height);
        context.save();
        context.strokeStyle = "#1976d2";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(launch_screen_x, launch_screen_y, 30, Math.min(-angle, 0), Math.max(-angle, 0));
        context.stroke();
        context.fillStyle = "#1976d2";
        context.font = "italic bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText("θ", launch_screen_x + 38 * Math.cos(angle / 2), launch_screen_y - 38 * Math.sin(angle / 2));
        context.restore();

        const total_time = Math.max(totalFlightTime(), 1e-9);
        /* Game mode hook — remove together with game.js */
        const hide_prediction = document.body.classList.contains("game-mode");
        if (!hide_prediction) {
            context.save();
            context.strokeStyle = "rgba(120, 130, 145, 0.55)";
            context.setLineDash([6, 6]);
            context.lineWidth = 1.5;
            context.beginPath();
            for (let i = 0; i <= 120; i++) {
                const sample_time = (total_time * i) / 120;
                const screen_x = transform.toScreenX(calc.positionX(parameters.initial_speed, angle, sample_time));
                const screen_y = transform.toScreenY(calc.positionY(parameters.initial_height, parameters.initial_speed, angle, parameters.gravity, sample_time));
                if (i === 0) {
                    context.moveTo(screen_x, screen_y);
                } else {
                    context.lineTo(screen_x, screen_y);
                }
            }
            context.stroke();
            context.restore();
        }

        context.save();
        context.strokeStyle = "#1976d2";
        context.lineWidth = 2.5;
        context.beginPath();
        const traveled_samples = Math.max(Math.round((time / total_time) * 120), 1);
        for (let i = 0; i <= traveled_samples; i++) {
            const sample_time = Math.min((total_time * i) / 120, time);
            const screen_x = transform.toScreenX(calc.positionX(parameters.initial_speed, angle, sample_time));
            const screen_y = transform.toScreenY(calc.positionY(parameters.initial_height, parameters.initial_speed, angle, parameters.gravity, sample_time));
            if (i === 0) {
                context.moveTo(screen_x, screen_y);
            } else {
                context.lineTo(screen_x, screen_y);
            }
        }
        context.stroke();
        context.restore();

        const ball_world_x = calc.positionX(parameters.initial_speed, angle, time);
        const ball_world_y = calc.positionY(parameters.initial_height, parameters.initial_speed, angle, parameters.gravity, time);
        const projectile_x = transform.toScreenX(ball_world_x);
        const projectile_y = transform.toScreenY(ball_world_y);
        const velocity_x = calc.velocityX(parameters.initial_speed, angle);
        const velocity_y = calc.velocityY(parameters.initial_speed, angle, parameters.gravity, time);
        const weight = calc.weightForce(PROJECTILE_MASS, parameters.gravity);

        draw.drawVector(context, projectile_x, projectile_y, 0, weight * PIXELS_PER_NEWTON, {
            color: "#d32f2f",
            label: "P",
        });
        draw.drawVector(context, projectile_x, projectile_y, 0, parameters.gravity * PIXELS_PER_METER_PER_SECOND_SQUARED, {
            color: ink,
            dash: [2, 4],
            line_width: 2,
            label: "a",
        });
        draw.drawVector(
            context,
            projectile_x,
            projectile_y,
            velocity_x * PIXELS_PER_METER_PER_SECOND,
            -velocity_y * PIXELS_PER_METER_PER_SECOND,
            { color: ink, dash: [7, 5], line_width: 2, label: "v" },
        );

        context.save();
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(projectile_x, projectile_y, 7, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        drawFreeBodyInset(ink, weight);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.projectile_game_overlay === "function") {
            globalThis.projectile_game_overlay(context, transform, {
                time,
                total_time,
                ball_x: ball_world_x,
                ball_y: ball_world_y,
            });
        }
        return { velocity_x, velocity_y, weight };
    }

    /* drawFreeBodyInset: object alone with every applied force (weight only here) */
    function drawFreeBodyInset(ink, weight) {
        const box_width = 168;
        const box_height = 170;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 64;

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

        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, 9, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, center_x, center_y, 0, 62, { color: "#d32f2f", label: "P" });

        context.save();
        context.fillStyle = "#d32f2f";
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`P = m·g = ${formatNumber(weight)} N`, center_x, center_y + 82);
        context.restore();
    }

    /* updateFormulas: refresh substitution text and result for every formula card.
       Notation follows the course formulary: u0 horizontal / v0 vertical initial
       velocity components, formulas as separate scalar equations */
    function updateFormulas(time, velocity_x, velocity_y, weight) {
        const speed = parameters.initial_speed;
        const angle_degrees = parameters.launch_angle_degrees;
        const h0 = parameters.initial_height;
        const g = parameters.gravity;
        const angle = launchAngle();
        const u0 = calc.velocityX(speed, angle);
        const v0 = calc.velocityY(speed, angle, g, 0);
        const cards = {
            u0: {
                substitution: `${formatNumber(speed)} × cos ${angle_degrees}°`,
                result: `${formatNumber(u0)} m/s`,
            },
            v0: {
                substitution: `${formatNumber(speed)} × sin ${angle_degrees}°`,
                result: `${formatNumber(v0)} m/s`,
            },
            x: {
                substitution: `${formatNumber(u0)} × ${formatNumber(time)} + 0`,
                result: `${formatNumber(calc.positionX(speed, angle, time))} m`,
            },
            y: {
                substitution: `−${formatNumber(g)} × ${formatNumber(time)}²/2 + ${formatOperand(v0)} × ${formatNumber(time)} + ${formatNumber(h0)}`,
                result: `${formatNumber(calc.positionY(h0, speed, angle, g, time))} m`,
            },
            u: {
                substitution: `u₀ = ${formatNumber(u0)}`,
                result: `${formatNumber(velocity_x)} m/s`,
            },
            v: {
                substitution: `−${formatNumber(g)} × ${formatNumber(time)} + ${formatOperand(v0)}`,
                result: `${formatNumber(velocity_y)} m/s`,
            },
            a: {
                substitution: strings.formula_a_note[current_language],
                result: `a_y = −${formatNumber(g)} m/s²`,
            },
            weight: {
                substitution: `${formatNumber(PROJECTILE_MASS)} × ${formatNumber(g)}`,
                result: `${formatNumber(weight)} N`,
            },
            flight_time: {
                substitution: `(${formatOperand(v0)} + √(${formatOperand(v0)}² + 2 × ${formatNumber(g)} × ${formatNumber(h0)})) / ${formatNumber(g)}`,
                result: `${formatNumber(totalFlightTime())} s`,
            },
            max_height: {
                substitution: v0 > 0
                    ? `${formatNumber(h0)} + ${formatNumber(v0)}² / (2 × ${formatNumber(g)})`
                    : `${formatNumber(h0)} (v₀ ≤ 0)`,
                result: `${formatNumber(calc.maxHeight(h0, speed, angle, g))} m`,
            },
            range: {
                substitution: `${formatNumber(u0)} × ${formatNumber(totalFlightTime())}`,
                result: `${formatNumber(calc.horizontalRange(h0, speed, angle, g))} m`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: positions, velocities and accelerations versus time with live cursor */
    function drawGraphs(time) {
        const angle = launchAngle();
        const g = parameters.gravity;
        const h0 = parameters.initial_height;
        const speed = parameters.initial_speed;
        const total_time = Math.max(totalFlightTime(), 1e-9);
        const x_points = [];
        const y_points = [];
        const u_points = [];
        const v_points = [];
        const ax_points = [];
        const ay_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            x_points.push([sample_time, calc.positionX(speed, angle, sample_time)]);
            y_points.push([sample_time, calc.positionY(h0, speed, angle, g, sample_time)]);
            u_points.push([sample_time, calc.velocityX(speed, angle)]);
            v_points.push([sample_time, calc.velocityY(speed, angle, g, sample_time)]);
            ax_points.push([sample_time, 0]);
            ay_points.push([sample_time, -g]);
        }
        graph.drawTimeGraph(document.getElementById("graph_positions"), [
            { label: "x", color: "#1976d2", points: x_points },
            { label: "y", color: "#d32f2f", points: y_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocities"), [
            { label: "u", color: "#1976d2", points: u_points },
            { label: "v", color: "#d32f2f", points: v_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_accelerations"), [
            { label: "aₓ", color: "#1976d2", points: ax_points },
            { label: "a_y", color: "#d32f2f", points: ay_points },
        ], { cursor_time: time, unit: "m/s²" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const total_time = totalFlightTime();
        const time = Math.min(simulation_time, total_time);
        const state = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        const timeline = document.getElementById("timeline");
        timeline.max = Math.max(total_time, 0.01);
        timeline.value = time;
        updateFormulas(time, state.velocity_x, state.velocity_y, state.weight);
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
                if (simulation_time >= totalFlightTime()) {
                    simulation_time = totalFlightTime();
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

    /* stepTime: shift simulation time by a signed amount, clamped to [0, flight time] */
    function stepTime(delta_seconds) {
        simulation_time = Math.min(Math.max(simulation_time + delta_seconds, 0), totalFlightTime());
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

    /* applyParameter: update a parameter from either input, mirror it to the other one */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        if (!Number.isFinite(value)) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        simulation_time = Math.min(simulation_time, totalFlightTime());
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
            if (!is_playing && simulation_time >= totalFlightTime()) {
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
