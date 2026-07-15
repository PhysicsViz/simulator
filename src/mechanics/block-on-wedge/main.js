/*
 * main.js — Block-on-wedge page logic: animated scene with the pushed wedge
 * sliding on a frictionless floor and the block on its incline, applied-force
 * / weight / normal / friction vectors, an angle arc and a free-body diagram
 * inset of the block; shared pan/zoom camera with auto-follow; transport
 * controls; parameters F, m, M, α, µs, g; formulas walking through the
 * no-slip test (a = F/(m+M), N, required friction, |f| ≤ µs·N) and the course
 * answer F_min = (m+M)·g·tan(α−φ), F_max = (m+M)·g·tan(α+φ) with φ = atan µs;
 * when F leaves the window the block visibly slides on the incline (exact
 * constant-acceleration two-body solution, kinetic µ = µs); time graphs of
 * the wedge and block positions, velocities and accelerations.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js. The run ends after 12 m of
 * track or when the block leaves the incline.
 */
(() => {
    const calc = globalThis.block_wedge_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Bloc sur un coin poussé", en: "Block on a pushed wedge" },
        assumption: {
            fr: "Hypothèses : le coin (masse M, angle α) glisse SANS frottement sur le sol horizontal ; entre le bloc (masse m) et le plan incliné, frottement statique µs (et frottement cinétique pris égal à µs en cas de glissement). Force F horizontale constante appliquée au coin, départ au repos, bloc au milieu du plan. Tant que |f nécessaire| ≤ µs·N, l'ensemble se déplace d'un bloc avec a = F/(m+M) ; sinon le bloc glisse sur le plan (solution exacte à accélérations constantes). La simulation s'arrête après 12 m de piste ou quand le bloc quitte le plan. Cordes du problème : m = 0,5 kg, M = 2 kg, α = 40°, µs = 0,6.",
            en: "Assumptions: the wedge (mass M, angle α) slides WITHOUT friction on the horizontal floor; between the block (mass m) and the incline, static friction µs (kinetic friction taken equal to µs when sliding). Constant horizontal force F applied to the wedge, start at rest, block at mid-incline. While |required f| ≤ µs·N the pair moves together with a = F/(m+M); otherwise the block slides on the incline (exact constant-acceleration solution). The run ends after 12 m of track or when the block leaves the incline. Course data: m = 0.5 kg, M = 2 kg, α = 40°, µs = 0.6.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Positions x (m)", en: "Positions x (m)" },
        graph_velocities: { fr: "Vitesses (m/s)", en: "Velocities (m/s)" },
        graph_accelerations: { fr: "Accélérations (m/s²)", en: "Accelerations (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue à la piste", en: "Fit view to the track" },
        force: { fr: "Force appliquée F", en: "Applied force F" },
        block_mass: { fr: "Masse du bloc m", en: "Block mass m" },
        wedge_mass: { fr: "Masse du coin M", en: "Wedge mass M" },
        incline_degrees: { fr: "Angle du plan α", en: "Incline angle α" },
        friction_coefficient: { fr: "Frottement statique µs", en: "Static friction µs" },
        gravity: { fr: "Pesanteur g", en: "Gravity g" },
        legend_applied: { fr: "Force appliquée F", en: "Applied force F" },
        legend_weight: { fr: "Poids P = m·g", en: "Weight P = m·g" },
        legend_normal: { fr: "Réaction normale N", en: "Normal force N" },
        legend_friction: { fr: "Frottement f", en: "Friction f" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces (bloc)", en: "Free-body diagram (block)" },
        formula_system: { fr: "Hypothèse « pas de glissement »", en: "No-slip hypothesis" },
        formula_normal: { fr: "Réaction normale sur le bloc", en: "Normal force on the block" },
        formula_friction: { fr: "Frottement nécessaire", en: "Required friction" },
        formula_condition: { fr: "Test du cône de frottement", en: "Friction-cone test" },
        formula_fmin: { fr: "Question du cours : F minimale", en: "Course question: minimum F" },
        formula_fmax: { fr: "Question du cours : F maximale", en: "Course question: maximum F" },
        formula_reference: { fr: "Référence sans frottement", en: "Frictionless reference" },
        formula_slide: { fr: "Glissement relatif (si F hors fenêtre)", en: "Relative sliding (if F outside the window)" },
        verdict_stuck: { fr: "✓ ne glisse pas", en: "✓ no sliding" },
        verdict_down: { fr: "✗ glisse vers le bas du plan", en: "✗ slides down the incline" },
        verdict_up: { fr: "✗ glisse vers le haut du plan", en: "✗ slides up the incline" },
        slide_none: { fr: "aucun (le bloc suit le coin)", en: "none (the block follows the wedge)" },
        fmax_infinite: { fr: "∞ (α + φ ≥ 90°)", en: "∞ (α + φ ≥ 90°)" },
    };

    const parameter_config = [
        { key: "force", min: 0, max: 120, step: 0.1, unit: "N" },
        { key: "block_mass", min: 0.1, max: 3, step: 0.05, unit: "kg" },
        { key: "wedge_mass", min: 0.5, max: 10, step: 0.1, unit: "kg" },
        { key: "incline_degrees", min: 5, max: 65, step: 0.5, unit: "°" },
        { key: "friction_coefficient", min: 0, max: 1.5, step: 0.01, unit: "" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        force: 20,
        block_mass: 0.5,
        wedge_mass: 2,
        incline_degrees: 40,
        friction_coefficient: 0.6,
        gravity: 9.81,
    };

    const TRACK_LENGTH = 12;
    const WEDGE_WIDTH = 2.2;
    const BLOCK_SIDE = 0.42;
    const STATIC_WINDOW = 5;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 80;
    const FORCE_ARROW_PIXELS = 60;
    const MOTION_ARROW_PIXELS = 45;
    const APPLIED_COLOR = "#1976d2";
    const WEIGHT_COLOR = "#d32f2f";
    const NORMAL_COLOR = "#43a047";
    const FRICTION_COLOR = "#e8722c";

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

    /* inclineRadians / wedge geometry helpers */
    function inclineRadians() {
        return parameters.incline_degrees * Math.PI / 180;
    }
    function wedgeHeight() {
        return WEDGE_WIDTH * Math.tan(inclineRadians());
    }
    function slopeLength() {
        return WEDGE_WIDTH / Math.cos(inclineRadians());
    }
    function slideStart() {
        return slopeLength() / 2;
    }

    /* stateAt: exact motion state at a time, from calcul */
    function stateAt(time) {
        return calc.motionState(
            parameters.force, parameters.block_mass, parameters.wedge_mass,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity, time,
        );
    }

    /* totalTime: until 12 m of track, the block leaving the incline, or a static window */
    function totalTime() {
        const state = stateAt(0);
        let end_time = Infinity;
        if (Math.abs(state.wedge_acceleration) > 1e-9) {
            end_time = Math.sqrt(2 * TRACK_LENGTH / Math.abs(state.wedge_acceleration));
        }
        if (state.sliding && Math.abs(state.slide_acceleration) > 1e-9) {
            const room = state.slide_acceleration > 0
                ? slopeLength() - 0.4 - slideStart()
                : slideStart() - 0.4;
            end_time = Math.min(end_time, Math.sqrt(2 * Math.max(room, 0.01) / Math.abs(state.slide_acceleration)));
        }
        return Number.isFinite(end_time) ? end_time : STATIC_WINDOW;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the whole track and the wedge height */
    function fitView() {
        camera.fitTo({
            left: -2.2,
            right: TRACK_LENGTH + WEDGE_WIDTH + 1.2,
            bottom: -1.1,
            top: wedgeHeight() + 2.2,
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

    /* drawWedge: the triangle at its current position, with the angle arc */
    function drawWedge(transform, wedge_x, ink) {
        const alpha = inclineRadians();
        const height = wedgeHeight();
        const left = transform.toScreenX(wedge_x);
        const right = transform.toScreenX(wedge_x + WEDGE_WIDTH);
        const floor_y = transform.toScreenY(0);
        const top_y = transform.toScreenY(height);
        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.22)";
        context.strokeStyle = "rgba(120, 130, 145, 0.9)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(left, floor_y);
        context.lineTo(left, top_y);
        context.lineTo(right, floor_y);
        context.closePath();
        context.fill();
        context.stroke();

        const arc_radius = Math.abs(transform.toScreenX(0.6) - transform.toScreenX(0));
        context.strokeStyle = "#b8860b";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(right, floor_y, arc_radius, Math.PI, Math.PI + alpha);
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "right";
        context.textBaseline = "bottom";
        context.fillText(`α = ${formatNumber(parameters.incline_degrees)}°`, right - arc_radius - 6, floor_y - 4);

        context.fillStyle = ink;
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(`M = ${formatNumber(parameters.wedge_mass)} kg`, left + 8, floor_y - 8);
        context.restore();
    }

    /* blockCenter: world position of the block center for a slide coordinate s */
    function blockCenter(wedge_x, slide) {
        const alpha = inclineRadians();
        const corner_x = wedge_x + WEDGE_WIDTH;
        const half = BLOCK_SIDE / 2;
        return {
            x: corner_x - slide * Math.cos(alpha) + half * Math.sin(alpha),
            y: slide * Math.sin(alpha) + half * Math.cos(alpha),
        };
    }

    /* drawBlock: square block aligned with the incline */
    function drawBlock(transform, center, ink) {
        const alpha = inclineRadians();
        const half = BLOCK_SIDE / 2;
        const along = { x: -Math.cos(alpha), y: Math.sin(alpha) };
        const outward = { x: Math.sin(alpha), y: Math.cos(alpha) };
        const corners = [
            [center.x + half * along.x + half * outward.x, center.y + half * along.y + half * outward.y],
            [center.x - half * along.x + half * outward.x, center.y - half * along.y + half * outward.y],
            [center.x - half * along.x - half * outward.x, center.y - half * along.y - half * outward.y],
            [center.x + half * along.x - half * outward.x, center.y + half * along.y - half * outward.y],
        ];
        context.save();
        context.fillStyle = "rgba(25, 118, 210, 0.25)";
        context.strokeStyle = "#1976d2";
        context.lineWidth = 2;
        context.beginPath();
        corners.forEach(([x, y], index) => {
            if (index === 0) {
                context.moveTo(transform.toScreenX(x), transform.toScreenY(y));
            } else {
                context.lineTo(transform.toScreenX(x), transform.toScreenY(y));
            }
        });
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`m = ${formatNumber(parameters.block_mass)} kg`, transform.toScreenX(center.x), transform.toScreenY(center.y + BLOCK_SIDE));
        context.restore();
    }

    /* drawVectors: F on the wedge, then P, N, f, v and a on the block */
    function drawVectors(transform, wedge_x, center, state, references, ink) {
        const alpha = inclineRadians();
        const center_x = transform.toScreenX(center.x);
        const center_y = transform.toScreenY(center.y);
        const force_scale = FORCE_ARROW_PIXELS / references.force;

        if (parameters.force > 0) {
            const grip_y = transform.toScreenY(wedgeHeight() * 0.3);
            const tail_x = transform.toScreenX(wedge_x) - parameters.force * force_scale;
            draw.drawVector(context, tail_x, grip_y, parameters.force * force_scale, 0, {
                color: APPLIED_COLOR,
                label: `F = ${formatNumber(parameters.force)} N`,
            });
        }

        draw.drawVector(context, center_x, center_y, 0, parameters.block_mass * parameters.gravity * force_scale, {
            color: WEIGHT_COLOR,
            label: "P",
        });
        draw.drawVector(
            context, center_x, center_y,
            Math.sin(alpha) * state.normal * force_scale,
            -Math.cos(alpha) * state.normal * force_scale,
            { color: NORMAL_COLOR, label: "N" },
        );
        if (Math.abs(state.friction) > 1e-9) {
            draw.drawVector(
                context, center_x, center_y,
                -Math.cos(alpha) * state.friction * force_scale,
                -Math.sin(alpha) * state.friction * force_scale,
                { color: FRICTION_COLOR, label: "f" },
            );
        }

        const block_velocity = state.wedge_velocity - state.slide_velocity * Math.cos(alpha);
        const block_acceleration = state.wedge_acceleration - state.slide_acceleration * Math.cos(alpha);
        if (references.speed > 0 && Math.abs(block_velocity) > 1e-9) {
            draw.drawVector(context, center_x, center_y - 34, block_velocity * MOTION_ARROW_PIXELS / references.speed, 0, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (references.acceleration > 0 && Math.abs(block_acceleration) > 1e-9) {
            draw.drawVector(context, center_x, center_y - 56, block_acceleration * MOTION_ARROW_PIXELS / references.acceleration, 0, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
    }

    /* drawFreeBodyInset: the block alone with P, N and f, values included */
    function drawFreeBodyInset(state, ink) {
        const alpha = inclineRadians();
        const box_width = 200;
        const box_height = 206;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 90;
        const reference = Math.max(state.normal, parameters.block_mass * parameters.gravity, 1e-9);
        const inset_scale = 50 / reference;

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
        context.roundRect(center_x - 12, center_y - 12, 24, 24, 3);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, center_x, center_y, 0, Math.max(parameters.block_mass * parameters.gravity * inset_scale, 12), {
            color: WEIGHT_COLOR,
            label: "P",
        });
        draw.drawVector(
            context, center_x, center_y,
            Math.sin(alpha) * state.normal * inset_scale,
            -Math.cos(alpha) * state.normal * inset_scale,
            { color: NORMAL_COLOR, label: "N" },
        );
        if (Math.abs(state.friction) > 1e-9) {
            draw.drawVector(
                context, center_x, center_y,
                -Math.cos(alpha) * state.friction * inset_scale,
                -Math.sin(alpha) * state.friction * inset_scale,
                { color: FRICTION_COLOR, label: "f" },
            );
        }
        context.save();
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = NORMAL_COLOR;
        context.fillText(`N = ${formatNumber(state.normal)} N`, center_x, box_y + box_height - 44);
        context.fillStyle = FRICTION_COLOR;
        context.fillText(`f = ${formatNumber(state.friction)} N`, center_x, box_y + box_height - 28);
        context.restore();
    }

    /* drawScene: full scene for a given time; returns the live quantities */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = stateAt(time);
        const slide = slideStart() + state.slide_displacement;
        const center = blockCenter(state.wedge_position, slide);
        const total_time = totalTime();
        const references = {
            force: Math.max(parameters.force, state.normal, parameters.block_mass * parameters.gravity, 1e-9),
            speed: Math.max(Math.abs(state.wedge_acceleration), Math.abs(state.slide_acceleration), 1e-9) * total_time,
            acceleration: Math.max(Math.abs(state.wedge_acceleration), parameters.gravity, 1e-9),
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawFloor(transform);
        drawWedge(transform, state.wedge_position, ink);
        drawBlock(transform, center, ink);
        drawVectors(transform, state.wedge_position, center, state, references, ink);
        drawFreeBodyInset(state, ink);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.block_wedge_game_overlay === "function") {
            globalThis.block_wedge_game_overlay(context, transform, {
                time,
                total_time,
                displacement: state.wedge_position,
                sliding: state.sliding,
                slide_acceleration: state.slide_acceleration,
                wedge_width: WEDGE_WIDTH,
            });
        }
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const alpha = inclineRadians();
        const hypothesis_acceleration = calc.systemAcceleration(parameters.force, parameters.block_mass, parameters.wedge_mass);
        const hypothesis_normal = calc.stuckNormal(parameters.block_mass, alpha, hypothesis_acceleration, parameters.gravity);
        const hypothesis_friction = calc.requiredFriction(parameters.block_mass, alpha, hypothesis_acceleration, parameters.gravity);
        const friction_angle = calc.frictionAngle(parameters.friction_coefficient);
        const force_min = calc.minForce(parameters.block_mass, parameters.wedge_mass, alpha, parameters.friction_coefficient, parameters.gravity);
        const force_max = calc.maxForce(parameters.block_mass, parameters.wedge_mass, alpha, parameters.friction_coefficient, parameters.gravity);
        const total_mass = parameters.block_mass + parameters.wedge_mass;
        let verdict_key = "verdict_stuck";
        if (!calc.isStuck(parameters.force, parameters.block_mass, parameters.wedge_mass, alpha, parameters.friction_coefficient, parameters.gravity)) {
            verdict_key = parameters.force > force_max ? "verdict_up" : "verdict_down";
        }

        const cards = {
            system: {
                substitution: `${formatNumber(parameters.force)} / (${formatNumber(parameters.block_mass)} + ${formatNumber(parameters.wedge_mass)})`,
                result: `${formatNumber(hypothesis_acceleration)} m/s²`,
            },
            normal: {
                substitution: `${formatNumber(parameters.block_mass)} × (${formatNumber(parameters.gravity)} × cos ${formatNumber(parameters.incline_degrees)}° + ${formatNumber(hypothesis_acceleration)} × sin ${formatNumber(parameters.incline_degrees)}°)`,
                result: `${formatNumber(hypothesis_normal)} N`,
            },
            friction: {
                substitution: `${formatNumber(parameters.block_mass)} × (${formatNumber(parameters.gravity)} × sin ${formatNumber(parameters.incline_degrees)}° − ${formatNumber(hypothesis_acceleration)} × cos ${formatNumber(parameters.incline_degrees)}°)`,
                result: `${formatNumber(hypothesis_friction)} N`,
            },
            condition: {
                substitution: `|${formatOperand(hypothesis_friction)}| ≤ ${formatNumber(parameters.friction_coefficient)} × ${formatNumber(hypothesis_normal)} = ${formatNumber(parameters.friction_coefficient * hypothesis_normal)}`,
                result: strings[verdict_key][current_language],
            },
            fmin: {
                substitution: `${formatNumber(total_mass)} × ${formatNumber(parameters.gravity)} × tan(${formatNumber(parameters.incline_degrees)}° − ${formatNumber(friction_angle * 180 / Math.PI)}°)`,
                result: `${formatNumber(force_min)} N`,
            },
            fmax: {
                substitution: Number.isFinite(force_max)
                    ? `${formatNumber(total_mass)} × ${formatNumber(parameters.gravity)} × tan(${formatNumber(parameters.incline_degrees)}° + ${formatNumber(friction_angle * 180 / Math.PI)}°)`
                    : strings.fmax_infinite[current_language],
                result: Number.isFinite(force_max) ? `${formatNumber(force_max)} N` : "∞",
            },
            reference: {
                substitution: `${formatNumber(total_mass)} × ${formatNumber(parameters.gravity)} × tan ${formatNumber(parameters.incline_degrees)}°`,
                result: `${formatNumber(total_mass * parameters.gravity * Math.tan(alpha))} N`,
            },
            slide: {
                substitution: state.sliding
                    ? `s̈ = ${formatOperand(state.slide_acceleration)} m/s² ; N = ${formatNumber(state.normal)} N`
                    : strings.slide_none[current_language],
                result: state.sliding ? `s = ${formatNumber(state.slide_displacement)} m` : "s̈ = 0",
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: wedge and block x positions, velocities and accelerations */
    function drawGraphs(time) {
        const alpha = inclineRadians();
        const total_time = Math.max(totalTime(), 1e-9);
        const wedge_position_points = [];
        const block_position_points = [];
        const wedge_velocity_points = [];
        const block_velocity_points = [];
        const wedge_acceleration_points = [];
        const block_acceleration_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            const state = stateAt(sample_time);
            const center = blockCenter(state.wedge_position, slideStart() + state.slide_displacement);
            wedge_position_points.push([sample_time, state.wedge_position]);
            block_position_points.push([sample_time, center.x]);
            wedge_velocity_points.push([sample_time, state.wedge_velocity]);
            block_velocity_points.push([sample_time, state.wedge_velocity - state.slide_velocity * Math.cos(alpha)]);
            wedge_acceleration_points.push([sample_time, state.wedge_acceleration]);
            block_acceleration_points.push([sample_time, state.wedge_acceleration - state.slide_acceleration * Math.cos(alpha)]);
        }
        const wedge_label = current_language === "fr" ? "coin" : "wedge";
        const block_label = current_language === "fr" ? "bloc" : "block";
        graph.drawTimeGraph(document.getElementById("graph_positions"), [
            { label: wedge_label, color: "#1976d2", points: wedge_position_points },
            { label: block_label, color: "#d32f2f", points: block_position_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocities"), [
            { label: wedge_label, color: "#1976d2", points: wedge_velocity_points },
            { label: block_label, color: "#d32f2f", points: block_velocity_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_accelerations"), [
            { label: wedge_label, color: "#1976d2", points: wedge_acceleration_points },
            { label: block_label, color: "#d32f2f", points: block_acceleration_points },
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
