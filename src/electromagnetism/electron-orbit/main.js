/*
 * main.js — Electron-orbit page logic: animated scene with the proton, the
 * electron circling it (grid in PICOMETERS), a counting gate on the orbit
 * that flashes at every pass with a live charge counter, the conventional
 * current arrow running opposite the electron, velocity / centripetal
 * acceleration / Coulomb force vectors and a free-body diagram inset; shared
 * pan/zoom camera; transport controls over three periods with the slowdown
 * factor displayed (the real period is ~10⁻¹⁶ s, times are shown in
 * attoseconds); parameters R (pm) and v (km/s); formulas answering the course
 * question I = e·v/(2πR) plus T, f, ω, a, the magnetic moment (compared to
 * the Bohr magneton) and the field at the center; graphs of positions,
 * velocities and the charge staircase Q(t) against the average line I·t.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.electron_orbit_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Courant de l'électron (atome de Bohr)", en: "Electron current (Bohr atom)" },
        assumption: {
            fr: "Hypothèses : modèle classique de Bohr — l'électron (charge −e, e = 1,602 × 10⁻¹⁹ C) décrit un cercle de rayon R à vitesse constante v autour du proton, retenu par la seule attraction de Coulomb (poids négligeable). Le courant moyen se lit sur une section de l'« anneau » : la charge e passe une fois par période T = 2πR/v, donc I = e/T = e·v/(2πR). Le sens conventionnel du courant est OPPOSÉ au mouvement de l'électron (charge négative). Grille du schéma en picomètres (1 pm = 10⁻¹² m) ; les temps sont affichés en attosecondes (1 as = 10⁻¹⁸ s) et l'animation est très fortement ralentie (facteur affiché sous la barre de temps).",
            en: "Assumptions: classical Bohr picture — the electron (charge −e, e = 1.602 × 10⁻¹⁹ C) describes a circle of radius R at constant speed v around the proton, held by the Coulomb attraction alone (weight negligible). The average current is read on a section of the \"ring\": the charge e passes once per period T = 2πR/v, so I = e/T = e·v/(2πR). The conventional current direction is OPPOSITE to the electron's motion (negative charge). Canvas grid in picometers (1 pm = 10⁻¹² m); times are shown in attoseconds (1 as = 10⁻¹⁸ s) and the animation is hugely slowed down (factor shown under the timeline).",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Positions x, y (pm)", en: "Positions x, y (pm)" },
        graph_velocities: { fr: "Vitesses vx, vy (km/s)", en: "Velocities vx, vy (km/s)" },
        graph_charge: { fr: "Charge passée Q (en e) — escalier et moyenne I·t", en: "Charge passed Q (in e) — staircase and average I·t" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−1 %", en: "−1 %" },
        step_forward: { fr: "+1 %", en: "+1 %" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        time_scale: { fr: "Animation ralentie ×{factor}", en: "Animation slowed ×{factor}" },
        zoom_fit_hint: { fr: "Ajuster la vue à l'orbite", en: "Fit view to the orbit" },
        radius_picometers: { fr: "Rayon de l'orbite R", en: "Orbit radius R" },
        speed_kilometers: { fr: "Vitesse de l'électron v", en: "Electron speed v" },
        legend_force: { fr: "Force de Coulomb F", en: "Coulomb force F" },
        legend_current: { fr: "Courant conventionnel I (opposé à v)", en: "Conventional current I (opposite to v)" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération centripète a", en: "Centripetal acceleration a" },
        fbd_title: { fr: "Bilan des forces (électron)", en: "Free-body diagram (electron)" },
        counter_title: { fr: "Compteur au portillon", en: "Gate counter" },
        counter_info: { fr: "tours : {n} · Q = {n}·e = {q} C", en: "turns: {n} · Q = {n}·e = {q} C" },
        formula_period: { fr: "Période de révolution", en: "Revolution period" },
        formula_frequency: { fr: "Fréquence de passage", en: "Crossing frequency" },
        formula_current: { fr: "Question du cours : courant moyen", en: "Course question: average current" },
        formula_charge: { fr: "Charge passée au portillon", en: "Charge passed at the gate" },
        formula_omega: { fr: "Vitesse angulaire", en: "Angular velocity" },
        formula_acceleration: { fr: "Accélération centripète", en: "Centripetal acceleration" },
        formula_moment: { fr: "Moment magnétique (bonus)", en: "Magnetic moment (bonus)" },
        formula_field: { fr: "Champ au centre (bonus)", en: "Field at the center (bonus)" },
        moment_note: { fr: "≈ magnéton de Bohr (9,27 × 10⁻²⁴ A·m²)", en: "≈ Bohr magneton (9.27 × 10⁻²⁴ A·m²)" },
    };

    const parameter_config = [
        { key: "radius_picometers", min: 10, max: 500, step: 1, unit: "pm" },
        { key: "speed_kilometers", min: 100, max: 10000, step: 10, unit: "km/s" },
    ];
    const parameters = {
        radius_picometers: 53,
        speed_kilometers: 2200,
    };

    const PERIODS_SHOWN = 3;
    const ANIMATION_SECONDS = 24;
    const ATTOSECOND = 1e-18;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const GRAPH_SAMPLES = 300;
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
    function radiusMeters() {
        return parameters.radius_picometers * 1e-12;
    }
    function speedMeters() {
        return parameters.speed_kilometers * 1000;
    }

    /* totalTime: three revolution periods (seconds) */
    function totalTime() {
        return PERIODS_SHOWN * calc.period(radiusMeters(), speedMeters());
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the orbit (world units: picometers) */
    function fitView() {
        const extent = parameters.radius_picometers + 45;
        camera.fitTo({ left: -extent, right: extent, bottom: -extent * 0.75, top: extent * 0.75 });
    }

    /* drawScene: proton, orbit, gate, electron, vectors, counter, current arrow */
    function drawScene(transform, time) {
        const ink = inkColor();
        const radius_pm = parameters.radius_picometers;
        const omega = calc.angularVelocity(radiusMeters(), speedMeters());
        const angle = omega * time;
        const electron_x = radius_pm * Math.cos(angle);
        const electron_y = radius_pm * Math.sin(angle);
        const screen_center_x = transform.toScreenX(0);
        const screen_center_y = transform.toScreenY(0);
        const screen_radius = Math.abs(transform.toScreenX(radius_pm) - screen_center_x);
        const electron_screen_x = transform.toScreenX(electron_x);
        const electron_screen_y = transform.toScreenY(electron_y);
        const turns = calc.completedTurns(radiusMeters(), speedMeters(), time);
        const period = calc.period(radiusMeters(), speedMeters());
        const gate_flash = time > 0 && (time / period) % 1 < 0.05;

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.6)";
        context.lineWidth = 1.5;
        context.setLineDash([6, 6]);
        context.beginPath();
        context.arc(screen_center_x, screen_center_y, screen_radius, 0, 2 * Math.PI);
        context.stroke();
        context.setLineDash([]);

        const gate_inner = transform.toScreenX(radius_pm * 0.88);
        const gate_outer = transform.toScreenX(radius_pm * 1.12);
        context.strokeStyle = gate_flash ? "#fbc02d" : "#b8860b";
        context.lineWidth = gate_flash ? 5 : 2.5;
        context.beginPath();
        context.moveTo(gate_inner, screen_center_y);
        context.lineTo(gate_outer, screen_center_y);
        context.stroke();

        const arc_radius = screen_radius + 26;
        context.strokeStyle = "#43a047";
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(screen_center_x, screen_center_y, arc_radius, -0.4, 0.6);
        context.stroke();
        const head_angle = -0.46;
        const head_x = screen_center_x + arc_radius * Math.cos(head_angle);
        const head_y = screen_center_y + arc_radius * Math.sin(head_angle);
        draw.drawVector(context, head_x + 6 * Math.sin(head_angle), head_y - 6 * Math.cos(head_angle), 10 * Math.sin(head_angle), -10 * Math.cos(head_angle), { color: "#43a047", line_width: 2.5 });
        context.fillStyle = "#43a047";
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText("I", screen_center_x + arc_radius + 8, screen_center_y - 14);
        context.restore();

        context.save();
        const proton_radius = Math.max(screen_radius * 0.1, 9);
        const proton_gradient = context.createRadialGradient(
            screen_center_x - proton_radius * 0.3, screen_center_y - proton_radius * 0.3, proton_radius * 0.2,
            screen_center_x, screen_center_y, proton_radius,
        );
        proton_gradient.addColorStop(0, "#f2b6b6");
        proton_gradient.addColorStop(1, "#c62828");
        context.fillStyle = proton_gradient;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(screen_center_x, screen_center_y, proton_radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = `bold ${Math.max(proton_radius, 10)}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("+", screen_center_x, screen_center_y);

        const electron_radius = Math.max(screen_radius * 0.06, 6);
        context.fillStyle = "#1976d2";
        context.strokeStyle = "#ffffff";
        context.beginPath();
        context.arc(electron_screen_x, electron_screen_y, electron_radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = `bold ${Math.max(electron_radius * 1.4, 10)}px system-ui, sans-serif`;
        context.fillText("−", electron_screen_x, electron_screen_y);
        context.restore();

        draw.drawVector(context, electron_screen_x, electron_screen_y,
            -Math.sin(angle) * 52, -Math.cos(angle) * 52,
            { color: ink, dash: [7, 5], line_width: 2, label: "v" });
        draw.drawVector(context, electron_screen_x, electron_screen_y,
            -Math.cos(angle) * 38, Math.sin(angle) * 38,
            { color: ink, dash: [2, 4], line_width: 2, label: "a" });
        draw.drawVector(context, electron_screen_x, electron_screen_y,
            -Math.cos(angle) * 56, Math.sin(angle) * 56,
            { color: "#1976d2", label: "F" });

        drawCounter(turns, ink);
        drawFreeBodyInset(ink);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.electron_orbit_game_overlay === "function") {
            globalThis.electron_orbit_game_overlay(context, transform, {
                time,
                total_time: totalTime(),
                current: calc.averageCurrent(radiusMeters(), speedMeters()),
            });
        }
        return { turns };
    }

    /* drawCounter: gate counter box — turns and charge passed */
    function drawCounter(turns, ink) {
        const box_width = 250;
        const box_x = (canvas.width - box_width) / 2;
        context.save();
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches
            ? "rgba(22, 27, 34, 0.92)"
            : "rgba(255, 255, 255, 0.92)";
        context.strokeStyle = "rgba(184, 134, 11, 0.6)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(box_x, 12, box_width, 52, 8);
        context.fill();
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(strings.counter_title[current_language], canvas.width / 2, 19);
        context.fillStyle = ink;
        context.font = "12px system-ui, sans-serif";
        context.fillText(
            strings.counter_info[current_language]
                .replace(/\{n\}/g, String(turns))
                .replace("{q}", formatScientific(turns * calc.ELEMENTARY_CHARGE)),
            canvas.width / 2,
            38,
        );
        context.restore();
    }

    /* drawFreeBodyInset: the electron alone, held by the Coulomb attraction */
    function drawFreeBodyInset(ink) {
        const box_width = 190;
        const box_height = 150;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 74;

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
        context.arc(center_x + 40, center_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, center_x + 40, center_y, -52, 0, { color: "#1976d2", label: "F" });
        context.save();
        context.fillStyle = "#1976d2";
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            `F = k·e²/R² = ${formatScientific(calc.coulombForce(radiusMeters()))} N`,
            center_x,
            box_y + box_height - 28,
        );
        context.restore();
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const radius = radiusMeters();
        const speed = speedMeters();
        const period = calc.period(radius, speed);
        const current = calc.averageCurrent(radius, speed);
        const cards = {
            period: {
                substitution: `2π × ${formatScientific(radius)} / ${formatScientific(speed)}`,
                result: `${formatScientific(period)} s = ${formatNumber(period / ATTOSECOND)} as`,
            },
            frequency: {
                substitution: `1 / ${formatScientific(period)}`,
                result: `${formatScientific(calc.frequency(radius, speed))} tours/s`,
            },
            current: {
                substitution: `${current_language === "fr" ? "1,602" : "1.602"} × 10⁻¹⁹ × ${formatScientific(speed)} / (2π × ${formatScientific(radius)})`,
                result: `${formatScientific(current)} A = ${formatNumber(current * 1000)} mA`,
            },
            charge: {
                substitution: `${state.turns} × ${current_language === "fr" ? "1,602" : "1.602"} × 10⁻¹⁹`,
                result: `${formatScientific(state.turns * calc.ELEMENTARY_CHARGE)} C`,
            },
            omega: {
                substitution: `${formatScientific(speed)} / ${formatScientific(radius)}`,
                result: `${formatScientific(calc.angularVelocity(radius, speed))} rad/s`,
            },
            acceleration: {
                substitution: `${formatScientific(speed)}² / ${formatScientific(radius)}`,
                result: `${formatScientific(calc.centripetalAcceleration(radius, speed))} m/s²`,
            },
            moment: {
                substitution: `${formatScientific(current)} × π × ${formatScientific(radius)}²`,
                result: `${formatScientific(calc.magneticMoment(radius, speed))} A·m²`,
            },
            field: {
                substitution: `4π × 10⁻⁷ × ${formatScientific(current)} / (2 × ${formatScientific(radius)})`,
                result: `${formatNumber(calc.centerField(radius, speed))} T`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
        document.getElementById("moment_note").textContent = strings.moment_note[current_language];
    }

    /* drawGraphs: positions, velocities and the charge staircase versus t (as) */
    function drawGraphs(time) {
        const radius = radiusMeters();
        const speed = speedMeters();
        const omega = calc.angularVelocity(radius, speed);
        const period = calc.period(radius, speed);
        const total_time = totalTime();
        const x_points = [];
        const y_points = [];
        const vx_points = [];
        const vy_points = [];
        const stair_points = [];
        const average_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            const attos = sample_time / ATTOSECOND;
            const angle = omega * sample_time;
            x_points.push([attos, parameters.radius_picometers * Math.cos(angle)]);
            y_points.push([attos, parameters.radius_picometers * Math.sin(angle)]);
            vx_points.push([attos, -parameters.speed_kilometers * Math.sin(angle)]);
            vy_points.push([attos, parameters.speed_kilometers * Math.cos(angle)]);
            stair_points.push([attos, calc.completedTurns(radius, speed, sample_time)]);
            average_points.push([attos, sample_time / period]);
        }
        const cursor = time / ATTOSECOND;
        const x_label = "t (as)";
        graph.drawTimeGraph(document.getElementById("graph_positions"), [
            { label: "x", color: "#1976d2", points: x_points },
            { label: "y", color: "#d32f2f", points: y_points },
        ], { cursor_time: cursor, unit: "pm", x_label });
        graph.drawTimeGraph(document.getElementById("graph_velocities"), [
            { label: "vx", color: "#1976d2", points: vx_points },
            { label: "vy", color: "#d32f2f", points: vy_points },
        ], { cursor_time: cursor, unit: "km/s", x_label });
        graph.drawTimeGraph(document.getElementById("graph_charge"), [
            { label: "Q/e", color: "#b8860b", points: stair_points },
            { label: "I·t/e", color: "#43a047", points: average_points },
        ], { cursor_time: cursor, unit: "e", x_label });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const total_time = totalTime();
        const time = Math.min(simulation_time, total_time);
        const state = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time / ATTOSECOND)} as`;
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
       ×1 playback runs the three periods in ANIMATION_SECONDS wall seconds. */
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
