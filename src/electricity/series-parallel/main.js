/*
 * main.js — Series-versus-parallel page logic: the SAME battery and the SAME
 * resistors drawn twice side by side — series loop on the left, parallel
 * branches on the right. Wires are colored by electric potential (red = V,
 * blue = 0), so the stepwise voltage drops of the series loop and the full
 * voltage across every parallel branch are visible at a glance; golden current
 * dots travel the wires at a speed proportional to the local current, showing
 * the node law live. Parameters V, R1, R2 and an optional R3; formulas for
 * R_eq, the mesh law ΣU = V, the node law ΣI = I_total and the
 * R_série ≥ max / R_parallèle ≤ min comparison; profile graphs of R_eq, total
 * current and total power versus R2 for both layouts. Steady-state DC: no
 * transport panel, continuous redraw only (the dot motion is a visualization
 * of the conventional current direction, not a transient).
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.series_parallel_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Série et parallèle", en: "Series and parallel" },
        assumption: {
            fr: "Hypothèses : générateur idéal de tension V (résistance interne nulle), fils sans résistance, résistances ohmiques constantes, régime permanent (courant continu établi — pas d'évolution temporelle). Les deux circuits utilisent la même pile et les mêmes résistances : à gauche en série, à droite en parallèle. Couleur des fils = potentiel électrique (rouge = V, bleu = 0). Les points dorés visualisent le sens conventionnel du courant (du + vers le −), à une vitesse proportionnelle à l'intensité locale.",
            en: "Assumptions: ideal voltage source V (no internal resistance), resistanceless wires, constant ohmic resistors, steady state (established DC — no time evolution). Both circuits use the same battery and the same resistors: series on the left, parallel on the right. Wire color = electric potential (red = V, blue = 0). The golden dots visualize the conventional current direction (from + to −), at a speed proportional to the local current.",
        },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Profils en fonction de R₂", en: "Profiles versus R₂" },
        graph_resistance: { fr: "Résistance équivalente R_eq (Ω)", en: "Equivalent resistance R_eq (Ω)" },
        graph_current: { fr: "Courant total débité I (A)", en: "Total delivered current I (A)" },
        graph_power: { fr: "Puissance totale P = V·I (W)", en: "Total power P = V·I (W)" },
        zoom_fit_hint: { fr: "Ajuster la vue aux deux circuits", en: "Fit view to both circuits" },
        voltage: { fr: "Tension de la pile V", en: "Battery voltage V" },
        r1: { fr: "Résistance R₁", en: "Resistance R₁" },
        r2: { fr: "Résistance R₂", en: "Resistance R₂" },
        r3_enabled: { fr: "Troisième résistance R₃", en: "Third resistance R₃" },
        r3: { fr: "Résistance R₃", en: "Resistance R₃" },
        legend_high: { fr: "Potentiel V (borne +)", en: "Potential V (+ terminal)" },
        legend_low: { fr: "Potentiel 0 (borne −)", en: "Potential 0 (− terminal)" },
        legend_dots: { fr: "Courant conventionnel (vitesse ∝ I)", en: "Conventional current (speed ∝ I)" },
        series_title: { fr: "SÉRIE", en: "SERIES" },
        parallel_title: { fr: "PARALLÈLE", en: "PARALLEL" },
        series_summary: { fr: "I = {i} A partout · R_eq = {r} Ω", en: "I = {i} A everywhere · R_eq = {r} Ω" },
        parallel_summary: { fr: "I_total = {i} A · R_eq = {r} Ω", en: "I_total = {i} A · R_eq = {r} Ω" },
        formula_req_series: { fr: "R_eq en série", en: "Series R_eq" },
        formula_i_series: { fr: "Courant en série", en: "Series current" },
        formula_u_series: { fr: "Tensions en série (loi des mailles)", en: "Series voltages (mesh law)" },
        formula_req_parallel: { fr: "R_eq en parallèle", en: "Parallel R_eq" },
        formula_u_parallel: { fr: "Tension en parallèle", en: "Parallel voltage" },
        formula_i_parallel: { fr: "Courants en parallèle (loi des nœuds)", en: "Parallel currents (node law)" },
        formula_compare: { fr: "Comparaison des R_eq", en: "Comparing the R_eq" },
        formula_power: { fr: "Puissance totale", en: "Total power" },
    };

    const parameter_config = [
        { key: "voltage", min: 1, max: 24, step: 0.5, unit: "V" },
        { key: "r1", min: 1, max: 100, step: 1, unit: "Ω" },
        { key: "r2", min: 1, max: 100, step: 1, unit: "Ω" },
        { key: "r3_enabled", type: "toggle" },
        { key: "r3", min: 1, max: 100, step: 1, unit: "Ω" },
    ];
    const parameters = {
        voltage: 9,
        r1: 10,
        r2: 20,
        r3_enabled: true,
        r3: 30,
    };

    const GRAPH_SAMPLES = 80;
    const HIGH_COLOR = [211, 47, 47];
    const LOW_COLOR = [25, 118, 210];
    const DOT_COLOR = "#fbc02d";
    const DOT_SPACING = 26;
    const SERIES_LEFT = -12;
    const SERIES_RIGHT = -2;
    const PARALLEL_LEFT = 2;
    const PARALLEL_RIGHT = 12;
    const LOOP_TOP = 3;
    const LOOP_BOTTOM = -3;

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const camera = globalThis.scene_camera.createCamera(canvas);
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };

    let current_language = localStorage.getItem("simulator_language") || "fr";

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* activeResistances: [R1, R2] or [R1, R2, R3] with the toggle */
    function activeResistances() {
        return parameters.r3_enabled
            ? [parameters.r1, parameters.r2, parameters.r3]
            : [parameters.r1, parameters.r2];
    }

    /* currentState: every derived quantity for both layouts */
    function currentState() {
        const resistances = activeResistances();
        const series_resistance = calc.seriesResistance(resistances);
        const parallel_resistance = calc.parallelResistance(resistances);
        const parallel_currents = calc.parallelCurrents(parameters.voltage, resistances);
        return {
            resistances,
            series_resistance,
            series_current: calc.currentFromVoltage(parameters.voltage, series_resistance),
            series_voltages: calc.seriesVoltages(parameters.voltage, resistances),
            parallel_resistance,
            parallel_currents,
            parallel_total: parallel_currents.reduce((sum, value) => sum + value, 0),
        };
    }

    /* potentialColor: blue (0) → red (V) interpolation */
    function potentialColor(potential) {
        const ratio = Math.min(Math.max(potential / Math.max(parameters.voltage, 1e-9), 0), 1);
        const mix = LOW_COLOR.map((low, i) => Math.round(low + (HIGH_COLOR[i] - low) * ratio));
        return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame both circuits */
    function fitView() {
        camera.fitTo({ left: -13.5, right: 13.5, bottom: -5.6, top: 5.6 });
    }

    /* drawWire: colored polyline in world coordinates */
    function drawWire(transform, points, color) {
        context.save();
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.lineJoin = "round";
        context.beginPath();
        points.forEach(([x, y], index) => {
            if (index === 0) {
                context.moveTo(transform.toScreenX(x), transform.toScreenY(y));
            } else {
                context.lineTo(transform.toScreenX(x), transform.toScreenY(y));
            }
        });
        context.stroke();
        context.restore();
    }

    /* drawDots: golden current dots along a world polyline, speed ∝ current */
    function drawDots(transform, points, current, reference_current, time_seconds) {
        if (current <= 0) {
            return;
        }
        const screen_points = points.map(([x, y]) => [transform.toScreenX(x), transform.toScreenY(y)]);
        let total_length = 0;
        const segment_lengths = [];
        for (let i = 1; i < screen_points.length; i++) {
            const length = Math.hypot(
                screen_points[i][0] - screen_points[i - 1][0],
                screen_points[i][1] - screen_points[i - 1][1],
            );
            segment_lengths.push(length);
            total_length += length;
        }
        const speed = 14 + 110 * current / reference_current;
        const offset = (time_seconds * speed) % DOT_SPACING;
        context.save();
        context.fillStyle = DOT_COLOR;
        for (let distance = offset; distance < total_length; distance += DOT_SPACING) {
            let remaining = distance;
            for (let i = 0; i < segment_lengths.length; i++) {
                if (remaining <= segment_lengths[i]) {
                    const ratio = segment_lengths[i] > 0 ? remaining / segment_lengths[i] : 0;
                    const x = screen_points[i][0] + (screen_points[i + 1][0] - screen_points[i][0]) * ratio;
                    const y = screen_points[i][1] + (screen_points[i + 1][1] - screen_points[i][1]) * ratio;
                    context.beginPath();
                    context.arc(x, y, 3, 0, 2 * Math.PI);
                    context.fill();
                    break;
                }
                remaining -= segment_lengths[i];
            }
        }
        context.restore();
    }

    /* drawBattery: two-bar symbol on a vertical wire at world x, + terminal up */
    function drawBattery(transform, world_x, ink) {
        const x = transform.toScreenX(world_x);
        const long_half = Math.abs(transform.toScreenX(0.55) - transform.toScreenX(0));
        const short_half = long_half * 0.45;
        const top_y = transform.toScreenY(0.25);
        const bottom_y = transform.toScreenY(-0.25);
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x - long_half, top_y);
        context.lineTo(x + long_half, top_y);
        context.stroke();
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x - short_half, bottom_y);
        context.lineTo(x + short_half, bottom_y);
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText("+", x - long_half - 6, top_y);
        context.fillText("−", x - short_half - 6, bottom_y);
        context.textAlign = "left";
        context.fillText(`V = ${formatNumber(parameters.voltage)} V`, x + long_half + 8, (top_y + bottom_y) / 2);
        context.restore();
    }

    /* drawResistorBox: labeled resistor box centered at (world_x, world_y) */
    function drawResistorBox(transform, world_x, world_y, horizontal, name, resistance, detail_lines, ink) {
        const half_length = Math.abs(transform.toScreenX(0.8) - transform.toScreenX(0));
        const half_width = Math.abs(transform.toScreenX(0.42) - transform.toScreenX(0));
        const x = transform.toScreenX(world_x);
        const y = transform.toScreenY(world_y);
        const box_x = horizontal ? x - half_length : x - half_width;
        const box_y = horizontal ? y - half_width : y - half_length;
        const box_w = horizontal ? 2 * half_length : 2 * half_width;
        const box_h = horizontal ? 2 * half_width : 2 * half_length;
        context.save();
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches
            ? "rgba(22, 27, 34, 0.95)"
            : "rgba(255, 255, 255, 0.95)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(box_x, box_y, box_w, box_h, 4);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`${name} = ${Math.round(resistance)} Ω`, x, y);
        context.font = "11px system-ui, sans-serif";
        detail_lines.forEach((line, index) => {
            context.fillText(line, x, box_y + box_h + 12 + index * 14);
        });
        context.restore();
    }

    /* drawSeriesCircuit: loop with the resistors in a chain, stepwise potentials */
    function drawSeriesCircuit(transform, state, time_seconds, reference_current, ink) {
        const count = state.resistances.length;
        const usable_left = SERIES_LEFT + 1;
        const usable_right = SERIES_RIGHT - 1;
        const slot_span = (usable_right - usable_left) / count;
        const centers = state.resistances.map((_, i) => usable_left + slot_span * (i + 0.5));
        const half_length = 0.8;

        let potential = parameters.voltage;
        const segments = [];
        segments.push({
            points: [[SERIES_LEFT, 0.25], [SERIES_LEFT, LOOP_TOP], [centers[0] - half_length, LOOP_TOP]],
            potential,
        });
        for (let i = 0; i < count; i++) {
            potential -= state.series_voltages[i];
            const end_x = i + 1 < count ? centers[i + 1] - half_length : SERIES_RIGHT;
            const points = [[centers[i] + half_length, LOOP_TOP], [end_x, LOOP_TOP]];
            if (i + 1 === count) {
                points.push([SERIES_RIGHT, LOOP_BOTTOM], [SERIES_LEFT, LOOP_BOTTOM], [SERIES_LEFT, -0.25]);
            }
            segments.push({ points, potential });
        }
        for (const segment of segments) {
            drawWire(transform, segment.points, potentialColor(segment.potential));
            drawDots(transform, segment.points, state.series_current, reference_current, time_seconds);
        }
        drawBattery(transform, SERIES_LEFT, ink);
        state.resistances.forEach((resistance, i) => {
            drawResistorBox(transform, centers[i], LOOP_TOP, true, `R${["₁", "₂", "₃"][i]}`, resistance, [
                `U${["₁", "₂", "₃"][i]} = ${formatNumber(state.series_voltages[i])} V`,
            ], ink);
        });

        context.save();
        context.fillStyle = ink;
        context.font = "bold 16px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(strings.series_title[current_language], transform.toScreenX((SERIES_LEFT + SERIES_RIGHT) / 2), transform.toScreenY(LOOP_TOP + 1.4));
        context.font = "12px system-ui, sans-serif";
        context.textBaseline = "top";
        context.fillText(
            strings.series_summary[current_language]
                .replace("{i}", formatNumber(state.series_current))
                .replace("{r}", formatNumber(state.series_resistance)),
            transform.toScreenX((SERIES_LEFT + SERIES_RIGHT) / 2),
            transform.toScreenY(LOOP_BOTTOM - 0.5),
        );
        context.restore();
    }

    /* drawParallelCircuit: rails and branches, full voltage on every branch */
    function drawParallelCircuit(transform, state, time_seconds, reference_current, ink) {
        const count = state.resistances.length;
        const branch_xs = state.resistances.map((_, i) => PARALLEL_LEFT + 3 + i * ((PARALLEL_RIGHT - PARALLEL_LEFT - 3.6) / Math.max(count - 1, 1)));
        const half_length = 0.8;

        const top_rail = [{ points: [[PARALLEL_LEFT, 0.25], [PARALLEL_LEFT, LOOP_TOP], [branch_xs[0], LOOP_TOP]], current: state.parallel_total }];
        const bottom_rail = [];
        for (let i = 1; i < count; i++) {
            const remaining = state.parallel_currents.slice(i).reduce((sum, value) => sum + value, 0);
            top_rail.push({ points: [[branch_xs[i - 1], LOOP_TOP], [branch_xs[i], LOOP_TOP]], current: remaining });
            bottom_rail.push({ points: [[branch_xs[i], LOOP_BOTTOM], [branch_xs[i - 1], LOOP_BOTTOM]], current: remaining });
        }
        bottom_rail.push({ points: [[branch_xs[0], LOOP_BOTTOM], [PARALLEL_LEFT, LOOP_BOTTOM], [PARALLEL_LEFT, -0.25]], current: state.parallel_total });

        for (const segment of top_rail) {
            drawWire(transform, segment.points, potentialColor(parameters.voltage));
            drawDots(transform, segment.points, segment.current, reference_current, time_seconds);
        }
        for (const segment of bottom_rail) {
            drawWire(transform, segment.points, potentialColor(0));
            drawDots(transform, segment.points, segment.current, reference_current, time_seconds);
        }
        state.resistances.forEach((resistance, i) => {
            const top_lead = [[branch_xs[i], LOOP_TOP], [branch_xs[i], half_length]];
            const bottom_lead = [[branch_xs[i], -half_length], [branch_xs[i], LOOP_BOTTOM]];
            drawWire(transform, top_lead, potentialColor(parameters.voltage));
            drawWire(transform, bottom_lead, potentialColor(0));
            drawDots(transform, top_lead, state.parallel_currents[i], reference_current, time_seconds);
            drawDots(transform, bottom_lead, state.parallel_currents[i], reference_current, time_seconds);
            drawResistorBox(transform, branch_xs[i], 0, false, `R${["₁", "₂", "₃"][i]}`, resistance, [
                `I${["₁", "₂", "₃"][i]} = ${formatNumber(state.parallel_currents[i])} A`,
            ], ink);
        });
        drawBattery(transform, PARALLEL_LEFT, ink);

        context.save();
        context.fillStyle = ink;
        context.font = "bold 16px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(strings.parallel_title[current_language], transform.toScreenX((PARALLEL_LEFT + PARALLEL_RIGHT) / 2), transform.toScreenY(LOOP_TOP + 1.4));
        context.font = "12px system-ui, sans-serif";
        context.textBaseline = "top";
        context.fillText(
            strings.parallel_summary[current_language]
                .replace("{i}", formatNumber(state.parallel_total))
                .replace("{r}", formatNumber(state.parallel_resistance)),
            transform.toScreenX((PARALLEL_LEFT + PARALLEL_RIGHT) / 2),
            transform.toScreenY(LOOP_BOTTOM - 0.5),
        );
        context.restore();
    }

    /* drawScene: both circuits (normal mode) or the game overlay's stage */
    function drawScene(transform, time_seconds) {
        const ink = inkColor();
        const state = currentState();
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* Game mode hook — remove together with game.js (the game draws its own
           mystery circuit instead of the answer-revealing comparison) */
        if (!document.body.classList.contains("game-mode")) {
            draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
            const reference_current = Math.max(state.parallel_total, state.series_current, 1e-9);
            drawSeriesCircuit(transform, state, time_seconds, reference_current, ink);
            drawParallelCircuit(transform, state, time_seconds, reference_current, ink);
        }

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.series_parallel_game_overlay === "function") {
            globalThis.series_parallel_game_overlay(context, transform, { time_seconds });
        }
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(state) {
        const names = ["R₁", "R₂", "R₃"].slice(0, state.resistances.length);
        const cards = {
            req_series: {
                substitution: state.resistances.map(formatNumber).join(" + "),
                result: `${formatNumber(state.series_resistance)} Ω`,
            },
            i_series: {
                substitution: `${formatNumber(parameters.voltage)} / ${formatNumber(state.series_resistance)}`,
                result: `${formatNumber(state.series_current)} A`,
            },
            u_series: {
                substitution: state.series_voltages.map(formatNumber).join(" + "),
                result: `${formatNumber(state.series_voltages.reduce((sum, value) => sum + value, 0))} V = V ✓`,
            },
            req_parallel: {
                substitution: state.resistances.map((resistance) => `1/${formatNumber(resistance)}`).join(" + "),
                result: `${formatNumber(state.parallel_resistance)} Ω`,
            },
            u_parallel: {
                substitution: names.map((name) => `U(${name}) = V`).join(" ; "),
                result: `${formatNumber(parameters.voltage)} V`,
            },
            i_parallel: {
                substitution: state.parallel_currents.map(formatNumber).join(" + "),
                result: `${formatNumber(state.parallel_total)} A`,
            },
            compare: {
                substitution: `${formatNumber(state.series_resistance)} ≥ ${formatNumber(Math.max(...state.resistances))} ; ${formatNumber(state.parallel_resistance)} ≤ ${formatNumber(Math.min(...state.resistances))}`,
                result: "✓",
            },
            power: {
                substitution: `${formatNumber(parameters.voltage)} × ${formatNumber(state.series_current)} ; ${formatNumber(parameters.voltage)} × ${formatNumber(state.parallel_total)}`,
                result: `${formatNumber(calc.power(parameters.voltage, state.series_current))} W · ${formatNumber(calc.power(parameters.voltage, state.parallel_total))} W`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: R_eq, total current and total power versus R₂ for both layouts */
    function drawGraphs() {
        const req_series_points = [];
        const req_parallel_points = [];
        const current_series_points = [];
        const current_parallel_points = [];
        const power_series_points = [];
        const power_parallel_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const r2 = 1 + (99 * i) / GRAPH_SAMPLES;
            const resistances = parameters.r3_enabled
                ? [parameters.r1, r2, parameters.r3]
                : [parameters.r1, r2];
            const series_resistance = calc.seriesResistance(resistances);
            const parallel_resistance = calc.parallelResistance(resistances);
            const series_current = calc.currentFromVoltage(parameters.voltage, series_resistance);
            const parallel_current = calc.currentFromVoltage(parameters.voltage, parallel_resistance);
            req_series_points.push([r2, series_resistance]);
            req_parallel_points.push([r2, parallel_resistance]);
            current_series_points.push([r2, series_current]);
            current_parallel_points.push([r2, parallel_current]);
            power_series_points.push([r2, calc.power(parameters.voltage, series_current)]);
            power_parallel_points.push([r2, calc.power(parameters.voltage, parallel_current)]);
        }
        const options = { cursor_time: parameters.r2, x_label: "R₂ (Ω)" };
        const series_label = current_language === "fr" ? "série" : "series";
        const parallel_label = current_language === "fr" ? "parallèle" : "parallel";
        graph.drawTimeGraph(document.getElementById("graph_resistance"), [
            { label: series_label, color: "#d32f2f", points: req_series_points },
            { label: parallel_label, color: "#1976d2", points: req_parallel_points },
        ], { ...options, unit: "Ω" });
        graph.drawTimeGraph(document.getElementById("graph_current"), [
            { label: series_label, color: "#d32f2f", points: current_series_points },
            { label: parallel_label, color: "#1976d2", points: current_parallel_points },
        ], { ...options, unit: "A" });
        graph.drawTimeGraph(document.getElementById("graph_power"), [
            { label: series_label, color: "#d32f2f", points: power_series_points },
            { label: parallel_label, color: "#1976d2", points: power_parallel_points },
        ], { ...options, unit: "W" });
    }

    /* render: draw the scene, formulas and graphs (steady-state exercise) */
    function render(time_seconds) {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const state = drawScene(camera.transform(), time_seconds);
        updateFormulas(state);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs();
        }
    }

    /* animationFrame: continuous redraw (current dots, camera, game effects) */
    function animationFrame(timestamp) {
        render(timestamp / 1000);
        requestAnimationFrame(animationFrame);
    }

    /* buildControls: slider + number pair per parameter, checkbox for toggles */
    function buildControls() {
        const container = document.getElementById("parameter_rows");
        for (const config of parameter_config) {
            const row = document.createElement("div");
            row.className = "parameter-row";
            row.id = `row_${config.key}`;
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
                    setThirdResistorEnabled(checkbox.checked);
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
        setThirdResistorEnabled(parameters.r3_enabled);
    }

    /* setThirdResistorEnabled: gray out the R3 inputs while it is absent */
    function setThirdResistorEnabled(enabled) {
        for (const id of ["slider_r3", "number_r3"]) {
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
        document.getElementById("zoom_fit_button").title = strings.zoom_fit_hint[language];
        document.getElementById("language_toggle").textContent = language === "fr" ? "EN" : "FR";
    }

    /* init: build controls, bind camera and language, start the render loop */
    function init() {
        buildControls();
        camera.bind({
            zoom_in_id: "zoom_in_button",
            zoom_out_id: "zoom_out_button",
            zoom_fit_id: "zoom_fit_button",
            onFit: fitView,
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
