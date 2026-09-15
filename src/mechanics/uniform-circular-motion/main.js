/*
 * main.js — Uniform circular motion page logic: animated scene (circle path,
 * radius line, angle marker, velocity / centripetal acceleration / net force
 * vectors, free-body diagram inset with the resultant), shared pan/zoom camera,
 * transport controls with timeline scrubbing (closed-form motion), parameters
 * (radius R, constant speed v, mass m), live formulas in the course circular-
 * motion notation (omega = v/R, v = R·omega, a_r = −R·omega², F = m·v²/R,
 * period) and time graphs of the sinusoidal components. Classic script (works
 * via file://); reads the globals of calcul.js, canvas_draw.js, scene_camera.js,
 * graph_plot.js.
 */
(() => {
    const calc = globalThis.circular_motion_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Mouvement circulaire uniforme", en: "Uniform circular motion" },
        assumption: {
            fr: "Hypothèses : mouvement circulaire uniforme imposé — la norme de la vitesse est constante (ω = v/R, α = 0), départ en θ₀ = 0. L'accélération est purement radiale, a_r = v²/R dirigée vers le centre, et la force résultante vaut ΣF = m·v²/R. La nature de la force centripète (corde, frottement, gravitation…) dépend du contexte.",
            en: "Assumptions: uniform circular motion imposed — the speed norm is constant (ω = v/R, α = 0), starting at θ₀ = 0. The acceleration is purely radial, a_r = v²/R toward the center, and the net force is ΣF = m·v²/R. The nature of the centripetal force (rope, friction, gravitation…) depends on the context.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Positions x, y (m)", en: "Positions x, y (m)" },
        graph_velocities: { fr: "Vitesses vₓ, v_y (m/s)", en: "Velocities vₓ, v_y (m/s)" },
        graph_accelerations: { fr: "Accélérations aₓ, a_y (m/s²)", en: "Accelerations aₓ, a_y (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au cercle", en: "Fit view to the circle" },
        radius: { fr: "Rayon R", en: "Radius R" },
        speed: { fr: "Vitesse v (constante)", en: "Speed v (constant)" },
        mass: { fr: "Masse m", en: "Mass m" },
        legend_force: { fr: "Force résultante ΣF", en: "Net force ΣF" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a_r", en: "Acceleration a_r" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        formula_theta: { fr: "Position angulaire", en: "Angular position" },
        formula_omega: { fr: "Vitesse angulaire", en: "Angular velocity" },
        formula_period: { fr: "Période", en: "Period" },
        formula_x: { fr: "Position horizontale", en: "Horizontal position" },
        formula_y: { fr: "Position verticale", en: "Vertical position" },
        formula_v: { fr: "Vitesse tangentielle", en: "Tangential speed" },
        formula_a: { fr: "Accélération radiale", en: "Radial acceleration" },
        formula_force: { fr: "Force centripète (résultante)", en: "Centripetal (net) force" },
    };

    const parameter_config = [
        { key: "radius", min: 0.2, max: 5, step: 0.1, unit: "m" },
        { key: "speed", min: 0.5, max: 15, step: 0.1, unit: "m/s" },
        { key: "mass", min: 0.1, max: 5, step: 0.1, unit: "kg" },
    ];
    const parameters = {
        radius: 1,
        speed: 3,
        mass: 1,
    };

    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const SIMULATION_DURATION = 20;
    const GRAPH_SAMPLES = 200;
    const PIXELS_PER_METER_PER_SECOND = 10;
    const PIXELS_PER_METER_PER_SECOND_SQUARED = 6;
    const PIXELS_PER_NEWTON = 8;

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

    /* currentOmega: angular velocity for the current parameters */
    function currentOmega() {
        return calc.angularVelocity(parameters.speed, parameters.radius);
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the circle (and the game's ground/teacher extent, if any) */
    function fitView() {
        const radius = parameters.radius;
        let bottom = -1.3 * radius;
        /* Game mode hook — remove together with game.js */
        const game_extent = typeof globalThis.circular_motion_game_view_extent === "function" ? globalThis.circular_motion_game_view_extent() : null;
        if (game_extent !== null) {
            bottom = Math.min(bottom, game_extent.bottom);
        }
        camera.fitTo({ left: -1.3 * radius, right: 1.3 * radius, bottom, top: 1.3 * radius });
    }

    /* drawScene: circle path, radius line, angle marker, object and its vectors */
    function drawScene(transform, time) {
        const ink = inkColor();
        const radius = parameters.radius;
        const omega = currentOmega();
        const angle = calc.angleAt(0, omega, time);

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(0);
        const ball_x = transform.toScreenX(calc.positionX(radius, angle));
        const ball_y = transform.toScreenY(calc.positionY(radius, angle));
        const radius_pixels = Math.abs(transform.toScreenX(radius) - center_x);

        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.setLineDash([6, 7]);
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(center_x, center_y, radius_pixels, 0, 2 * Math.PI);
        context.stroke();
        context.restore();

        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(center_x, center_y);
        context.lineTo(ball_x, ball_y);
        context.stroke();
        context.fillStyle = ink;
        context.beginPath();
        context.arc(center_x, center_y, 4, 0, 2 * Math.PI);
        context.fill();

        context.strokeStyle = "#1976d2";
        context.lineWidth = 1.5;
        const marker_angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        context.beginPath();
        context.arc(center_x, center_y, 30, -marker_angle, 0);
        context.stroke();
        context.fillStyle = "#1976d2";
        context.font = "italic bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("θ", center_x + 44 * Math.cos(marker_angle / 2), center_y + 44 * Math.sin(-marker_angle / 2));
        context.restore();

        const force = calc.centripetalForce(parameters.mass, parameters.speed, radius);
        const acceleration = calc.centripetalAcceleration(parameters.speed, radius);
        const inward_screen = { x: -Math.cos(angle), y: Math.sin(angle) };

        draw.drawVector(
            context,
            ball_x,
            ball_y,
            inward_screen.x * force * PIXELS_PER_NEWTON,
            inward_screen.y * force * PIXELS_PER_NEWTON,
            { color: ink, line_width: 4, label: "ΣF" },
        );
        draw.drawVector(
            context,
            ball_x,
            ball_y,
            inward_screen.x * acceleration * PIXELS_PER_METER_PER_SECOND_SQUARED,
            inward_screen.y * acceleration * PIXELS_PER_METER_PER_SECOND_SQUARED,
            { color: ink, dash: [2, 4], line_width: 2, label: "a_r" },
        );
        draw.drawVector(
            context,
            ball_x,
            ball_y,
            calc.velocityX(parameters.speed, angle) * PIXELS_PER_METER_PER_SECOND,
            -calc.velocityY(parameters.speed, angle) * PIXELS_PER_METER_PER_SECOND,
            { color: ink, dash: [7, 5], line_width: 2, label: "v" },
        );

        context.save();
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(ball_x, ball_y, 9, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        drawFreeBodyInset(ink, angle, force);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.circular_motion_game_overlay === "function") {
            globalThis.circular_motion_game_overlay(context, transform, {
                time,
                angle,
                omega,
                speed: parameters.speed,
                radius,
                mass: parameters.mass,
            });
        }
        return { angle, force, acceleration };
    }

    /* drawFreeBodyInset: object alone with the net (centripetal) force */
    function drawFreeBodyInset(ink, angle, force) {
        const box_width = 168;
        const box_height = 170;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 84;

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

        draw.drawVector(context, center_x, center_y, -Math.cos(angle) * 55, Math.sin(angle) * 55, {
            color: ink,
            line_width: 4,
            label: "ΣF",
        });

        context.save();
        context.fillStyle = ink;
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`ΣF = ${formatNumber(force)} N`, center_x, center_y + 66);
        context.restore();
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, scene_values) {
        const radius = parameters.radius;
        const speed = parameters.speed;
        const omega = currentOmega();
        const theta_degrees = (scene_values.angle * 180) / Math.PI;
        const cards = {
            theta: {
                substitution: `0 + ${formatNumber(omega)} × ${formatNumber(time)}`,
                result: `${formatNumber(scene_values.angle)} rad = ${formatNumber(theta_degrees)}°`,
            },
            omega: {
                substitution: `${formatNumber(speed)} / ${formatNumber(radius)}`,
                result: `${formatNumber(omega)} rad/s`,
            },
            period: {
                substitution: `2π × ${formatNumber(radius)} / ${formatNumber(speed)}`,
                result: `${formatNumber(calc.period(radius, speed))} s`,
            },
            x: {
                substitution: `${formatNumber(radius)} × cos ${formatNumber(theta_degrees)}°`,
                result: `${formatNumber(calc.positionX(radius, scene_values.angle))} m`,
            },
            y: {
                substitution: `${formatNumber(radius)} × sin ${formatNumber(theta_degrees)}°`,
                result: `${formatNumber(calc.positionY(radius, scene_values.angle))} m`,
            },
            v: {
                substitution: `${formatNumber(radius)} × ${formatNumber(omega)}`,
                result: `${formatNumber(speed)} m/s`,
            },
            a: {
                substitution: `${formatNumber(speed)}² / ${formatNumber(radius)}`,
                result: `${formatNumber(scene_values.acceleration)} m/s²`,
            },
            force: {
                substitution: `${formatNumber(parameters.mass)} × ${formatNumber(speed)}² / ${formatNumber(radius)}`,
                result: `${formatNumber(scene_values.force)} N`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: sinusoidal components versus time with live cursor */
    function drawGraphs(time) {
        const radius = parameters.radius;
        const speed = parameters.speed;
        const omega = currentOmega();
        const x_points = [];
        const y_points = [];
        const vx_points = [];
        const vy_points = [];
        const ax_points = [];
        const ay_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (SIMULATION_DURATION * i) / GRAPH_SAMPLES;
            const angle = calc.angleAt(0, omega, sample_time);
            x_points.push([sample_time, calc.positionX(radius, angle)]);
            y_points.push([sample_time, calc.positionY(radius, angle)]);
            vx_points.push([sample_time, calc.velocityX(speed, angle)]);
            vy_points.push([sample_time, calc.velocityY(speed, angle)]);
            ax_points.push([sample_time, calc.accelerationX(speed, radius, angle)]);
            ay_points.push([sample_time, calc.accelerationY(speed, radius, angle)]);
        }
        graph.drawTimeGraph(document.getElementById("graph_positions"), [
            { label: "x", color: "#1976d2", points: x_points },
            { label: "y", color: "#d32f2f", points: y_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocities"), [
            { label: "vₓ", color: "#1976d2", points: vx_points },
            { label: "v_y", color: "#d32f2f", points: vy_points },
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
        const time = Math.min(simulation_time, SIMULATION_DURATION);
        const scene_values = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        document.getElementById("timeline").value = time;
        updateFormulas(time, scene_values);
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

    /* applyParameter: update a parameter from either input, mirror it to the other one */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        if (!Number.isFinite(value)) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
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

        applyLanguage(current_language);
        fitView();
        requestAnimationFrame(animationFrame);
    }

    init();
})();
