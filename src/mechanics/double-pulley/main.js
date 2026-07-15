/*
 * main.js — Two-radius pulley page logic: animated scene with the two-cylinder
 * pulley (rotating spokes), the smooth nail, both hanging blocks with weight /
 * tension / velocity / acceleration vectors, floor and ceiling, a meeting-height
 * marker answering "when are the blocks level?", and a free-body diagram inset
 * of both blocks; shared pan/zoom camera with auto-follow; transport controls;
 * parameters (m1, m2, R1, R2, I, h, g); formulas following the course notation
 * (Newton per block, I·α = T2·R2 − T1·R1, rope constraints a = α·R, MRUA) and
 * time graphs of positions, vertical velocities and accelerations.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js. Block 1 starts at
 * y10 = 0.5 m above the floor; the run ends when a block lands.
 */
(() => {
    const calc = globalThis.double_pulley_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Poulie à deux rayons", en: "Two-radius pulley" },
        assumption: {
            fr: "Hypothèses : la poulie est formée de deux cylindres solidaires du même arbre (moment d'inertie I, rayons R₁ et R₂), sur un axe fixe sans frottement. Cordes sans masse et inextensibles ; le clou est lisse (sans frottement), donc la tension T₁ est la même de part et d'autre. Le bloc 1 pend verticalement sous le clou (corde enroulée sur R₁), le bloc 2 pend du grand cylindre (rayon R₂). Départ au repos, le bloc 2 étant h au-dessus du bloc 1 ; le bloc 1 part de y₁₀ = 0,50 m au-dessus du sol. Liaisons : a₁ = α·R₁ (bloc 1 monte si α > 0) et a₂ = α·R₂ (bloc 2 descend si α > 0) ; mouvement MRUA. La simulation s'arrête quand un bloc touche le sol.",
            en: "Assumptions: the pulley is two cylinders fixed to the same shaft (moment of inertia I, radii R₁ and R₂), on a fixed frictionless axle. Massless, inextensible ropes; the nail is smooth (frictionless), so the tension T₁ is the same on both sides. Block 1 hangs vertically below the nail (rope wound on R₁), block 2 hangs from the large cylinder (radius R₂). Released at rest with block 2 a gap h above block 1; block 1 starts at y₁₀ = 0.50 m above the floor. Constraints: a₁ = α·R₁ (block 1 rises if α > 0) and a₂ = α·R₂ (block 2 descends if α > 0); uniformly accelerated motion (MRUA). The run stops when a block lands.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Hauteurs y₁, y₂ (m)", en: "Heights y₁, y₂ (m)" },
        graph_velocities: { fr: "Vitesses verticales (m/s, vers le haut > 0)", en: "Vertical velocities (m/s, upward > 0)" },
        graph_accelerations: { fr: "Accélérations verticales (m/s²)", en: "Vertical accelerations (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au montage", en: "Fit view to the setup" },
        mass_1: { fr: "Masse du bloc 1 (m₁)", en: "Mass of block 1 (m₁)" },
        mass_2: { fr: "Masse du bloc 2 (m₂)", en: "Mass of block 2 (m₂)" },
        radius_1_centimeters: { fr: "Rayon du petit cylindre R₁", en: "Small cylinder radius R₁" },
        radius_2_centimeters: { fr: "Rayon du grand cylindre R₂", en: "Large cylinder radius R₂" },
        inertia: { fr: "Moment d'inertie de la poulie I", en: "Pulley moment of inertia I" },
        height_gap: { fr: "Écart initial de hauteur h", en: "Initial height gap h" },
        gravity: { fr: "Pesanteur g", en: "Gravity g" },
        legend_weight: { fr: "Poids P = m·g", en: "Weight P = m·g" },
        legend_tension: { fr: "Tensions T₁, T₂", en: "Tensions T₁, T₂" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        formula_alpha: { fr: "Accélération angulaire", en: "Angular acceleration" },
        formula_a1: { fr: "Accélération du bloc 1", en: "Acceleration of block 1" },
        formula_a2: { fr: "Accélération du bloc 2", en: "Acceleration of block 2" },
        formula_t1: { fr: "Tension de la corde 1", en: "Tension in rope 1" },
        formula_t2: { fr: "Tension de la corde 2", en: "Tension in rope 2" },
        formula_check: { fr: "Vérification (rotation)", en: "Check (rotation)" },
        formula_y1: { fr: "Hauteur du bloc 1 (MRUA)", en: "Height of block 1 (MRUA)" },
        formula_y2: { fr: "Hauteur du bloc 2 (MRUA)", en: "Height of block 2 (MRUA)" },
        formula_meet: { fr: "Instant de croisement", en: "Meeting time" },
        meet_never: { fr: "jamais (les blocs ne se rapprochent pas)", en: "never (the blocks do not approach)" },
        meeting_label: { fr: "même hauteur à t = {t} s", en: "same height at t = {t} s" },
        landed_label: { fr: "un bloc touche le sol", en: "a block reaches the floor" },
    };

    const parameter_config = [
        { key: "mass_1", min: 0.1, max: 10, step: 0.05, unit: "kg" },
        { key: "mass_2", min: 0.1, max: 10, step: 0.05, unit: "kg" },
        { key: "radius_1_centimeters", min: 1, max: 20, step: 0.5, unit: "cm" },
        { key: "radius_2_centimeters", min: 1, max: 30, step: 0.5, unit: "cm" },
        { key: "inertia", min: 0.01, max: 2, step: 0.01, unit: "kg·m²" },
        { key: "height_gap", min: 0.5, max: 10, step: 0.1, unit: "m" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        mass_1: 1,
        mass_2: 3,
        radius_1_centimeters: 5,
        radius_2_centimeters: 10,
        inertia: 0.2,
        height_gap: 2,
        gravity: 9.81,
    };

    const BLOCK1_START = 0.5;
    const BLOCK_WIDTH = 0.36;
    const BLOCK_HEIGHT = 0.3;
    const STATIC_WINDOW = 5;
    const MAX_WINDOW = 60;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 80;
    const FORCE_ARROW_PIXELS = 60;
    const MOTION_ARROW_PIXELS = 45;
    const TENSION_COLOR = "#8e24aa";
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

    /* formatOperand: like formatNumber, but negative values are parenthesized */
    function formatOperand(value) {
        return value < 0 ? `(${formatNumber(value)})` : formatNumber(value);
    }

    /* radius1 / radius2: slider centimeters converted to meters */
    function radius1() {
        return parameters.radius_1_centimeters / 100;
    }
    function radius2() {
        return parameters.radius_2_centimeters / 100;
    }

    /* currentState: every derived quantity for the current parameters */
    function currentState() {
        const alpha = calc.angularAcceleration(
            parameters.mass_1, parameters.mass_2, radius1(), radius2(), parameters.inertia, parameters.gravity,
        );
        const acceleration_1 = calc.accelerationBlock1(alpha, radius1());
        const acceleration_2 = calc.accelerationBlock2(alpha, radius2());
        return {
            alpha,
            acceleration_1,
            acceleration_2,
            tension_1: calc.tensionRope1(parameters.mass_1, acceleration_1, parameters.gravity),
            tension_2: calc.tensionRope2(parameters.mass_2, acceleration_2, parameters.gravity),
            meeting_time: calc.meetingTime(parameters.height_gap, acceleration_1, acceleration_2),
        };
    }

    /* totalTime: until a block lands, capped; a static equilibrium shows a short window */
    function totalTime() {
        const state = currentState();
        const landing = Math.min(
            calc.floorTimeBlock1(BLOCK1_START, state.acceleration_1),
            calc.floorTimeBlock2(BLOCK1_START, parameters.height_gap, state.acceleration_2),
        );
        if (!Number.isFinite(landing)) {
            return STATIC_WINDOW;
        }
        return Math.min(landing, MAX_WINDOW);
    }

    /* pulleyCenterY / nailX: scene geometry derived from the parameters */
    function pulleyCenterY() {
        return BLOCK1_START + parameters.height_gap + 1.2 + radius2();
    }
    function nailX() {
        return -(radius2() + 0.8);
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame floor, blocks, nail and pulley with breathing room */
    function fitView() {
        camera.fitTo({
            left: nailX() - 0.9,
            right: radius2() + 1.3,
            bottom: -0.5,
            top: pulleyCenterY() + radius2() + 0.8,
        });
    }

    /* drawFloorAndCeiling: hatched ground at y = 0 and the pulley support */
    function drawFloorAndCeiling(transform) {
        const floor_y = transform.toScreenY(0);
        const ceiling_world = pulleyCenterY() + radius2() + 0.4;
        const ceiling_y = transform.toScreenY(ceiling_world);
        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, floor_y);
        context.lineTo(canvas.width, floor_y);
        context.stroke();
        context.lineWidth = 1;
        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.beginPath();
        for (let x = 0; x < canvas.width; x += 14) {
            context.moveTo(x, floor_y);
            context.lineTo(x - 8, floor_y + 8);
        }
        const left_ceiling = transform.toScreenX(-radius2() - 0.5);
        const right_ceiling = transform.toScreenX(radius2() + 0.5);
        context.moveTo(left_ceiling, ceiling_y);
        context.lineTo(right_ceiling, ceiling_y);
        for (let x = left_ceiling; x < right_ceiling; x += 14) {
            context.moveTo(x, ceiling_y);
            context.lineTo(x + 8, ceiling_y - 8);
        }
        context.stroke();
        context.strokeStyle = "rgba(120, 130, 145, 0.9)";
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(transform.toScreenX(0), ceiling_y);
        context.lineTo(transform.toScreenX(0), transform.toScreenY(pulleyCenterY()));
        context.stroke();
        context.restore();
    }

    /* drawPulley: both cylinders, rotating spokes, axle, nail and rotation label */
    function drawPulley(transform, theta, alpha, omega, ink) {
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(pulleyCenterY());
        const outer_pixels = Math.abs(transform.toScreenX(radius2()) - transform.toScreenX(0));
        const inner_pixels = Math.abs(transform.toScreenX(radius1()) - transform.toScreenX(0));

        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.25)";
        context.strokeStyle = "rgba(120, 130, 145, 0.9)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, outer_pixels, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "rgba(120, 130, 145, 0.45)";
        context.beginPath();
        context.arc(center_x, center_y, inner_pixels, 0, 2 * Math.PI);
        context.fill();
        context.stroke();

        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 1.5;
        context.beginPath();
        for (let k = 0; k < 4; k++) {
            const spoke_angle = -theta + k * Math.PI / 2;
            context.moveTo(center_x, center_y);
            context.lineTo(
                center_x + outer_pixels * 0.92 * Math.cos(spoke_angle),
                center_y + outer_pixels * 0.92 * Math.sin(spoke_angle),
            );
        }
        context.stroke();

        context.fillStyle = "rgba(120, 130, 145, 1)";
        context.beginPath();
        context.arc(center_x, center_y, 4, 0, 2 * Math.PI);
        context.fill();

        context.fillStyle = ink;
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(
            `α = ${formatNumber(alpha)} rad/s² · ω = ${formatNumber(omega)} rad/s`,
            center_x + outer_pixels + 12,
            center_y,
        );

        const nail_screen_x = transform.toScreenX(nailX());
        const nail_screen_y = transform.toScreenY(pulleyCenterY() + radius1());
        context.fillStyle = "rgba(120, 130, 145, 1)";
        context.beginPath();
        context.arc(nail_screen_x, nail_screen_y, 5, 0, 2 * Math.PI);
        context.fill();
        context.restore();
    }

    /* drawRopes: block 2's rope from R2, block 1's rope over the nail */
    function drawRopes(transform, height_1, height_2, ink) {
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(transform.toScreenX(radius2()), transform.toScreenY(pulleyCenterY()));
        context.lineTo(transform.toScreenX(radius2()), transform.toScreenY(height_2 + BLOCK_HEIGHT / 2));
        const rope_top = transform.toScreenY(pulleyCenterY() + radius1());
        context.moveTo(transform.toScreenX(0), rope_top);
        context.lineTo(transform.toScreenX(nailX()), rope_top);
        context.lineTo(transform.toScreenX(nailX()), transform.toScreenY(height_1 + BLOCK_HEIGHT / 2));
        context.stroke();
        context.restore();
    }

    /* drawBlock: labeled block centered at (world_x, world_y) */
    function drawBlock(transform, world_x, world_y, label, ink) {
        const left = transform.toScreenX(world_x - BLOCK_WIDTH / 2);
        const top = transform.toScreenY(world_y + BLOCK_HEIGHT / 2);
        const width = transform.toScreenX(world_x + BLOCK_WIDTH / 2) - left;
        const height = transform.toScreenY(world_y - BLOCK_HEIGHT / 2) - top;
        context.save();
        context.fillStyle = "rgba(25, 118, 210, 0.25)";
        context.strokeStyle = "#1976d2";
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(left, top, width, height, 4);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(label, left + width / 2, top + height / 2);
        context.restore();
    }

    /* drawBlockVectors: P, T, v and a on one block (vertical setup) */
    function drawBlockVectors(transform, world_x, world_y, weight, tension, velocity_up, acceleration_up, references, ink) {
        const screen_x = transform.toScreenX(world_x);
        const screen_y = transform.toScreenY(world_y);
        const force_scale = FORCE_ARROW_PIXELS / references.force;
        const block_top_y = transform.toScreenY(world_y + BLOCK_HEIGHT / 2);
        draw.drawVector(context, screen_x, screen_y, 0, weight * force_scale, { color: WEIGHT_COLOR, label: "P" });
        draw.drawVector(context, screen_x, block_top_y, 0, -tension * force_scale, { color: TENSION_COLOR, label: "T" });
        if (references.speed > 0 && Math.abs(velocity_up) > 1e-12) {
            const offset_x = screen_x - 26;
            draw.drawVector(context, offset_x, screen_y, 0, -velocity_up * MOTION_ARROW_PIXELS / references.speed, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (references.acceleration > 0 && Math.abs(acceleration_up) > 1e-12) {
            const offset_x = screen_x + 26;
            draw.drawVector(context, offset_x, screen_y, 0, -acceleration_up * MOTION_ARROW_PIXELS / references.acceleration, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
    }

    /* drawMeetingMarker: dashed line at the height where the blocks pass each other */
    function drawMeetingMarker(transform, state, time, ink) {
        if (!Number.isFinite(state.meeting_time) || state.meeting_time > totalTime()) {
            return;
        }
        const meeting_height = calc.positionBlock1(BLOCK1_START, state.acceleration_1, state.meeting_time);
        const marker_y = transform.toScreenY(meeting_height);
        const highlight = Math.abs(time - state.meeting_time) < 0.06;
        context.save();
        context.strokeStyle = highlight ? "#fbc02d" : "rgba(184, 134, 11, 0.7)";
        context.lineWidth = highlight ? 3 : 1.5;
        context.setLineDash([8, 6]);
        context.beginPath();
        context.moveTo(0, marker_y);
        context.lineTo(canvas.width, marker_y);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = highlight ? "#fbc02d" : "rgba(184, 134, 11, 0.9)";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(
            strings.meeting_label[current_language].replace("{t}", formatNumber(state.meeting_time)),
            10,
            marker_y - 5,
        );
        context.restore();
    }

    /* drawFreeBodyInset: both blocks alone with their weight and tension */
    function drawFreeBodyInset(state, ink) {
        const box_width = 224;
        const box_height = 208;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const force_reference = Math.max(state.tension_2, parameters.mass_2 * parameters.gravity, state.tension_1, parameters.mass_1 * parameters.gravity);
        const inset_scale = 52 / force_reference;

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

        const blocks = [
            { label: "1", center_x: box_x + box_width * 0.28, weight: parameters.mass_1 * parameters.gravity, tension: state.tension_1, tension_label: "T₁", weight_label: "P₁" },
            { label: "2", center_x: box_x + box_width * 0.72, weight: parameters.mass_2 * parameters.gravity, tension: state.tension_2, tension_label: "T₂", weight_label: "P₂" },
        ];
        for (const block of blocks) {
            const center_y = box_y + 96;
            context.save();
            context.fillStyle = "rgba(25, 118, 210, 0.25)";
            context.strokeStyle = "#1976d2";
            context.lineWidth = 1.5;
            context.beginPath();
            context.roundRect(block.center_x - 13, center_y - 11, 26, 22, 3);
            context.fill();
            context.stroke();
            context.fillStyle = ink;
            context.font = "bold 11px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(block.label, block.center_x, center_y);
            context.restore();
            draw.drawVector(context, block.center_x, center_y - 11, 0, -Math.max(block.tension * inset_scale, 12), {
                color: TENSION_COLOR,
                label: block.tension_label,
            });
            draw.drawVector(context, block.center_x, center_y + 11, 0, Math.max(block.weight * inset_scale, 12), {
                color: WEIGHT_COLOR,
                label: block.weight_label,
            });
            context.save();
            context.font = "11px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = TENSION_COLOR;
            context.fillText(`${block.tension_label} = ${formatNumber(block.tension)} N`, block.center_x, box_y + box_height - 42);
            context.fillStyle = WEIGHT_COLOR;
            context.fillText(`${block.weight_label} = ${formatNumber(block.weight)} N`, block.center_x, box_y + box_height - 26);
            context.restore();
        }
    }

    /* drawScene: full scene for a given time; returns the live quantities */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = currentState();
        const height_1 = calc.positionBlock1(BLOCK1_START, state.acceleration_1, time);
        const height_2 = calc.positionBlock2(BLOCK1_START, parameters.height_gap, state.acceleration_2, time);
        const velocity_1 = calc.verticalVelocityBlock1(state.acceleration_1, time);
        const velocity_2 = calc.verticalVelocityBlock2(state.acceleration_2, time);
        const theta = calc.rotationAngle(state.alpha, time);
        const omega = calc.angularVelocity(state.alpha, time);
        const total_time = totalTime();
        const references = {
            force: Math.max(state.tension_2, parameters.mass_2 * parameters.gravity, state.tension_1, parameters.mass_1 * parameters.gravity),
            speed: Math.max(Math.abs(state.acceleration_1), Math.abs(state.acceleration_2)) * total_time,
            acceleration: Math.max(Math.abs(state.acceleration_1), Math.abs(state.acceleration_2)),
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawFloorAndCeiling(transform);
        drawRopes(transform, height_1, height_2, ink);
        drawPulley(transform, theta, state.alpha, omega, ink);

        /* Game mode hook — remove together with game.js (the marker reveals the
           meeting time, i.e. the answer the game asks for) */
        if (!document.body.classList.contains("game-mode")) {
            drawMeetingMarker(transform, state, time, ink);
        }

        drawBlock(transform, nailX(), height_1, `m₁ = ${formatNumber(parameters.mass_1)} kg`, ink);
        drawBlock(transform, radius2(), height_2, `m₂ = ${formatNumber(parameters.mass_2)} kg`, ink);
        drawBlockVectors(transform, nailX(), height_1, parameters.mass_1 * parameters.gravity, state.tension_1, velocity_1, state.acceleration_1, references, ink);
        drawBlockVectors(transform, radius2(), height_2, parameters.mass_2 * parameters.gravity, state.tension_2, velocity_2, -state.acceleration_2, references, ink);
        drawFreeBodyInset(state, ink);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.double_pulley_game_overlay === "function") {
            globalThis.double_pulley_game_overlay(context, transform, {
                time,
                total_time,
                height_1,
                height_2,
            });
        }
        return { ...state, height_1, height_2, velocity_1, velocity_2, omega };
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const meet_never = !Number.isFinite(state.meeting_time);
        const cards = {
            alpha: {
                substitution: `${formatNumber(parameters.gravity)} × (${formatNumber(parameters.mass_2)} × ${formatNumber(radius2())} − ${formatNumber(parameters.mass_1)} × ${formatNumber(radius1())}) / (${formatNumber(parameters.inertia)} + ${formatNumber(parameters.mass_1)} × ${formatNumber(radius1())}² + ${formatNumber(parameters.mass_2)} × ${formatNumber(radius2())}²)`,
                result: `${formatNumber(state.alpha)} rad/s²`,
            },
            a1: {
                substitution: `${formatOperand(state.alpha)} × ${formatNumber(radius1())}`,
                result: `${formatNumber(state.acceleration_1)} m/s²`,
            },
            a2: {
                substitution: `${formatOperand(state.alpha)} × ${formatNumber(radius2())}`,
                result: `${formatNumber(state.acceleration_2)} m/s²`,
            },
            t1: {
                substitution: `${formatNumber(parameters.mass_1)} × (${formatNumber(parameters.gravity)} + ${formatOperand(state.acceleration_1)})`,
                result: `${formatNumber(state.tension_1)} N`,
            },
            t2: {
                substitution: `${formatNumber(parameters.mass_2)} × (${formatNumber(parameters.gravity)} − ${formatOperand(state.acceleration_2)})`,
                result: `${formatNumber(state.tension_2)} N`,
            },
            check: {
                substitution: `${formatNumber(state.tension_2)} × ${formatNumber(radius2())} − ${formatNumber(state.tension_1)} × ${formatNumber(radius1())}`,
                result: `${formatNumber(state.tension_2 * radius2() - state.tension_1 * radius1())} N·m = I·α ✓`,
            },
            y1: {
                substitution: `${formatNumber(BLOCK1_START)} + ${formatOperand(state.acceleration_1)} × ${formatNumber(time)}²/2`,
                result: `${formatNumber(state.height_1)} m`,
            },
            y2: {
                substitution: `${formatNumber(BLOCK1_START)} + ${formatNumber(parameters.height_gap)} − ${formatOperand(state.acceleration_2)} × ${formatNumber(time)}²/2`,
                result: `${formatNumber(state.height_2)} m`,
            },
            meet: {
                substitution: meet_never
                    ? strings.meet_never[current_language]
                    : `√(2 × ${formatNumber(parameters.height_gap)} / (${formatOperand(state.acceleration_1)} + ${formatOperand(state.acceleration_2)}))`,
                result: meet_never ? "∞" : `${formatNumber(state.meeting_time)} s`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: heights, vertical velocities and accelerations versus time */
    function drawGraphs(time, state) {
        const total_time = Math.max(totalTime(), 1e-9);
        const y1_points = [];
        const y2_points = [];
        const v1_points = [];
        const v2_points = [];
        const a1_points = [];
        const a2_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            y1_points.push([sample_time, calc.positionBlock1(BLOCK1_START, state.acceleration_1, sample_time)]);
            y2_points.push([sample_time, calc.positionBlock2(BLOCK1_START, parameters.height_gap, state.acceleration_2, sample_time)]);
            v1_points.push([sample_time, calc.verticalVelocityBlock1(state.acceleration_1, sample_time)]);
            v2_points.push([sample_time, calc.verticalVelocityBlock2(state.acceleration_2, sample_time)]);
            a1_points.push([sample_time, state.acceleration_1]);
            a2_points.push([sample_time, -state.acceleration_2]);
        }
        graph.drawTimeGraph(document.getElementById("graph_positions"), [
            { label: "y₁", color: "#1976d2", points: y1_points },
            { label: "y₂", color: "#d32f2f", points: y2_points },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_velocities"), [
            { label: "ẏ₁", color: "#1976d2", points: v1_points },
            { label: "ẏ₂", color: "#d32f2f", points: v2_points },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_accelerations"), [
            { label: "ÿ₁", color: "#1976d2", points: a1_points },
            { label: "ÿ₂", color: "#d32f2f", points: a2_points },
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

    /* buildControls: slider + number pair per numeric parameter */
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
