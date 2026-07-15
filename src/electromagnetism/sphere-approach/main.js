/*
 * main.js — Sphere-approach page logic: animated scene (grid in CENTIMETERS)
 * with the uniformly charged insulating sphere, the forbidden-margin and
 * turning-point circles, the ball flying in along the axis with repulsion /
 * velocity / acceleration vectors and a free-body diagram inset; shared
 * pan/zoom camera; transport controls over the full in-and-out flight (times
 * shown in milliseconds, slowdown factor displayed); parameters Q, q, m, the
 * launch speed v∞ (defined at infinity — the animation starts at r₀ = 2 m
 * with the energy-consistent speed), R and the questioned margin d; formulas
 * answering the course question v_min = √(2kQq/(m(R+d))) plus energy
 * conservation, the turning radius, U(r), E_c(r), F, a and the Gauss
 * point-charge equivalence; graphs of r, ṙ, a and the three energies.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.sphere_approach_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Approche d'une sphère chargée", en: "Approaching a charged sphere" },
        assumption: {
            fr: "Hypothèses : sphère isolante de rayon R uniformément chargée (Q), maintenue immobile dans le vide sidéral ; bille ponctuelle (q, m) lancée droit vers le centre « de très loin » (énergie potentielle nulle à l'infini) ; aucune autre force. À l'extérieur (r ≥ R), le théorème de Gauss rend la sphère équivalente à une charge ponctuelle au centre : U(r) = k·Q·q/r, F = k·Q·q/r². Le paramètre v∞ est la vitesse de lancement à très grande distance ; l'animation démarre à r₀ = 2 m avec la vitesse cohérente en énergie. Mouvement radial exact (aller hyperbolique, retour symétrique) ; si l'énergie suffit pour atteindre r = R, la bille percute la sphère. Grille en centimètres, temps en millisecondes, animation ralentie (facteur affiché).",
            en: "Assumptions: insulating sphere of radius R uniformly charged (Q), held fixed in deep space; point ball (q, m) launched straight at the center \"from very far\" (zero potential energy at infinity); no other force. Outside (r ≥ R), Gauss's theorem makes the sphere equivalent to a point charge at its center: U(r) = k·Q·q/r, F = k·Q·q/r². The parameter v∞ is the launch speed at very large distance; the animation starts at r₀ = 2 m with the energy-consistent speed. Exact radial motion (hyperbolic inbound leg, symmetric return); with enough energy to reach r = R the ball hits the sphere. Grid in centimeters, times in milliseconds, animation slowed (factor displayed).",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_radius: { fr: "Distance au centre r (cm)", en: "Distance to the center r (cm)" },
        graph_velocity: { fr: "Vitesse radiale ṙ (m/s)", en: "Radial velocity ṙ (m/s)" },
        graph_acceleration: { fr: "Accélération a (m/s²)", en: "Acceleration a (m/s²)" },
        graph_energy: { fr: "Énergies (J)", en: "Energies (J)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−1 %", en: "−1 %" },
        step_forward: { fr: "+1 %", en: "+1 %" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        time_scale: { fr: "Animation ralentie ×{factor}", en: "Animation slowed ×{factor}" },
        zoom_fit_hint: { fr: "Ajuster la vue à la trajectoire", en: "Fit view to the flight" },
        sphere_charge_microcoulombs: { fr: "Charge de la sphère Q", en: "Sphere charge Q" },
        ball_charge_microcoulombs: { fr: "Charge de la bille q", en: "Ball charge q" },
        ball_mass_milligrams: { fr: "Masse de la bille m", en: "Ball mass m" },
        launch_speed: { fr: "Vitesse de lancement v∞", en: "Launch speed v∞" },
        sphere_radius_centimeters: { fr: "Rayon de la sphère R", en: "Sphere radius R" },
        margin_centimeters: { fr: "Distance minimale à la surface d (question)", en: "Minimum distance to the surface d (question)" },
        legend_force: { fr: "Répulsion F = k·Q·q/r²", en: "Repulsion F = k·Q·q/r²" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        fbd_title: { fr: "Bilan des forces (bille)", en: "Free-body diagram (ball)" },
        marker_limit: { fr: "limite : {d} cm de la surface", en: "limit: {d} cm from the surface" },
        marker_turning: { fr: "demi-tour : r_min = {r} cm", en: "turnaround: r_min = {r} cm" },
        marker_collision: { fr: "collision avec la sphère !", en: "collision with the sphere!" },
        formula_course: { fr: "Question du cours : vitesse minimale", en: "Course question: minimum speed" },
        formula_energy: { fr: "Conservation de l'énergie", en: "Energy conservation" },
        formula_turning: { fr: "Point de rebroussement", en: "Turning point" },
        formula_potential: { fr: "Énergie potentielle U(r)", en: "Potential energy U(r)" },
        formula_kinetic: { fr: "Énergie cinétique E_c(r)", en: "Kinetic energy E_c(r)" },
        formula_force: { fr: "Force de répulsion", en: "Repulsion force" },
        formula_acceleration: { fr: "Accélération", en: "Acceleration" },
        formula_gauss: { fr: "Gauss : sphère ≡ charge ponctuelle (r ≥ R)", en: "Gauss: sphere ≡ point charge (r ≥ R)" },
        turning_collision: { fr: "r_min < R : collision !", en: "r_min < R: collision!" },
        turning_blocked: { fr: "r_min ≥ r₀ : la bille n'atteint pas la zone", en: "r_min ≥ r₀: the ball never enters the view" },
        phase_inbound: { fr: "approche", en: "inbound" },
        phase_outbound: { fr: "éloignement", en: "outbound" },
        phase_impact: { fr: "collision", en: "impact" },
        phase_blocked: { fr: "bloquée à r₀", en: "blocked at r₀" },
    };

    const parameter_config = [
        { key: "sphere_charge_microcoulombs", min: 1, max: 20, step: 0.1, unit: "µC" },
        { key: "ball_charge_microcoulombs", min: 0.1, max: 5, step: 0.1, unit: "µC" },
        { key: "ball_mass_milligrams", min: 5, max: 500, step: 1, unit: "mg" },
        { key: "launch_speed", min: 10, max: 500, step: 0.01, unit: "m/s" },
        { key: "sphere_radius_centimeters", min: 2, max: 30, step: 0.5, unit: "cm" },
        { key: "margin_centimeters", min: 0, max: 30, step: 0.5, unit: "cm" },
    ];
    const parameters = {
        sphere_charge_microcoulombs: 8,
        ball_charge_microcoulombs: 1,
        ball_mass_milligrams: 60,
        launch_speed: 112.32,
        sphere_radius_centimeters: 12,
        margin_centimeters: 7,
    };

    const START_RADIUS = 2;
    const ANIMATION_SECONDS = 20;
    const MILLISECOND = 1e-3;
    const STATIC_WINDOW = 1e-3;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const GRAPH_SAMPLES = 200;
    const SUPERSCRIPT_DIGITS = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

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

    /* formatScientific: mantissa × 10^exponent with superscripts for extremes */
    function formatScientific(value) {
        const magnitude = Math.abs(value);
        if (magnitude === 0) {
            return "0";
        }
        if (magnitude >= 0.01 && magnitude < 10000) {
            return formatNumber(value);
        }
        const exponent = Math.floor(Math.log10(magnitude));
        const mantissa = value / Math.pow(10, exponent);
        const superscript = String(exponent).split("").map((digit) => SUPERSCRIPT_DIGITS[digit]).join("");
        return `${formatNumber(mantissa)} × 10${superscript}`;
    }

    /* SI conversions from the slider units */
    function sphereCharge() {
        return parameters.sphere_charge_microcoulombs * 1e-6;
    }
    function ballCharge() {
        return parameters.ball_charge_microcoulombs * 1e-6;
    }
    function ballMass() {
        return parameters.ball_mass_milligrams * 1e-6;
    }
    function sphereRadius() {
        return parameters.sphere_radius_centimeters / 100;
    }

    /* stateAt: exact motion state (SI) at a time */
    function stateAt(time) {
        return calc.motionAt(
            sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed,
            START_RADIUS, sphereRadius(), time,
        );
    }

    /* totalTime: full in-and-out flight, or the impact time, or a static beat */
    function totalTime() {
        const turning = calc.turningRadius(sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed);
        if (turning >= START_RADIUS) {
            return STATIC_WINDOW;
        }
        const closest = Math.max(turning, sphereRadius());
        const closest_time = calc.inboundTime(
            sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed, START_RADIUS, closest,
        );
        return turning < sphereRadius() ? closest_time : 2 * closest_time;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the sphere and the whole approach axis (world in cm) */
    function fitView() {
        const top = parameters.sphere_radius_centimeters + 26;
        camera.fitTo({
            left: -parameters.sphere_radius_centimeters - 14,
            right: START_RADIUS * 100 + 14,
            bottom: -top,
            top,
        });
    }

    /* drawSphere: the uniformly charged insulating sphere with + signs */
    function drawSphere(transform, ink) {
        const radius_cm = parameters.sphere_radius_centimeters;
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(0);
        const screen_radius = Math.abs(transform.toScreenX(radius_cm) - center_x);
        context.save();
        const gradient = context.createRadialGradient(
            center_x - screen_radius * 0.3, center_y - screen_radius * 0.3, screen_radius * 0.2,
            center_x, center_y, screen_radius,
        );
        gradient.addColorStop(0, "rgba(242, 182, 182, 0.9)");
        gradient.addColorStop(1, "rgba(198, 40, 40, 0.85)");
        context.fillStyle = gradient;
        context.strokeStyle = "#c62828";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, screen_radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "rgba(255, 255, 255, 0.85)";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        for (const [fx, fy] of [[0, 0], [0.45, 0.25], [-0.45, 0.25], [0.25, -0.45], [-0.25, -0.45], [0.5, -0.15], [-0.5, -0.15], [0, 0.55]]) {
            context.fillText("+", center_x + fx * screen_radius, center_y + fy * screen_radius);
        }
        context.fillStyle = ink;
        context.textBaseline = "bottom";
        context.fillText(
            `Q = ${formatNumber(parameters.sphere_charge_microcoulombs)} µC · R = ${formatNumber(radius_cm)} cm`,
            center_x,
            center_y - screen_radius - 8,
        );
        context.restore();
    }

    /* drawMarkers: forbidden-margin circle and turning-point circle */
    function drawMarkers(transform, ink) {
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(0);
        const limit_cm = parameters.sphere_radius_centimeters + parameters.margin_centimeters;
        const turning = calc.turningRadius(sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed);
        const turning_cm = turning * 100;

        context.save();
        context.strokeStyle = "#b8860b";
        context.lineWidth = 2;
        context.setLineDash([8, 6]);
        context.beginPath();
        context.arc(center_x, center_y, Math.abs(transform.toScreenX(limit_cm) - center_x), 0, 2 * Math.PI);
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(
            strings.marker_limit[current_language].replace("{d}", formatNumber(parameters.margin_centimeters)),
            transform.toScreenX(limit_cm * 0.72),
            transform.toScreenY(limit_cm * 0.75),
        );

        if (turning >= sphereRadius() && turning < START_RADIUS) {
            context.strokeStyle = "rgba(120, 130, 145, 0.9)";
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(center_x, center_y, Math.abs(transform.toScreenX(turning_cm) - center_x), 0, 2 * Math.PI);
            context.stroke();
            context.setLineDash([]);
            context.fillStyle = "rgba(120, 130, 145, 1)";
            context.textBaseline = "top";
            context.fillText(
                strings.marker_turning[current_language].replace("{r}", formatNumber(turning_cm)),
                transform.toScreenX(turning_cm * 0.72),
                transform.toScreenY(-turning_cm * 0.78),
            );
        } else if (turning < sphereRadius()) {
            context.setLineDash([]);
            context.fillStyle = "#d32f2f";
            context.textBaseline = "top";
            context.fillText(
                strings.marker_collision[current_language],
                transform.toScreenX(parameters.sphere_radius_centimeters + 4),
                transform.toScreenY(-parameters.sphere_radius_centimeters - 6),
            );
        }
        context.restore();
    }

    /* drawBall: the point charge with its vectors */
    function drawBall(transform, state, references, ink) {
        const radius_cm = state.radius * 100;
        const screen_x = transform.toScreenX(radius_cm);
        const screen_y = transform.toScreenY(0);
        context.save();
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(screen_x, screen_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = "bold 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("+", screen_x, screen_y);
        context.restore();

        const force = calc.repulsionForce(sphereCharge(), ballCharge(), state.radius);
        draw.drawVector(context, screen_x, screen_y, 60 * force / references.force, 0, {
            color: "#1976d2",
            label: "F",
        });
        if (references.speed > 0 && Math.abs(state.radial_velocity) > 1e-9) {
            draw.drawVector(context, screen_x, screen_y - 26, 45 * state.radial_velocity / references.speed, 0, {
                color: ink,
                dash: [7, 5],
                line_width: 2,
                label: "v",
            });
        }
        if (references.acceleration > 0 && state.acceleration > 1e-9) {
            draw.drawVector(context, screen_x, screen_y + 26, 45 * state.acceleration / references.acceleration, 0, {
                color: ink,
                dash: [2, 4],
                line_width: 2,
                label: "a",
            });
        }
        return force;
    }

    /* drawFreeBodyInset: the ball alone with the single repulsion force */
    function drawFreeBodyInset(force, ink) {
        const box_width = 190;
        const box_height = 140;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 70;

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
        context.arc(center_x - 30, center_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, center_x - 30, center_y, 56, 0, { color: "#1976d2", label: "F" });
        context.save();
        context.fillStyle = "#1976d2";
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`F = ${formatScientific(force)} N`, center_x, box_y + box_height - 28);
        context.restore();
    }

    /* drawScene: sphere, markers, ball and inset; returns the live quantities */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = stateAt(time);
        const force = calc.repulsionForce(sphereCharge(), ballCharge(), state.radius);
        const closest = Math.max(
            calc.turningRadius(sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed),
            sphereRadius(),
        );
        const references = {
            force: Math.max(calc.repulsionForce(sphereCharge(), ballCharge(), closest), 1e-12),
            speed: Math.max(calc.speedAt(sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed, START_RADIUS), 1e-9),
            acceleration: Math.max(calc.repulsionForce(sphereCharge(), ballCharge(), closest) / ballMass(), 1e-9),
        };

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawSphere(transform, ink);

        /* Game mode hook — remove together with game.js (the limit and turning
           markers reveal the closest approach the game asks to place) */
        if (!document.body.classList.contains("game-mode")) {
            drawMarkers(transform, ink);
        }

        drawBall(transform, state, references, ink);
        drawFreeBodyInset(force, ink);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.sphere_approach_game_overlay === "function") {
            globalThis.sphere_approach_game_overlay(context, transform, {
                time,
                total_time: Math.max(totalTime(), 1e-12),
                radius: state.radius,
                phase: state.phase,
                sphere_radius: sphereRadius(),
            });
        }
        return { ...state, force };
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const total_energy = 0.5 * ballMass() * parameters.launch_speed * parameters.launch_speed;
        const turning = calc.turningRadius(sphereCharge(), ballCharge(), ballMass(), parameters.launch_speed);
        const limit_radius = sphereRadius() + parameters.margin_centimeters / 100;
        const potential = calc.potentialEnergy(sphereCharge(), ballCharge(), state.radius);
        let turning_result;
        if (turning >= START_RADIUS) {
            turning_result = strings.turning_blocked[current_language];
        } else if (turning < sphereRadius()) {
            turning_result = strings.turning_collision[current_language];
        } else {
            turning_result = `${formatNumber(turning * 100)} cm`;
        }

        const cards = {
            course: {
                substitution: `√(2 × ${formatScientific(calc.COULOMB_CONSTANT)} × ${formatScientific(sphereCharge())} × ${formatScientific(ballCharge())} / (${formatScientific(ballMass())} × ${formatNumber(limit_radius)}))`,
                result: `${formatNumber(calc.minimumSpeed(sphereCharge(), ballCharge(), ballMass(), limit_radius))} m/s`,
            },
            energy: {
                substitution: `½ × ${formatScientific(ballMass())} × ${formatNumber(parameters.launch_speed)}²`,
                result: `${formatScientific(total_energy)} J`,
            },
            turning: {
                substitution: `2 × k·Q·q / (m × ${formatNumber(parameters.launch_speed)}²)`,
                result: turning_result,
            },
            potential: {
                substitution: `k·Q·q / ${formatNumber(state.radius)}`,
                result: `${formatScientific(potential)} J`,
            },
            kinetic: {
                substitution: `${formatScientific(total_energy)} − ${formatScientific(potential)}`,
                result: `${formatScientific(Math.max(total_energy - potential, 0))} J · v = ${formatNumber(Math.abs(state.radial_velocity))} m/s`,
            },
            force: {
                substitution: `k·Q·q / ${formatNumber(state.radius)}²`,
                result: `${formatScientific(state.force)} N`,
            },
            acceleration: {
                substitution: `${formatScientific(state.force)} / ${formatScientific(ballMass())}`,
                result: `${formatScientific(state.force / ballMass())} m/s²`,
            },
            gauss: {
                substitution: `E(r) = k·Q / ${formatNumber(state.radius)}²`,
                result: `${formatScientific(calc.COULOMB_CONSTANT * sphereCharge() / (state.radius * state.radius))} V/m`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: r, ṙ, a and the energies versus time (ms) with live cursor */
    function drawGraphs(time) {
        const total_time = Math.max(totalTime(), 1e-12);
        const total_energy = 0.5 * ballMass() * parameters.launch_speed * parameters.launch_speed;
        const r_points = [];
        const v_points = [];
        const a_points = [];
        const kinetic_points = [];
        const potential_points = [];
        const total_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            const state = stateAt(sample_time);
            const millis = sample_time / MILLISECOND;
            const potential = calc.potentialEnergy(sphereCharge(), ballCharge(), state.radius);
            r_points.push([millis, state.radius * 100]);
            v_points.push([millis, state.radial_velocity]);
            a_points.push([millis, state.acceleration]);
            potential_points.push([millis, potential]);
            kinetic_points.push([millis, Math.max(total_energy - potential, 0)]);
            total_points.push([millis, total_energy]);
        }
        const cursor = time / MILLISECOND;
        const x_label = "t (ms)";
        graph.drawTimeGraph(document.getElementById("graph_radius"), [
            { label: "r", color: "#1976d2", points: r_points },
        ], { cursor_time: cursor, unit: "cm", x_label });
        graph.drawTimeGraph(document.getElementById("graph_velocity"), [
            { label: "ṙ", color: "#d32f2f", points: v_points },
        ], { cursor_time: cursor, unit: "m/s", x_label });
        graph.drawTimeGraph(document.getElementById("graph_acceleration"), [
            { label: "a", color: "#43a047", points: a_points },
        ], { cursor_time: cursor, unit: "m/s²", x_label });
        graph.drawTimeGraph(document.getElementById("graph_energy"), [
            { label: "E_c", color: "#d32f2f", points: kinetic_points },
            { label: "U", color: "#1976d2", points: potential_points },
            { label: "E_tot", color: "#8e24aa", points: total_points },
        ], { cursor_time: cursor, unit: "J", x_label });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const total_time = Math.max(totalTime(), 1e-12);
        const time = Math.min(simulation_time, total_time);
        const state = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time / MILLISECOND)} ms`;
        document.getElementById("time_scale_display").textContent = strings.time_scale[current_language]
            .replace("{factor}", formatScientific(ANIMATION_SECONDS / (playback_speed * total_time)));
        const timeline = document.getElementById("timeline");
        timeline.max = total_time;
        timeline.step = total_time / 1000;
        timeline.value = time;
        updateFormulas(time, state);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs(time);
        }
    }

    /* animationFrame: advance simulation time while playing, then render.
       ×1 playback runs the whole flight in ANIMATION_SECONDS wall seconds. */
    function animationFrame(timestamp) {
        if (is_playing) {
            if (last_frame_timestamp !== null) {
                const delta_seconds = Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
                simulation_time += delta_seconds * playback_speed * totalTime() / ANIMATION_SECONDS;
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

    /* stepTime: shift simulation time by a fraction of the window, clamped */
    function stepTime(direction) {
        const total_time = totalTime();
        simulation_time = Math.min(Math.max(simulation_time + direction * total_time / 100, 0), total_time);
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
        document.getElementById("step_back_button").addEventListener("click", () => stepTime(-1));
        document.getElementById("step_forward_button").addEventListener("click", () => stepTime(1));
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
