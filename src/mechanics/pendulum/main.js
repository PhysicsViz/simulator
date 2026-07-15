/*
 * main.js — Pendulum page logic: animated scene with rod, bob, force vectors
 * (weight, rod tension) and free-body diagram inset, shared pan/zoom camera,
 * transport controls with timeline scrubbing over a precomputed RK4 trajectory,
 * parameter inputs (theta0 = position, v0 = tangential speed, rope length L,
 * mass m, g), time graphs (angle, speed, accelerations) and formulas following
 * the course formulary circular-motion notation (v = L·omega, a_r = −L·omega²,
 * a_theta = L·alpha). Classic script (works via file://); reads the globals of
 * calcul.js, canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.pendulum_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Pendule", en: "Pendulum" },
        assumption: {
            fr: "Hypothèses : tige rigide de masse négligeable (la corde reste tendue), frottements négligés, α = −(g/L)·sin θ sans approximation des petits angles (intégration numérique RK4). Forces appliquées : le poids P = m·g et la tension T de la tige.",
            en: "Assumptions: rigid massless rod (the string stays taut), no friction, α = −(g/L)·sin θ without the small-angle approximation (RK4 numerical integration). Applied forces: the weight P = m·g and the rod tension T.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_angle: { fr: "Position angulaire θ (°)", en: "Angular position θ (°)" },
        graph_speed: { fr: "Vitesse tangentielle v (m/s)", en: "Tangential speed v (m/s)" },
        graph_accelerations: { fr: "Accélérations (m/s²)", en: "Accelerations (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au pendule", en: "Fit view to the pendulum" },
        initial_angle_degrees: { fr: "Position initiale θ₀", en: "Initial position θ₀" },
        initial_speed: { fr: "Vitesse tangentielle initiale v₀", en: "Initial tangential speed v₀" },
        rod_length: { fr: "Longueur de la corde L", en: "Rope length L" },
        mass: { fr: "Masse m", en: "Mass m" },
        gravity: { fr: "Accélération de pesanteur g", en: "Gravitational acceleration g" },
        legend_weight: { fr: "Poids P", en: "Weight P" },
        legend_tension: { fr: "Tension T", en: "Tension T" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        formula_theta: { fr: "Position angulaire", en: "Angular position" },
        formula_theta_note: { fr: "intégration numérique (RK4)", en: "numerical integration (RK4)" },
        formula_x: { fr: "Position horizontale", en: "Horizontal position" },
        formula_y: { fr: "Position verticale", en: "Vertical position" },
        formula_v: { fr: "Vitesse tangentielle", en: "Tangential speed" },
        formula_a_theta: { fr: "Accélération tangentielle", en: "Tangential acceleration" },
        formula_a_r: { fr: "Accélération radiale", en: "Radial acceleration" },
        formula_tension: { fr: "Tension", en: "Tension" },
        formula_energy: { fr: "Conservation de l'énergie", en: "Energy conservation" },
        formula_period: { fr: "Période (petits angles)", en: "Period (small angles)" },
        formula_weight: { fr: "Poids", en: "Weight" },
    };

    const parameter_config = [
        { key: "initial_angle_degrees", min: -180, max: 180, step: 1, unit: "°" },
        { key: "initial_speed", min: -10, max: 10, step: 0.1, unit: "m/s" },
        { key: "rod_length", min: 0.5, max: 5, step: 0.1, unit: "m" },
        { key: "mass", min: 0.1, max: 5, step: 0.1, unit: "kg" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        initial_angle_degrees: 60,
        initial_speed: 0,
        rod_length: 2,
        mass: 1,
        gravity: 9.81,
    };

    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const SIMULATION_DURATION = 20;
    const SIMULATION_RATE = 240;
    const GRAPH_STRIDE = 24;
    const PIXELS_PER_METER_PER_SECOND = 10;
    const PIXELS_PER_NEWTON = 4;
    const PIXELS_PER_METER_PER_SECOND_SQUARED = 5;

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

    /* rebuildTrajectory: precompute the RK4 trajectory so the timeline can scrub freely */
    function rebuildTrajectory() {
        trajectory = calc.simulate(
            calc.degToRad(parameters.initial_angle_degrees),
            parameters.initial_speed / parameters.rod_length,
            parameters.gravity,
            parameters.rod_length,
            1 / SIMULATION_RATE,
            SIMULATION_DURATION * SIMULATION_RATE,
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

    /* fitView: frame the whole swing circle around the pivot */
    function fitView() {
        camera.fitTo({
            left: -1.25 * parameters.rod_length,
            right: 1.25 * parameters.rod_length,
            bottom: -1.3 * parameters.rod_length,
            top: 0.35 * parameters.rod_length,
        });
    }

    /* drawScene: grid, pivot mount, swing path, rod, bob and its force vectors */
    function drawScene(transform, state) {
        const ink = inkColor();
        const angle = state.angle;
        const omega = state.angular_velocity;

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const pivot_x = transform.toScreenX(0);
        const pivot_y = transform.toScreenY(0);
        const bob_screen_x = transform.toScreenX(calc.bobX(parameters.rod_length, angle));
        const bob_screen_y = transform.toScreenY(calc.bobY(parameters.rod_length, angle));
        const radius_pixels = Math.abs(transform.toScreenX(parameters.rod_length) - pivot_x);

        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.45)";
        context.setLineDash([5, 7]);
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(pivot_x, pivot_y, radius_pixels, 0, 2 * Math.PI);
        context.stroke();
        context.restore();

        context.save();
        context.strokeStyle = "#1976d2";
        context.lineWidth = 2.5;
        context.beginPath();
        const current_index = Math.min(Math.round(state.time * SIMULATION_RATE), trajectory.length - 1);
        for (let i = 0; i <= current_index; i += 4) {
            const sample_x = transform.toScreenX(calc.bobX(parameters.rod_length, trajectory[i].angle));
            const sample_y = transform.toScreenY(calc.bobY(parameters.rod_length, trajectory[i].angle));
            if (i === 0) {
                context.moveTo(sample_x, sample_y);
            } else {
                context.lineTo(sample_x, sample_y);
            }
        }
        context.lineTo(bob_screen_x, bob_screen_y);
        context.stroke();
        context.restore();

        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.5)";
        context.fillRect(pivot_x - 26, pivot_y - 8, 52, 6);
        context.strokeStyle = "#1976d2";
        context.lineWidth = 1.5;
        context.beginPath();
        const rod_screen_angle = Math.atan2(Math.cos(angle), Math.sin(angle));
        context.arc(pivot_x, pivot_y, 42, Math.min(Math.PI / 2, rod_screen_angle), Math.max(Math.PI / 2, rod_screen_angle));
        context.stroke();
        context.fillStyle = "#1976d2";
        context.font = "italic bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const marker_angle = (Math.PI / 2 + rod_screen_angle) / 2;
        context.fillText("θ", pivot_x + 54 * Math.cos(marker_angle), pivot_y + 54 * Math.sin(marker_angle));
        context.restore();

        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(pivot_x, pivot_y);
        context.lineTo(bob_screen_x, bob_screen_y);
        context.stroke();
        context.fillStyle = ink;
        context.beginPath();
        context.arc(pivot_x, pivot_y, 4, 0, 2 * Math.PI);
        context.fill();
        context.restore();

        const weight = parameters.mass * parameters.gravity;
        const tension = calc.tension(parameters.mass, parameters.gravity, parameters.rod_length, angle, omega);
        const speed = calc.tangentialSpeed(parameters.rod_length, omega);
        const tangent_screen = { x: Math.cos(angle), y: -Math.sin(angle) };
        const toward_pivot_screen = { x: -Math.sin(angle), y: -Math.cos(angle) };
        const tangential_acceleration = -parameters.gravity * Math.sin(angle);
        const radial_acceleration = parameters.rod_length * omega * omega;

        draw.drawVector(context, bob_screen_x, bob_screen_y, 0, weight * PIXELS_PER_NEWTON, {
            color: "#d32f2f",
            label: "P",
        });
        draw.drawVector(
            context,
            bob_screen_x,
            bob_screen_y,
            toward_pivot_screen.x * tension * PIXELS_PER_NEWTON,
            toward_pivot_screen.y * tension * PIXELS_PER_NEWTON,
            { color: "#8e24aa", label: "T" },
        );
        draw.drawVector(
            context,
            bob_screen_x,
            bob_screen_y,
            tangent_screen.x * speed * PIXELS_PER_METER_PER_SECOND,
            tangent_screen.y * speed * PIXELS_PER_METER_PER_SECOND,
            { color: ink, dash: [7, 5], line_width: 2, label: "v" },
        );
        draw.drawVector(
            context,
            bob_screen_x,
            bob_screen_y,
            (tangent_screen.x * tangential_acceleration + toward_pivot_screen.x * radial_acceleration) * PIXELS_PER_METER_PER_SECOND_SQUARED,
            (tangent_screen.y * tangential_acceleration + toward_pivot_screen.y * radial_acceleration) * PIXELS_PER_METER_PER_SECOND_SQUARED,
            { color: ink, dash: [2, 4], line_width: 2, label: "a" },
        );

        context.save();
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(bob_screen_x, bob_screen_y, 10, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        drawFreeBodyInset(ink, angle, weight, tension);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.pendulum_game_overlay === "function") {
            globalThis.pendulum_game_overlay(context, transform, {
                time: state.time,
                angle,
                angular_velocity: omega,
                speed,
                tension,
            });
        }
        return { speed, tension, tangential_acceleration, radial_acceleration, weight };
    }

    /* drawFreeBodyInset: bob alone with the weight and the rod tension */
    function drawFreeBodyInset(ink, angle, weight, tension) {
        const box_width = 168;
        const box_height = 190;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 92;

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

        draw.drawVector(context, center_x, center_y, 0, 55, { color: "#d32f2f", label: "P" });
        draw.drawVector(context, center_x, center_y, -Math.sin(angle) * 55, -Math.cos(angle) * 55, {
            color: "#8e24aa",
            label: "T",
        });

        context.save();
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = "#d32f2f";
        context.fillText(`P = ${formatNumber(weight)} N`, center_x, center_y + 66);
        context.fillStyle = "#8e24aa";
        context.fillText(`T = ${formatNumber(tension)} N`, center_x, center_y + 82);
        context.restore();
    }

    /* updateFormulas: refresh substitution text and result for every formula card,
       using the course circular-motion notation (v = L·ω, a_r = −L·ω², a_θ = L·α) */
    function updateFormulas(state, scene_values) {
        const g = parameters.gravity;
        const theta_degrees = calc.radToDeg(state.angle);
        const omega = state.angular_velocity;
        const initial_angle = calc.degToRad(parameters.initial_angle_degrees);
        const energy_speed = calc.speedFromEnergy(initial_angle, parameters.initial_speed, state.angle, g, parameters.rod_length);
        const theta_text = `${formatNumber(theta_degrees)}°`;
        const cards = {
            theta: {
                substitution: strings.formula_theta_note[current_language],
                result: `θ = ${theta_text}`,
            },
            x: {
                substitution: `${formatNumber(parameters.rod_length)} × sin ${formatOperand(theta_degrees)}°`,
                result: `${formatNumber(calc.bobX(parameters.rod_length, state.angle))} m`,
            },
            y: {
                substitution: `−${formatNumber(parameters.rod_length)} × cos ${formatOperand(theta_degrees)}°`,
                result: `${formatNumber(calc.bobY(parameters.rod_length, state.angle))} m`,
            },
            v: {
                substitution: `${formatNumber(parameters.rod_length)} × ${formatOperand(omega)}`,
                result: `${formatNumber(scene_values.speed)} m/s`,
            },
            a_theta: {
                substitution: `−${formatNumber(g)} × sin ${formatOperand(theta_degrees)}°`,
                result: `${formatNumber(scene_values.tangential_acceleration)} m/s²`,
            },
            a_r: {
                substitution: `−${formatNumber(parameters.rod_length)} × ${formatOperand(omega)}²`,
                result: `${formatNumber(-scene_values.radial_acceleration)} m/s²`,
            },
            tension: {
                substitution: `${formatNumber(parameters.mass)} × (${formatNumber(g)} × cos ${formatOperand(theta_degrees)}° + ${formatNumber(parameters.rod_length)} × ${formatOperand(omega)}²)`,
                result: `${formatNumber(scene_values.tension)} N`,
            },
            energy: {
                substitution: `√(${formatOperand(parameters.initial_speed)}² + 2 × ${formatNumber(g)} × ${formatNumber(parameters.rod_length)} × (cos ${formatOperand(theta_degrees)}° − cos ${formatOperand(parameters.initial_angle_degrees)}°))`,
                result: `‖v‖ = ${formatNumber(energy_speed)} m/s`,
            },
            period: {
                substitution: `2π × √(${formatNumber(parameters.rod_length)} / ${formatNumber(g)})`,
                result: `${formatNumber(calc.smallAnglePeriod(parameters.rod_length, g))} s`,
            },
            weight: {
                substitution: `${formatNumber(parameters.mass)} × ${formatNumber(g)}`,
                result: `${formatNumber(scene_values.weight)} N`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: angle, tangential speed and accelerations versus time with live cursor */
    function drawGraphs(time) {
        const theta_points = [];
        const speed_points = [];
        const a_theta_points = [];
        const a_r_points = [];
        for (let i = 0; i < trajectory.length; i += GRAPH_STRIDE) {
            const sample = trajectory[i];
            theta_points.push([sample.time, calc.radToDeg(sample.angle)]);
            speed_points.push([sample.time, calc.tangentialSpeed(parameters.rod_length, sample.angular_velocity)]);
            a_theta_points.push([sample.time, -parameters.gravity * Math.sin(sample.angle)]);
            a_r_points.push([sample.time, -parameters.rod_length * sample.angular_velocity * sample.angular_velocity]);
        }
        graph.drawTimeGraph(document.getElementById("graph_angle"), [
            { label: "θ", color: "#1976d2", points: theta_points },
        ], { cursor_time: time, unit: "°" });
        graph.drawTimeGraph(document.getElementById("graph_speed"), [
            { label: "v", color: "#1976d2", points: speed_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_accelerations"), [
            { label: "a_θ", color: "#1976d2", points: a_theta_points },
            { label: "a_r", color: "#d32f2f", points: a_r_points },
        ], { cursor_time: time, unit: "m/s²" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const time = Math.min(simulation_time, SIMULATION_DURATION);
        const state = stateAt(time);
        const scene_values = drawScene(camera.transform(), state);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        document.getElementById("timeline").value = time;
        updateFormulas(state, scene_values);
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
