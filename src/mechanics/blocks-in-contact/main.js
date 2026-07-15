/*
 * main.js — Blocks-in-contact page logic: animated scene with the two labeled
 * blocks sliding on a frictionless floor, the applied force, the
 * action–reaction contact pair at the interface, weight / normal / velocity /
 * acceleration vectors and a free-body diagram inset isolating each block;
 * shared pan/zoom camera with auto-follow; transport controls; parameters
 * (mA, mB, F, swap toggle); formulas answering the course's four questions
 * (a = F/(mA+mB), contact force m_front·a, net force on the pushed block,
 * contact force with the blocks swapped) and time graphs of x, v, a.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js. g fixed at 9.81 m/s² (only
 * used for the vertical equilibrium N = m·g); blocks start at rest; the run
 * ends after 15 m of track.
 */
(() => {
    const calc = globalThis.blocks_contact_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Blocs en contact", en: "Blocks in contact" },
        assumption: {
            fr: "Hypothèses : deux blocs A et B en contact glissent sans frottement sur une surface horizontale ; une force horizontale de module F pousse le bloc arrière et les deux blocs restent en contact (même accélération). Les seules forces horizontales sont F et la paire action–réaction au contact (3e loi de Newton) ; verticalement N = m·g (ΣF_y = 0, g = 9,81 m/s²). Départ au repos en x = 0 : MRUA, x(t) = a·t²/2, v(t) = a·t. La simulation s'arrête après 15 m de piste.",
            en: "Assumptions: two blocks A and B in contact slide without friction on a horizontal surface; a horizontal force of module F pushes the rear block and the blocks stay in contact (same acceleration). The only horizontal forces are F and the action–reaction contact pair (Newton's third law); vertically N = m·g (ΣF_y = 0, g = 9.81 m/s²). Starting at rest at x = 0: MRUA, x(t) = a·t²/2, v(t) = a·t. The run ends after 15 m of track.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_position: { fr: "Position x (m)", en: "Position x (m)" },
        graph_velocity: { fr: "Vitesse v (m/s)", en: "Velocity v (m/s)" },
        graph_acceleration: { fr: "Accélération a (m/s²)", en: "Acceleration a (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue à la piste", en: "Fit view to the track" },
        mass_a: { fr: "Masse du bloc A (m_A)", en: "Mass of block A (m_A)" },
        mass_b: { fr: "Masse du bloc B (m_B)", en: "Mass of block B (m_B)" },
        force: { fr: "Force appliquée F", en: "Applied force F" },
        swapped: { fr: "Intervertir les blocs (pousser A, B devant)", en: "Swap the blocks (push A, B in front)" },
        legend_applied: { fr: "Force appliquée F", en: "Applied force F" },
        legend_contact: { fr: "Contact et normales N (paire action–réaction)", en: "Contact and normals N (action–reaction pair)" },
        legend_weight: { fr: "Poids P = m·g", en: "Weight P = m·g" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Chaque bloc isolé", en: "Each block isolated" },
        formula_accel: { fr: "1. Accélération du système", en: "1. Acceleration of the system" },
        formula_contact: { fr: "2. Force de contact (3e loi)", en: "2. Contact force (3rd law)" },
        formula_net: { fr: "3. Résultante sur le bloc poussé", en: "3. Net force on the pushed block" },
        formula_swapped: { fr: "4. Blocs intervertis", en: "4. Blocks swapped" },
        formula_vertical: { fr: "Équilibre vertical", en: "Vertical equilibrium" },
        formula_x: { fr: "Position (MRUA)", en: "Position (MRUA)" },
        formula_v: { fr: "Vitesse", en: "Velocity" },
    };

    const parameter_config = [
        { key: "mass_a", min: 0.1, max: 10, step: 0.05, unit: "kg" },
        { key: "mass_b", min: 0.1, max: 10, step: 0.05, unit: "kg" },
        { key: "force", min: 0, max: 100, step: 0.5, unit: "N" },
        { key: "swapped", type: "toggle" },
    ];
    const parameters = {
        mass_a: 2,
        mass_b: 3,
        force: 20,
        swapped: false,
    };

    const GRAVITY = 9.81;
    const TRACK_LENGTH = 15;
    const BLOCK_WIDTH = 0.9;
    const BLOCK_HEIGHT = 0.9;
    const STATIC_WINDOW = 5;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 80;
    const FORCE_ARROW_PIXELS = 65;
    const MOTION_ARROW_PIXELS = 45;
    const APPLIED_COLOR = "#1976d2";
    const NORMAL_COLOR = "#43a047";
    const WEIGHT_COLOR = "#d32f2f";

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

    /* frontMass / rearMass: the pushed block is at the rear (B by default) */
    function frontMass() {
        return parameters.swapped ? parameters.mass_b : parameters.mass_a;
    }
    function rearMass() {
        return parameters.swapped ? parameters.mass_a : parameters.mass_b;
    }
    function frontLabel() {
        return parameters.swapped ? "B" : "A";
    }
    function rearLabel() {
        return parameters.swapped ? "A" : "B";
    }

    /* currentState: every derived quantity for the current parameters */
    function currentState() {
        const acceleration = calc.accelerationModule(parameters.force, parameters.mass_a, parameters.mass_b);
        return {
            acceleration,
            contact_force: calc.contactForceModule(parameters.force, frontMass(), parameters.mass_a, parameters.mass_b),
            swapped_contact_force: calc.contactForceModule(parameters.force, rearMass(), parameters.mass_a, parameters.mass_b),
            net_on_pushed: calc.netForceModule(rearMass(), acceleration),
        };
    }

    /* totalTime: until 15 m of track are covered; short static window when F = 0 */
    function totalTime() {
        const travel = calc.travelTime(TRACK_LENGTH, currentState().acceleration);
        return Number.isFinite(travel) ? travel : STATIC_WINDOW;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the whole track */
    function fitView() {
        camera.fitTo({
            left: -1.2,
            right: TRACK_LENGTH + 2 * BLOCK_WIDTH + 1.2,
            bottom: -1.2,
            top: 4.2,
        });
    }

    /* drawFloor: hatched frictionless ground at y = 0 */
    function drawFloor(transform) {
        const floor_y = transform.toScreenY(0);
        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, floor_y);
        context.lineTo(canvas.width, floor_y);
        context.stroke();
        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.lineWidth = 1;
        context.beginPath();
        for (let x = 0; x < canvas.width; x += 14) {
            context.moveTo(x, floor_y);
            context.lineTo(x - 8, floor_y + 8);
        }
        context.stroke();
        context.restore();
    }

    /* drawOneBlock: labeled block with its left edge at world_left */
    function drawOneBlock(transform, world_left, label, mass, ink) {
        const left = transform.toScreenX(world_left);
        const top = transform.toScreenY(BLOCK_HEIGHT);
        const width = transform.toScreenX(world_left + BLOCK_WIDTH) - left;
        const height = transform.toScreenY(0) - top;
        context.save();
        context.fillStyle = "rgba(25, 118, 210, 0.22)";
        context.strokeStyle = "#1976d2";
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(left, top, width, height, 4);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 15px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(label, left + width / 2, top + height / 2 - 9);
        context.font = "12px system-ui, sans-serif";
        context.fillText(`${formatNumber(mass)} kg`, left + width / 2, top + height / 2 + 11);
        context.restore();
    }

    /* drawBlockForces: applied force, contact pair, weight and normal vectors */
    function drawBlockForces(transform, rear_left, state, references, ink) {
        const force_scale = FORCE_ARROW_PIXELS / references.force;
        const mid_height = transform.toScreenY(BLOCK_HEIGHT / 2);
        const interface_x = transform.toScreenX(rear_left + BLOCK_WIDTH);

        if (parameters.force > 0) {
            const tail_x = transform.toScreenX(rear_left) - parameters.force * force_scale;
            draw.drawVector(context, tail_x, mid_height, parameters.force * force_scale, 0, {
                color: APPLIED_COLOR,
                label: "F",
            });
        }
        if (state.contact_force > 0) {
            draw.drawVector(context, interface_x, mid_height - 14, state.contact_force * force_scale, 0, {
                color: NORMAL_COLOR,
                label: `F ${rearLabel()}→${frontLabel()}`,
            });
            draw.drawVector(context, interface_x, mid_height + 14, -state.contact_force * force_scale, 0, {
                color: NORMAL_COLOR,
                label: `F ${frontLabel()}→${rearLabel()}`,
            });
        }
        for (const [center_world_x, mass] of [
            [rear_left + BLOCK_WIDTH / 2, rearMass()],
            [rear_left + 1.5 * BLOCK_WIDTH, frontMass()],
        ]) {
            const center_x = transform.toScreenX(center_world_x);
            const weight = calc.normalForce(mass, GRAVITY);
            draw.drawVector(context, center_x, mid_height, 0, weight * force_scale, { color: WEIGHT_COLOR, label: "P" });
            draw.drawVector(context, center_x, transform.toScreenY(0), 0, -weight * force_scale, { color: NORMAL_COLOR, label: "N" });
        }
    }

    /* drawMotionVectors: shared v (dashed) and a (dotted) above the pair */
    function drawMotionVectors(transform, rear_left, velocity, acceleration, references, ink) {
        const center_x = transform.toScreenX(rear_left + BLOCK_WIDTH);
        const above_y = transform.toScreenY(BLOCK_HEIGHT + 0.5);
        if (references.speed > 0 && velocity > 1e-12) {
            draw.drawVector(context, center_x, above_y, velocity * MOTION_ARROW_PIXELS / references.speed, 0, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (references.acceleration > 0 && acceleration > 1e-12) {
            draw.drawVector(context, center_x, above_y - 26, acceleration * MOTION_ARROW_PIXELS / references.acceleration, 0, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
    }

    /* drawFreeBodyInset: each block isolated with its horizontal and vertical forces */
    function drawFreeBodyInset(state, ink) {
        const box_width = 252;
        const box_height = 210;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const references = Math.max(parameters.force, calc.normalForce(Math.max(parameters.mass_a, parameters.mass_b), GRAVITY), 1e-9);
        const inset_scale = 46 / references;

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
        context.fillText(strings.fbd_title[current_language], box_x + box_width / 2, box_y + 10);
        context.restore();

        const diagrams = [
            {
                label: rearLabel(),
                center_x: box_x + box_width * 0.28,
                mass: rearMass(),
                right_force: parameters.force,
                right_label: "F",
                right_color: APPLIED_COLOR,
                left_force: state.contact_force,
                left_label: `F ${frontLabel()}→${rearLabel()}`,
            },
            {
                label: frontLabel(),
                center_x: box_x + box_width * 0.72,
                mass: frontMass(),
                right_force: state.contact_force,
                right_label: `F ${rearLabel()}→${frontLabel()}`,
                right_color: NORMAL_COLOR,
                left_force: 0,
                left_label: "",
            },
        ];
        for (const diagram of diagrams) {
            const center_y = box_y + 96;
            context.save();
            context.fillStyle = "rgba(25, 118, 210, 0.22)";
            context.strokeStyle = "#1976d2";
            context.lineWidth = 1.5;
            context.beginPath();
            context.roundRect(diagram.center_x - 14, center_y - 12, 28, 24, 3);
            context.fill();
            context.stroke();
            context.fillStyle = ink;
            context.font = "bold 11px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(diagram.label, diagram.center_x, center_y);
            context.restore();
            const weight = calc.normalForce(diagram.mass, GRAVITY);
            draw.drawVector(context, diagram.center_x, center_y + 12, 0, Math.max(weight * inset_scale, 12), { color: WEIGHT_COLOR, label: "P" });
            draw.drawVector(context, diagram.center_x, center_y - 12, 0, -Math.max(weight * inset_scale, 12), { color: NORMAL_COLOR, label: "N" });
            if (diagram.right_force > 0) {
                draw.drawVector(context, diagram.center_x + 14, center_y, Math.max(diagram.right_force * inset_scale, 12), 0, {
                    color: diagram.right_color,
                    label: diagram.right_label,
                    font: "bold 10px system-ui, sans-serif",
                });
            }
            if (diagram.left_force > 0) {
                draw.drawVector(context, diagram.center_x - 14, center_y, -Math.max(diagram.left_force * inset_scale, 12), 0, {
                    color: NORMAL_COLOR,
                    label: diagram.left_label,
                    font: "bold 10px system-ui, sans-serif",
                });
            }
            context.save();
            context.font = "11px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = NORMAL_COLOR;
            context.fillText(
                `contact = ${formatNumber(state.contact_force)} N`,
                box_x + box_width / 2,
                box_y + box_height - 30,
            );
            context.restore();
        }
    }

    /* drawScene: full scene for a given time; returns the live quantities */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = currentState();
        const displacement = calc.positionAt(state.acceleration, time);
        const velocity = calc.velocityAt(state.acceleration, time);
        const total_time = totalTime();
        const references = {
            force: Math.max(parameters.force, calc.normalForce(Math.max(parameters.mass_a, parameters.mass_b), GRAVITY), 1e-9),
            speed: state.acceleration * total_time,
            acceleration: Math.max(state.acceleration, 1e-9),
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawFloor(transform);

        drawOneBlock(transform, displacement, rearLabel(), rearMass(), ink);
        drawOneBlock(transform, displacement + BLOCK_WIDTH, frontLabel(), frontMass(), ink);
        drawMotionVectors(transform, displacement, velocity, state.acceleration, references, ink);

        /* Game mode hook — remove together with game.js (the contact pair and
           the free-body diagram reveal the force the game asks to bound) */
        if (!document.body.classList.contains("game-mode")) {
            drawBlockForces(transform, displacement, state, references, ink);
            drawFreeBodyInset(state, ink);
        } else if (parameters.force > 0) {
            const force_scale = FORCE_ARROW_PIXELS / references.force;
            const mid_height = transform.toScreenY(BLOCK_HEIGHT / 2);
            const tail_x = transform.toScreenX(displacement) - parameters.force * force_scale;
            draw.drawVector(context, tail_x, mid_height, parameters.force * force_scale, 0, {
                color: APPLIED_COLOR,
                label: "F",
            });
        }

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.blocks_contact_game_overlay === "function") {
            globalThis.blocks_contact_game_overlay(context, transform, {
                time,
                total_time,
                displacement,
                contact_force: state.contact_force,
                block_width: BLOCK_WIDTH,
                block_height: BLOCK_HEIGHT,
            });
        }
        return { ...state, displacement, velocity };
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        document.getElementById("math_contact").textContent =
            `F ${frontLabel()}→${rearLabel()} = F ${rearLabel()}→${frontLabel()} = m_${frontLabel()}·a`;
        document.getElementById("math_net").textContent =
            `ΣF_${rearLabel()} = F − F ${frontLabel()}→${rearLabel()} = m_${rearLabel()}·a`;
        document.getElementById("math_swapped").textContent =
            `F' contact = m_${rearLabel()}·a`;
        const cards = {
            accel: {
                substitution: `${formatNumber(parameters.force)} / (${formatNumber(parameters.mass_a)} + ${formatNumber(parameters.mass_b)})`,
                result: `${formatNumber(state.acceleration)} m/s²`,
            },
            contact: {
                substitution: `${formatNumber(frontMass())} × ${formatNumber(state.acceleration)}`,
                result: `${formatNumber(state.contact_force)} N`,
            },
            net: {
                substitution: `${formatNumber(parameters.force)} − ${formatNumber(state.contact_force)} = ${formatNumber(rearMass())} × ${formatNumber(state.acceleration)}`,
                result: `${formatNumber(state.net_on_pushed)} N`,
            },
            swapped: {
                substitution: `${formatNumber(rearMass())} × ${formatNumber(state.acceleration)}`,
                result: `${formatNumber(state.swapped_contact_force)} N`,
            },
            vertical: {
                substitution: `N_A = ${formatNumber(parameters.mass_a)} × ${formatNumber(GRAVITY)} ; N_B = ${formatNumber(parameters.mass_b)} × ${formatNumber(GRAVITY)}`,
                result: `${formatNumber(calc.normalForce(parameters.mass_a, GRAVITY))} N · ${formatNumber(calc.normalForce(parameters.mass_b, GRAVITY))} N`,
            },
            x: {
                substitution: `${formatNumber(state.acceleration)} × ${formatNumber(time)}²/2`,
                result: `${formatNumber(state.displacement)} m`,
            },
            v: {
                substitution: `${formatNumber(state.acceleration)} × ${formatNumber(time)}`,
                result: `${formatNumber(state.velocity)} m/s`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: x, v, a versus time with live cursor */
    function drawGraphs(time, state) {
        const total_time = Math.max(totalTime(), 1e-9);
        const x_points = [];
        const v_points = [];
        const a_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            x_points.push([sample_time, calc.positionAt(state.acceleration, sample_time)]);
            v_points.push([sample_time, calc.velocityAt(state.acceleration, sample_time)]);
            a_points.push([sample_time, state.acceleration]);
        }
        graph.drawTimeGraph(document.getElementById("graph_position"), [
            { label: "x", color: "#1976d2", points: x_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocity"), [
            { label: "v", color: "#d32f2f", points: v_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_acceleration"), [
            { label: "a", color: "#43a047", points: a_points },
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
            drawGraphs(time, state);
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
