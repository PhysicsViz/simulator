/*
 * main.js — Spring–incline–pulley page logic: animated scene with the incline,
 * the stretching spring, block 1 climbing the slope, the pulley and the
 * hanging block 2, all five forces on block 1 (P, N, T, spring, friction) and
 * P/T on block 2, drop-distance and final-rest markers, and a free-body
 * diagram inset of block 1; shared pan/zoom camera with auto-follow;
 * transport controls over the full Coulomb-damped oscillation until the
 * system sticks; parameters m1, m2, k, θ, µ, the questioned drop d and g;
 * formulas centered on the course's energy-theorem answer v(d) plus the
 * oscillation quantities (ω, amplitude loss 2f/k per half-cycle, final rest);
 * time graphs of x, v, a showing the linear Coulomb decay.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.spring_pulley_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Ressort, poulie et plan incliné", en: "Spring, pulley and incline" },
        assumption: {
            fr: "Hypothèses : bloc m₁ sur le plan incliné (angle θ), relié d'un côté à un ressort idéal (raideur k, longueur naturelle au départ) ancré en bas de pente, de l'autre — par une corde sans masse et une poulie idéale — au bloc m₂ suspendu. Départ au repos, ressort non tendu. Frottement cinétique µc entre m₁ et le plan (statique pris égal à µc) ; la corde reste tendue et inextensible : m₂ descend de x quand m₁ monte de x et le ressort s'allonge de x. Le mouvement exact est une oscillation harmonique amortie par frottement sec : demi-périodes π/ω (ω = √(k/(m₁+m₂))) autour de centres décalés (F ∓ f)/k, amplitude réduite de 2f/k à chaque demi-oscillation, arrêt définitif au premier point de rebroussement où |F − k·x| ≤ f. La simulation s'arrête peu après le blocage.",
            en: "Assumptions: block m₁ on the incline (angle θ), tied on one side to an ideal spring (constant k, natural length at start) anchored down the slope, and on the other — through a massless rope and ideal pulley — to the hanging block m₂. Released from rest, spring unstretched. Kinetic friction µc between m₁ and the plane (static taken equal); the rope stays taut and inextensible: m₂ falls by x while m₁ climbs by x and the spring stretches by x. The exact motion is a Coulomb-damped harmonic oscillation: half-periods π/ω (ω = √(k/(m₁+m₂))) about shifted centers (F ∓ f)/k, the amplitude shrinking by 2f/k every half-cycle, sticking for good at the first turning point where |F − k·x| ≤ f. The run ends shortly after the system sticks.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_position: { fr: "Chute de m₂ : x (m)", en: "Fall of m₂: x (m)" },
        graph_velocity: { fr: "Vitesse v (m/s)", en: "Velocity v (m/s)" },
        graph_acceleration: { fr: "Accélération a (m/s²)", en: "Acceleration a (m/s²)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au montage", en: "Fit view to the setup" },
        mass_1: { fr: "Masse sur le plan m₁", en: "Mass on the incline m₁" },
        mass_2: { fr: "Masse suspendue m₂", en: "Hanging mass m₂" },
        stiffness: { fr: "Raideur du ressort k", en: "Spring constant k" },
        incline_degrees: { fr: "Angle du plan θ", en: "Incline angle θ" },
        friction_coefficient: { fr: "Frottement cinétique µc", en: "Kinetic friction µc" },
        drop_distance: { fr: "Chute étudiée d (question)", en: "Studied drop d (question)" },
        gravity: { fr: "Pesanteur g", en: "Gravity g" },
        legend_weight: { fr: "Poids P = m·g", en: "Weight P = m·g" },
        legend_normal: { fr: "Réaction normale N", en: "Normal force N" },
        legend_tension: { fr: "Tension T", en: "Tension T" },
        legend_spring: { fr: "Force du ressort F_r = k·x", en: "Spring force F_r = k·x" },
        legend_friction: { fr: "Frottement f", en: "Friction f" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces (bloc 1)", en: "Free-body diagram (block 1)" },
        marker_drop: { fr: "d = {d} m → v = {v} m/s", en: "d = {d} m → v = {v} m/s" },
        marker_drop_never: { fr: "d = {d} m : jamais atteinte", en: "d = {d} m: never reached" },
        marker_rest: { fr: "arrêt final : x = {x} m", en: "final rest: x = {x} m" },
        formula_energy: { fr: "Question du cours : v après une chute d", en: "Course question: v after a drop d" },
        formula_motor: { fr: "Travail moteur", en: "Driving work" },
        formula_resist: { fr: "Travaux résistants", en: "Resisting works" },
        formula_normal: { fr: "Réaction normale et frottement", en: "Normal force and friction" },
        formula_omega: { fr: "Pulsation de l'oscillation", en: "Oscillation angular frequency" },
        formula_damping: { fr: "Amortissement de Coulomb", en: "Coulomb damping" },
        formula_rest: { fr: "Arrêt définitif", en: "Final rest" },
        formula_tension: { fr: "Tension de la corde", en: "Rope tension" },
        formula_acceleration: { fr: "Accélération", en: "Acceleration" },
        never_reached: { fr: "jamais atteinte (premier aller trop court)", en: "never reached (first swing too short)" },
        no_motion: { fr: "le système ne démarre pas (F ≤ f)", en: "the system does not start (F ≤ f)" },
    };

    const parameter_config = [
        { key: "mass_1", min: 0.2, max: 5, step: 0.05, unit: "kg" },
        { key: "mass_2", min: 0.5, max: 10, step: 0.05, unit: "kg" },
        { key: "stiffness", min: 5, max: 100, step: 0.5, unit: "N/m" },
        { key: "incline_degrees", min: 5, max: 60, step: 0.5, unit: "°" },
        { key: "friction_coefficient", min: 0, max: 0.8, step: 0.01, unit: "" },
        { key: "drop_distance", min: 0.05, max: 2, step: 0.01, unit: "m" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        mass_1: 1,
        mass_2: 3,
        stiffness: 16,
        incline_degrees: 25,
        friction_coefficient: 0.11,
        drop_distance: 0.2,
        gravity: 9.81,
    };

    const SPRING_VISUAL_LENGTH = 2;
    const BLOCK_SIDE = 0.5;
    const STATIC_WINDOW = 4;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const GRAPH_SAMPLES = 200;
    const FORCE_ARROW_PIXELS = 55;
    const MOTION_ARROW_PIXELS = 45;
    const WEIGHT_COLOR = "#d32f2f";
    const NORMAL_COLOR = "#43a047";
    const TENSION_COLOR = "#8e24aa";
    const SPRING_COLOR = "#1976d2";
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

    /* inclineRadians / currentMotion: shared derived quantities */
    function inclineRadians() {
        return parameters.incline_degrees * Math.PI / 180;
    }
    function currentMotion() {
        return calc.buildMotion(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity,
        );
    }

    /* totalTime: the whole damped oscillation plus a beat at rest */
    function totalTime() {
        const motion = currentMotion();
        return motion.total_duration > 0 ? motion.total_duration + 1.5 : STATIC_WINDOW;
    }

    /* geometry: slope long enough for the first (largest) swing */
    function slopeLength() {
        const swing = calc.firstSwingMax(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity,
        );
        return SPRING_VISUAL_LENGTH + swing + 1.6;
    }
    function slopeUnit() {
        return { x: Math.cos(inclineRadians()), y: Math.sin(inclineRadians()) };
    }
    function slopeNormal() {
        return { x: -Math.sin(inclineRadians()), y: Math.cos(inclineRadians()) };
    }
    function apex() {
        const length = slopeLength();
        return { x: length * Math.cos(inclineRadians()), y: length * Math.sin(inclineRadians()) };
    }
    function hangingColumnX() {
        return apex().x + 0.55;
    }
    function hangingStartY() {
        return apex().y - 1;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the incline and the deepest fall of block 2 */
    function fitView() {
        const top = apex();
        const deepest = hangingStartY() - calc.firstSwingMax(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity,
        );
        camera.fitTo({
            left: -0.8,
            right: top.x + 2.4,
            bottom: Math.min(deepest - 1, -0.6),
            top: top.y + 1.2,
        });
    }

    /* drawIncline: triangle, hatched ground under the base, pulley at the apex */
    function drawIncline(transform, ink) {
        const top = apex();
        const floor_y = transform.toScreenY(0);
        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.22)";
        context.strokeStyle = "rgba(120, 130, 145, 0.9)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(transform.toScreenX(0), floor_y);
        context.lineTo(transform.toScreenX(top.x), transform.toScreenY(top.y));
        context.lineTo(transform.toScreenX(top.x), floor_y);
        context.closePath();
        context.fill();
        context.stroke();

        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.lineWidth = 1;
        context.beginPath();
        for (let x = transform.toScreenX(-0.6); x < transform.toScreenX(top.x + 0.4); x += 14) {
            context.moveTo(x, floor_y);
            context.lineTo(x - 8, floor_y + 8);
        }
        context.stroke();

        const arc_radius = Math.abs(transform.toScreenX(0.7) - transform.toScreenX(0));
        context.strokeStyle = "#b8860b";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(transform.toScreenX(0), floor_y, arc_radius, -inclineRadians(), 0);
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(`θ = ${formatNumber(parameters.incline_degrees)}°`, transform.toScreenX(0) + arc_radius + 6, floor_y - 4);

        const pulley_x = transform.toScreenX(top.x + 0.12);
        const pulley_y = transform.toScreenY(top.y + 0.12);
        const pulley_radius = Math.abs(transform.toScreenX(0.28) - transform.toScreenX(0));
        context.fillStyle = "rgba(120, 130, 145, 0.4)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(pulley_x, pulley_y, pulley_radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.beginPath();
        context.arc(pulley_x, pulley_y, 3, 0, 2 * Math.PI);
        context.fill();
        context.restore();
    }

    /* drawSpring: zigzag from the anchor to block 1 along the slope */
    function drawSpring(transform, block_distance, ink) {
        const unit = slopeUnit();
        const normal = slopeNormal();
        const offset = 0.28;
        const start = 0.15;
        const end = block_distance - BLOCK_SIDE / 2;
        const coils = 9;
        context.save();
        context.strokeStyle = SPRING_COLOR;
        context.lineWidth = 2;
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(
            transform.toScreenX(start * unit.x + offset * normal.x),
            transform.toScreenY(start * unit.y + offset * normal.y),
        );
        for (let i = 1; i <= coils; i++) {
            const along = start + (end - start) * i / coils;
            const wobble = i === coils ? 0 : (i % 2 === 1 ? 0.16 : -0.16);
            context.lineTo(
                transform.toScreenX(along * unit.x + (offset + wobble) * normal.x),
                transform.toScreenY(along * unit.y + (offset + wobble) * normal.y),
            );
        }
        context.stroke();
        context.restore();
    }

    /* blockOneCenter: world center of block 1 for a slide x */
    function blockOneCenter(position) {
        const unit = slopeUnit();
        const normal = slopeNormal();
        const along = SPRING_VISUAL_LENGTH + position;
        return {
            x: along * unit.x + (BLOCK_SIDE / 2) * normal.x,
            y: along * unit.y + (BLOCK_SIDE / 2) * normal.y,
            along,
        };
    }

    /* drawBlockOne: square block aligned with the slope */
    function drawBlockOne(transform, center, ink) {
        const unit = slopeUnit();
        const normal = slopeNormal();
        const half = BLOCK_SIDE / 2;
        const corners = [
            [center.x + half * unit.x + half * normal.x, center.y + half * unit.y + half * normal.y],
            [center.x - half * unit.x + half * normal.x, center.y - half * unit.y + half * normal.y],
            [center.x - half * unit.x - half * normal.x, center.y - half * unit.y - half * normal.y],
            [center.x + half * unit.x - half * normal.x, center.y + half * unit.y - half * normal.y],
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
        context.fillText(
            `m₁ = ${formatNumber(parameters.mass_1)} kg`,
            transform.toScreenX(center.x + 0.8 * normal.x),
            transform.toScreenY(center.y + 0.8 * normal.y),
        );
        context.restore();
    }

    /* drawRopeAndBlockTwo: rope over the pulley and the hanging block */
    function drawRopeAndBlockTwo(transform, block_one_center, fall, ink) {
        const top = apex();
        const column_x = hangingColumnX();
        const block_two_y = hangingStartY() - fall;
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(transform.toScreenX(block_one_center.x), transform.toScreenY(block_one_center.y));
        context.lineTo(transform.toScreenX(top.x + 0.12), transform.toScreenY(top.y + 0.4));
        context.moveTo(transform.toScreenX(column_x), transform.toScreenY(top.y + 0.1));
        context.lineTo(transform.toScreenX(column_x), transform.toScreenY(block_two_y + BLOCK_SIDE / 2));
        context.stroke();

        const left = transform.toScreenX(column_x - BLOCK_SIDE / 2);
        const top_screen = transform.toScreenY(block_two_y + BLOCK_SIDE / 2);
        const size_x = transform.toScreenX(column_x + BLOCK_SIDE / 2) - left;
        const size_y = transform.toScreenY(block_two_y - BLOCK_SIDE / 2) - top_screen;
        context.fillStyle = "rgba(211, 47, 47, 0.22)";
        context.strokeStyle = "#d32f2f";
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(left, top_screen, size_x, size_y, 4);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 11px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(
            `m₂ = ${formatNumber(parameters.mass_2)} kg`,
            transform.toScreenX(column_x + BLOCK_SIDE / 2) + 8,
            transform.toScreenY(block_two_y),
        );
        context.restore();
        return { column_x, block_two_y };
    }

    /* drawMarkers: the questioned drop depth and the final rest depth */
    function drawMarkers(transform, motion, ink) {
        const column_x = hangingColumnX();
        const speed = calc.speedAfterDrop(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity, parameters.drop_distance,
        );
        const reachable = parameters.drop_distance <= calc.firstSwingMax(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity,
        ) + 1e-9;
        const markers = [
            {
                world_y: hangingStartY() - parameters.drop_distance,
                color: "#b8860b",
                label: reachable
                    ? strings.marker_drop[current_language]
                        .replace("{d}", formatNumber(parameters.drop_distance))
                        .replace("{v}", formatNumber(speed))
                    : strings.marker_drop_never[current_language]
                        .replace("{d}", formatNumber(parameters.drop_distance)),
            },
            {
                world_y: hangingStartY() - motion.rest_position,
                color: "rgba(120, 130, 145, 0.9)",
                label: strings.marker_rest[current_language].replace("{x}", formatNumber(motion.rest_position)),
            },
        ];
        context.save();
        for (const marker of markers) {
            const screen_y = transform.toScreenY(marker.world_y);
            context.strokeStyle = marker.color;
            context.lineWidth = 1.5;
            context.setLineDash([7, 6]);
            context.beginPath();
            context.moveTo(transform.toScreenX(column_x - 1.6), screen_y);
            context.lineTo(transform.toScreenX(column_x + 2.6), screen_y);
            context.stroke();
            context.setLineDash([]);
            context.fillStyle = marker.color;
            context.font = "bold 12px system-ui, sans-serif";
            context.textAlign = "left";
            context.textBaseline = "bottom";
            context.fillText(marker.label, transform.toScreenX(column_x - 1.5), screen_y - 4);
        }
        context.restore();
    }

    /* currentForces: all live forces for a motion state */
    function currentForces(state) {
        const spring_force = parameters.stiffness * Math.max(state.position, 0);
        const normal = calc.normalForce(parameters.mass_1, inclineRadians(), parameters.gravity);
        const friction_max = calc.frictionMagnitude(parameters.mass_1, inclineRadians(), parameters.friction_coefficient, parameters.gravity);
        const drive = calc.drivingForce(parameters.mass_1, parameters.mass_2, inclineRadians(), parameters.gravity);
        let friction;
        if (state.moving && Math.abs(state.velocity) > 1e-9) {
            friction = -Math.sign(state.velocity) * friction_max;
        } else {
            friction = -Math.min(Math.max(drive - parameters.stiffness * state.position, -friction_max), friction_max);
        }
        const tension = calc.ropeTension(parameters.mass_2, parameters.gravity, state.acceleration);
        return { spring_force, normal, friction, tension, friction_max };
    }

    /* drawForceVectors: the five forces on block 1 and P/T on block 2 */
    function drawForceVectors(transform, block_one_center, block_two, state, forces, references, ink) {
        const unit = slopeUnit();
        const normal = slopeNormal();
        const scale = FORCE_ARROW_PIXELS / references.force;
        const b1x = transform.toScreenX(block_one_center.x);
        const b1y = transform.toScreenY(block_one_center.y);
        const weight_1 = parameters.mass_1 * parameters.gravity;

        draw.drawVector(context, b1x, b1y, 0, weight_1 * scale, { color: WEIGHT_COLOR, label: "P₁" });
        draw.drawVector(context, b1x, b1y, forces.normal * normal.x * scale, -forces.normal * normal.y * scale, { color: NORMAL_COLOR, label: "N" });
        draw.drawVector(context, b1x, b1y, forces.tension * unit.x * scale, -forces.tension * unit.y * scale, { color: TENSION_COLOR, label: "T" });
        if (forces.spring_force > 1e-9) {
            draw.drawVector(context, b1x, b1y, -forces.spring_force * unit.x * scale, forces.spring_force * unit.y * scale, { color: SPRING_COLOR, label: "F_r" });
        }
        if (Math.abs(forces.friction) > 1e-9) {
            draw.drawVector(context, b1x, b1y, forces.friction * unit.x * scale, -forces.friction * unit.y * scale, { color: FRICTION_COLOR, label: "f" });
        }

        const b2x = transform.toScreenX(block_two.column_x);
        const b2y = transform.toScreenY(block_two.block_two_y);
        draw.drawVector(context, b2x, b2y, 0, parameters.mass_2 * parameters.gravity * scale, { color: WEIGHT_COLOR, label: "P₂" });
        draw.drawVector(context, b2x, b2y, 0, -forces.tension * scale, { color: TENSION_COLOR, label: "T" });

        if (references.speed > 0 && Math.abs(state.velocity) > 1e-9) {
            draw.drawVector(context, b2x - 40, b2y, 0, state.velocity * MOTION_ARROW_PIXELS / references.speed, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (references.acceleration > 0 && Math.abs(state.acceleration) > 1e-9) {
            draw.drawVector(context, b2x - 70, b2y, 0, state.acceleration * MOTION_ARROW_PIXELS / references.acceleration, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
    }

    /* drawFreeBodyInset: block 1 alone with its five forces, values included */
    function drawFreeBodyInset(forces, ink) {
        const unit = slopeUnit();
        const normal = slopeNormal();
        const box_width = 216;
        const box_height = 224;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 96;
        const reference = Math.max(forces.tension, parameters.mass_1 * parameters.gravity, forces.normal, forces.spring_force, 1e-9);
        const scale = 44 / reference;

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

        draw.drawVector(context, center_x, center_y, 0, Math.max(parameters.mass_1 * parameters.gravity * scale, 12), { color: WEIGHT_COLOR, label: "P₁" });
        draw.drawVector(context, center_x, center_y, forces.normal * normal.x * scale, -forces.normal * normal.y * scale, { color: NORMAL_COLOR, label: "N" });
        draw.drawVector(context, center_x, center_y, forces.tension * unit.x * scale, -forces.tension * unit.y * scale, { color: TENSION_COLOR, label: "T" });
        if (forces.spring_force > 1e-9) {
            draw.drawVector(context, center_x, center_y, -forces.spring_force * unit.x * scale, forces.spring_force * unit.y * scale, { color: SPRING_COLOR, label: "F_r" });
        }
        if (Math.abs(forces.friction) > 1e-9) {
            draw.drawVector(context, center_x, center_y, forces.friction * unit.x * scale, -forces.friction * unit.y * scale, { color: FRICTION_COLOR, label: "f" });
        }
        context.save();
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = TENSION_COLOR;
        context.fillText(`T = ${formatNumber(forces.tension)} N`, center_x, box_y + box_height - 46);
        context.fillStyle = FRICTION_COLOR;
        context.fillText(`f = ${formatNumber(forces.friction)} N`, center_x, box_y + box_height - 30);
        context.restore();
    }

    /* drawScene: full scene for a given time; returns the live quantities */
    function drawScene(transform, time, motion) {
        const ink = inkColor();
        const state = calc.motionAt(motion, time);
        const forces = currentForces(state);
        const first_swing = calc.firstSwingMax(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity,
        );
        const peak_speed = calc.speedAfterDrop(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            inclineRadians(), parameters.friction_coefficient, parameters.gravity, first_swing / 2,
        );
        const references = {
            force: Math.max(forces.tension, parameters.mass_2 * parameters.gravity, forces.normal, forces.spring_force, 1e-9),
            speed: Math.max(peak_speed, 1e-9),
            acceleration: Math.max(parameters.gravity, 1e-9),
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawIncline(transform, ink);
        const block_one = blockOneCenter(state.position);
        drawSpring(transform, block_one.along, ink);
        drawBlockOne(transform, block_one, ink);
        const block_two = drawRopeAndBlockTwo(transform, block_one, state.position, ink);

        /* Game mode hook — remove together with game.js (the markers reveal the
           speed answer and the final rest position the game asks to place) */
        if (!document.body.classList.contains("game-mode")) {
            drawMarkers(transform, motion, ink);
        }

        drawForceVectors(transform, block_one, block_two, state, forces, references, ink);
        drawFreeBodyInset(forces, ink);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.spring_pulley_game_overlay === "function") {
            globalThis.spring_pulley_game_overlay(context, transform, {
                time,
                total_time: totalTime(),
                position: state.position,
                moving: state.moving,
                column_x: block_two.column_x,
                start_y: hangingStartY(),
            });
        }
        return { ...state, forces };
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state, motion) {
        const theta = inclineRadians();
        const drive_work = parameters.mass_2 * parameters.gravity * parameters.drop_distance;
        const slope_work = parameters.mass_1 * parameters.gravity * Math.sin(theta) * parameters.drop_distance;
        const spring_work = parameters.stiffness * parameters.drop_distance * parameters.drop_distance / 2;
        const friction_force = calc.frictionMagnitude(parameters.mass_1, theta, parameters.friction_coefficient, parameters.gravity);
        const friction_work = friction_force * parameters.drop_distance;
        const speed = calc.speedAfterDrop(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            theta, parameters.friction_coefficient, parameters.gravity, parameters.drop_distance,
        );
        const first_swing = calc.firstSwingMax(
            parameters.mass_1, parameters.mass_2, parameters.stiffness,
            theta, parameters.friction_coefficient, parameters.gravity,
        );
        const reachable = parameters.drop_distance <= first_swing + 1e-9;
        const omega = calc.angularFrequency(parameters.stiffness, parameters.mass_1, parameters.mass_2);
        const no_motion = motion.phases.length === 0;

        const cards = {
            energy: {
                substitution: `v² = 2 × (${formatNumber(drive_work)} − ${formatNumber(slope_work)} − ${formatNumber(spring_work)} − ${formatNumber(friction_work)}) / ${formatNumber(parameters.mass_1 + parameters.mass_2)}`,
                result: reachable ? `v = ${formatNumber(speed)} m/s` : strings.never_reached[current_language],
            },
            motor: {
                substitution: `${formatNumber(parameters.mass_2)} × ${formatNumber(parameters.gravity)} × ${formatNumber(parameters.drop_distance)}`,
                result: `${formatNumber(drive_work)} J`,
            },
            resist: {
                substitution: `${formatNumber(slope_work)} + ${formatNumber(spring_work)} + ${formatNumber(friction_work)}`,
                result: `${formatNumber(slope_work + spring_work + friction_work)} J`,
            },
            normal: {
                substitution: `N = ${formatNumber(parameters.mass_1)} × ${formatNumber(parameters.gravity)} × cos ${formatNumber(parameters.incline_degrees)}° ; f = ${formatNumber(parameters.friction_coefficient)} × N`,
                result: `${formatNumber(calc.normalForce(parameters.mass_1, theta, parameters.gravity))} N · ${formatNumber(friction_force)} N`,
            },
            omega: {
                substitution: `√(${formatNumber(parameters.stiffness)} / ${formatNumber(parameters.mass_1 + parameters.mass_2)})`,
                result: `${formatNumber(omega)} rad/s`,
            },
            damping: {
                substitution: `2 × ${formatNumber(friction_force)} / ${formatNumber(parameters.stiffness)}`,
                result: `${formatNumber(2 * friction_force / parameters.stiffness)} m`,
            },
            rest: {
                substitution: no_motion
                    ? strings.no_motion[current_language]
                    : `|F − k·x| ≤ f ; ${formatNumber(motion.phases.length)} demi-oscillations`,
                result: `x = ${formatNumber(motion.rest_position)} m`,
            },
            tension: {
                substitution: `${formatNumber(parameters.mass_2)} × (${formatNumber(parameters.gravity)} − ${formatNumber(state.acceleration)})`,
                result: `${formatNumber(state.forces.tension)} N`,
            },
            acceleration: {
                substitution: `(${formatNumber(calc.drivingForce(parameters.mass_1, parameters.mass_2, theta, parameters.gravity))} + ${formatNumber(state.forces.friction)} − ${formatNumber(parameters.stiffness)} × ${formatNumber(state.position)}) / ${formatNumber(parameters.mass_1 + parameters.mass_2)}`,
                result: `${formatNumber(state.acceleration)} m/s²`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: x, v, a versus time — the Coulomb-damped oscillation */
    function drawGraphs(time, motion) {
        const total_time = Math.max(totalTime(), 1e-9);
        const x_points = [];
        const v_points = [];
        const a_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            const state = calc.motionAt(motion, sample_time);
            x_points.push([sample_time, state.position]);
            v_points.push([sample_time, state.velocity]);
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
        const motion = currentMotion();
        const total_time = totalTime();
        const time = Math.min(simulation_time, total_time);
        const state = drawScene(camera.transform(), time, motion);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        const timeline = document.getElementById("timeline");
        timeline.max = Math.max(total_time, 0.01);
        timeline.value = time;
        updateFormulas(time, state, motion);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs(time, motion);
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
