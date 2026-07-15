/*
 * main.js — Charged-particle page logic: animated scene with the plates, a
 * field-arrow grid, electric force / velocity / acceleration vectors and a
 * free-body diagram inset; shared pan/zoom camera with auto-follow; transport
 * controls; parameters (plate fields E1 and optional E2, charge q in µC,
 * initial height y0, horizontal speed u0); time graphs and formulas following
 * the course formulary notation (E = sigma/(2*eps0) per infinite plate, F = qE,
 * MRU horizontal / MRUA vertical as separate scalar equations).
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js. Fixed m = 1 g, plate gap 4 m,
 * weight neglected.
 */
(() => {
    const calc = globalThis.charged_particle_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Particule chargée", en: "Charged particle" },
        assumption: {
            fr: "Hypothèses : particule de masse m = 1 g, poids négligé devant la force électrique. Plaques infinies horizontales : plaque inférieure en y = 0, plaque supérieure optionnelle en y = 4 m. Chaque plaque crée un champ uniforme E = σ/(2ε₀) ; E₁ et E₂ sont les valeurs algébriques selon +y et le champ total vaut E = E₁ + E₂. Départ en x₀ = 0, hauteur y₀, vitesse horizontale u₀ (v₀y = 0). Mouvement horizontal = MRU, vertical = MRUA.",
            en: "Assumptions: particle of mass m = 1 g, weight neglected against the electric force. Horizontal infinite plates: bottom plate at y = 0, optional top plate at y = 4 m. Each plate creates a uniform field E = σ/(2ε₀); E₁ and E₂ are the algebraic values along +y and the total field is E = E₁ + E₂. Start at x₀ = 0, height y₀, horizontal speed u₀ (v₀y = 0). Horizontal motion = MRU, vertical = MRUA.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Positions (m)", en: "Positions (m)" },
        graph_velocities: { fr: "Vitesses (m/s)", en: "Velocities (m/s)" },
        graph_accelerations: { fr: "Accélération (m/s²)", en: "Acceleration (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue à la trajectoire", en: "Fit view to trajectory" },
        field_1: { fr: "Champ de la plaque inférieure E₁", en: "Bottom plate field E₁" },
        plate2_enabled: { fr: "Plaque supérieure", en: "Top plate" },
        field_2: { fr: "Champ de la plaque supérieure E₂", en: "Top plate field E₂" },
        charge_microcoulombs: { fr: "Charge q", en: "Charge q" },
        initial_height: { fr: "Position verticale initiale y₀", en: "Initial vertical position y₀" },
        initial_speed: { fr: "Vitesse horizontale initiale u₀", en: "Initial horizontal speed u₀" },
        legend_force: { fr: "Force électrique F = q·E", en: "Electric force F = q·E" },
        legend_field: { fr: "Champ E", en: "Field E" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        formula_field: { fr: "Champ total", en: "Total field" },
        formula_force: { fr: "Force électrique", en: "Electric force" },
        formula_acceleration: { fr: "Accélération", en: "Acceleration" },
        formula_x: { fr: "Position horizontale (MRU)", en: "Horizontal position (MRU)" },
        formula_y: { fr: "Position verticale (MRUA)", en: "Vertical position (MRUA)" },
        formula_u: { fr: "Vitesse horizontale", en: "Horizontal velocity" },
        formula_v: { fr: "Vitesse verticale", en: "Vertical velocity" },
        formula_impact: { fr: "Temps avant impact", en: "Time to impact" },
        impact_never: { fr: "aucun impact (vol libre)", en: "no impact (free flight)" },
    };

    const parameter_config = [
        { key: "field_1", min: -2000, max: 2000, step: 10, unit: "V/m" },
        { key: "plate2_enabled", type: "toggle" },
        { key: "field_2", min: -2000, max: 2000, step: 10, unit: "V/m" },
        { key: "charge_microcoulombs", min: -50, max: 50, step: 0.5, unit: "µC" },
        { key: "initial_height", min: 0.2, max: 3.8, step: 0.1, unit: "m" },
        { key: "initial_speed", min: 0.5, max: 20, step: 0.5, unit: "m/s" },
    ];
    const parameters = {
        field_1: 500,
        plate2_enabled: false,
        field_2: 0,
        charge_microcoulombs: 10,
        initial_height: 2,
        initial_speed: 6,
    };

    const PARTICLE_MASS = 0.001;
    const PLATE_GAP = 4;
    const MAX_RANGE = 15;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 80;
    const PIXELS_PER_METER_PER_SECOND = 4;
    const PIXELS_PER_MILLINEWTON = 3;
    const PIXELS_PER_METER_PER_SECOND_SQUARED = 0.8;

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

    /* formatOperand: like formatNumber, but negative values are parenthesized */
    function formatOperand(value) {
        return value < 0 ? `(${formatNumber(value)})` : formatNumber(value);
    }

    /* currentField: total algebraic field along +y for the current parameters */
    function currentField() {
        return calc.totalField(parameters.field_1, parameters.plate2_enabled ? parameters.field_2 : 0);
    }

    /* currentAcceleration: a_y = q·E/m with q converted from µC */
    function currentAcceleration() {
        return calc.acceleration(parameters.charge_microcoulombs * 1e-6, currentField(), PARTICLE_MASS);
    }

    /* currentImpactTime: time until a plate is hit — the top plate only exists
       when enabled, so an upward flight without it never impacts */
    function currentImpactTime() {
        const acceleration_y = currentAcceleration();
        if (acceleration_y > 0 && !parameters.plate2_enabled) {
            return Infinity;
        }
        return calc.impactTime(parameters.initial_height, acceleration_y, PLATE_GAP);
    }

    /* totalTime: flight window — until a plate is hit or the max range is crossed */
    function totalTime() {
        const range_time = MAX_RANGE / parameters.initial_speed;
        return Math.min(currentImpactTime(), range_time);
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the flight region between the plates (and the game ring, if any) */
    function fitView() {
        const end_time = totalTime();
        let right = Math.max(calc.positionX(parameters.initial_speed, end_time), 3);
        let top = Math.max(
            PLATE_GAP + 0.3,
            calc.positionY(parameters.initial_height, currentAcceleration(), end_time) + 0.5,
        );
        /* Game mode hook — remove together with game.js */
        const game_extent = typeof globalThis.charged_particle_game_view_extent === "function" ? globalThis.charged_particle_game_view_extent() : null;
        if (game_extent !== null) {
            right = Math.max(right, game_extent.right);
        }
        camera.fitTo({ left: 0, right, bottom: -0.3, top });
    }

    /* drawPlate: hatched plate slab with charge signs (sign inferred from its field) */
    function drawPlate(transform, plate_y, field_along_y, is_top) {
        const surface_charge_positive = is_top ? field_along_y < 0 : field_along_y > 0;
        const slab_top = transform.toScreenY(is_top ? plate_y + 0.18 : plate_y);
        const slab_bottom = transform.toScreenY(is_top ? plate_y : plate_y - 0.18);
        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.35)";
        context.fillRect(0, slab_top, canvas.width, slab_bottom - slab_top);
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, transform.toScreenY(plate_y));
        context.lineTo(canvas.width, transform.toScreenY(plate_y));
        context.stroke();
        if (field_along_y !== 0) {
            context.fillStyle = surface_charge_positive ? "#d32f2f" : "#1976d2";
            context.font = "bold 13px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            const sign = surface_charge_positive ? "+" : "−";
            const sign_y = (slab_top + slab_bottom) / 2;
            for (let x = 20; x < canvas.width; x += 46) {
                context.fillText(sign, x, sign_y);
            }
        }
        context.restore();
    }

    /* drawFieldArrows: grid of arrows showing the total field between the plates */
    function drawFieldArrows(transform) {
        const field = currentField();
        if (field === 0) {
            return;
        }
        const arrow_pixels = Math.min(6 + Math.abs(field) * 0.02, 46) * Math.sign(field);
        for (let x = 1; x <= MAX_RANGE; x += 2) {
            for (const y of [0.9, 2, 3.1]) {
                draw.drawVector(
                    context,
                    transform.toScreenX(x),
                    transform.toScreenY(y) + arrow_pixels / 2,
                    0,
                    -arrow_pixels,
                    { color: "rgba(38, 166, 154, 0.55)", line_width: 1.6 },
                );
            }
        }
        context.save();
        context.fillStyle = "rgba(38, 166, 154, 0.9)";
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText("E", transform.toScreenX(1) + 8, transform.toScreenY(2));
        context.restore();
    }

    /* drawScene: grid, plates, field, trajectory, particle and its vectors */
    function drawScene(transform, time) {
        const ink = inkColor();
        const acceleration_y = currentAcceleration();
        const total_time = Math.max(totalTime(), 1e-9);

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawPlate(transform, 0, parameters.field_1, false);
        if (parameters.plate2_enabled) {
            drawPlate(transform, PLATE_GAP, parameters.field_2, true);
        }
        drawFieldArrows(transform);

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
                const screen_x = transform.toScreenX(calc.positionX(parameters.initial_speed, sample_time));
                const screen_y = transform.toScreenY(calc.positionY(parameters.initial_height, acceleration_y, sample_time));
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
            const screen_x = transform.toScreenX(calc.positionX(parameters.initial_speed, sample_time));
            const screen_y = transform.toScreenY(calc.positionY(parameters.initial_height, acceleration_y, sample_time));
            if (i === 0) {
                context.moveTo(screen_x, screen_y);
            } else {
                context.lineTo(screen_x, screen_y);
            }
        }
        context.stroke();
        context.restore();

        const particle_world_x = calc.positionX(parameters.initial_speed, time);
        const particle_world_y = calc.positionY(parameters.initial_height, acceleration_y, time);
        const particle_x = transform.toScreenX(particle_world_x);
        const particle_y = transform.toScreenY(particle_world_y);
        const velocity_y = calc.velocityY(acceleration_y, time);
        const force_y = calc.electricForce(parameters.charge_microcoulombs * 1e-6, currentField());

        draw.drawVector(context, particle_x, particle_y, 0, -force_y * 1000 * PIXELS_PER_MILLINEWTON, {
            color: "#1976d2",
            label: "F",
        });
        draw.drawVector(context, particle_x, particle_y, 0, -acceleration_y * PIXELS_PER_METER_PER_SECOND_SQUARED, {
            color: ink,
            dash: [2, 4],
            line_width: 2,
            label: "a",
        });
        draw.drawVector(
            context,
            particle_x,
            particle_y,
            parameters.initial_speed * PIXELS_PER_METER_PER_SECOND,
            -velocity_y * PIXELS_PER_METER_PER_SECOND,
            { color: ink, dash: [7, 5], line_width: 2, label: "v" },
        );

        context.save();
        context.fillStyle = parameters.charge_microcoulombs >= 0 ? "#d32f2f" : "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(particle_x, particle_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = "bold 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(parameters.charge_microcoulombs >= 0 ? "+" : "−", particle_x, particle_y);
        context.restore();

        drawFreeBodyInset(ink, force_y);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.charged_particle_game_overlay === "function") {
            globalThis.charged_particle_game_overlay(context, transform, {
                time,
                total_time,
                x: particle_world_x,
                y: particle_world_y,
            });
        }
        return { velocity_y, force_y, acceleration_y };
    }

    /* drawFreeBodyInset: particle alone with the electric force (weight neglected) */
    function drawFreeBodyInset(ink, force_y) {
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

        context.fillStyle = "#d32f2f";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, 9, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        const force_pixels = Math.min(Math.abs(force_y) * 1000 * PIXELS_PER_MILLINEWTON, 60);
        if (force_pixels > 1) {
            draw.drawVector(context, center_x, center_y, 0, -Math.sign(force_y) * Math.max(force_pixels, 18), {
                color: "#1976d2",
                label: "F",
            });
        }

        context.save();
        context.fillStyle = "#1976d2";
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`F = q·E = ${formatNumber(force_y * 1000)} mN`, center_x, center_y + 66);
        context.restore();
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, scene_values) {
        const field = currentField();
        const charge = parameters.charge_microcoulombs;
        const acceleration_y = scene_values.acceleration_y;
        const impact = currentImpactTime();
        const impact_never = !Number.isFinite(impact);
        const cards = {
            field: {
                substitution: `${formatOperand(parameters.field_1)} + ${formatOperand(parameters.plate2_enabled ? parameters.field_2 : 0)}`,
                result: `${formatNumber(field)} V/m`,
            },
            force: {
                substitution: `(${formatOperand(charge)} × 10⁻⁶) × ${formatOperand(field)}`,
                result: `${formatNumber(scene_values.force_y * 1000)} mN`,
            },
            acceleration: {
                substitution: `${formatOperand(scene_values.force_y * 1000)} × 10⁻³ / 0,001`,
                result: `${formatNumber(acceleration_y)} m/s²`,
            },
            x: {
                substitution: `${formatNumber(parameters.initial_speed)} × ${formatNumber(time)} + 0`,
                result: `${formatNumber(calc.positionX(parameters.initial_speed, time))} m`,
            },
            y: {
                substitution: `${formatOperand(acceleration_y)} × ${formatNumber(time)}²/2 + ${formatNumber(parameters.initial_height)}`,
                result: `${formatNumber(calc.positionY(parameters.initial_height, acceleration_y, time))} m`,
            },
            u: {
                substitution: `u₀ = ${formatNumber(parameters.initial_speed)}`,
                result: `${formatNumber(parameters.initial_speed)} m/s`,
            },
            v: {
                substitution: `${formatOperand(acceleration_y)} × ${formatNumber(time)}`,
                result: `${formatNumber(scene_values.velocity_y)} m/s`,
            },
            impact: {
                substitution: impact_never
                    ? strings.impact_never[current_language]
                    : `√(2 × ${formatNumber(acceleration_y > 0 ? PLATE_GAP - parameters.initial_height : parameters.initial_height)} / ${formatNumber(Math.abs(acceleration_y))})`,
                result: impact_never ? "∞" : `${formatNumber(impact)} s`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: positions, velocities and acceleration versus time with live cursor */
    function drawGraphs(time) {
        const acceleration_y = currentAcceleration();
        const total_time = Math.max(totalTime(), 1e-9);
        const x_points = [];
        const y_points = [];
        const u_points = [];
        const v_points = [];
        const a_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            x_points.push([sample_time, calc.positionX(parameters.initial_speed, sample_time)]);
            y_points.push([sample_time, calc.positionY(parameters.initial_height, acceleration_y, sample_time)]);
            u_points.push([sample_time, parameters.initial_speed]);
            v_points.push([sample_time, calc.velocityY(acceleration_y, sample_time)]);
            a_points.push([sample_time, acceleration_y]);
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
            { label: "a_y", color: "#d32f2f", points: a_points },
        ], { cursor_time: time, unit: "m/s²" });
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
                    setFieldTwoEnabled(checkbox.checked);
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
        setFieldTwoEnabled(parameters.plate2_enabled);
    }

    /* setFieldTwoEnabled: gray out the E2 inputs while the top plate is absent */
    function setFieldTwoEnabled(enabled) {
        for (const id of ["slider_field_2", "number_field_2"]) {
            document.getElementById(id).disabled = !enabled;
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
