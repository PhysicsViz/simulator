/*
 * main.js — Simple-circuit page logic: a classic circuit diagram — real
 * battery (EMF symbol + internal resistance r inside a dashed enclosure),
 * needle ammeter in series, switch, lamp as the load R with a glow
 * proportional to its power, needle voltmeter across the terminals — with
 * wires colored by electric potential (the internal drop r·I is visible as
 * the terminal color fades below E) and golden current dots at a speed
 * proportional to I. Everything reacts live to the sliders: E, r, R and the
 * switch. Formulas for Pouillet's law, the terminal voltage, the three
 * powers, the efficiency, the impedance-matching maximum E²/(4r) at R = r
 * and the short/open-circuit extremes; profile graphs of I(R), U(R) and the
 * powers versus R with the P_R peak at R = r. Steady-state DC: no transport
 * panel, continuous redraw only.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.simple_circuit_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Circuit simple (pile réelle)", en: "Simple circuit (real battery)" },
        assumption: {
            fr: "Hypothèses : pile réelle = f.é.m. E en série avec sa résistance interne r (cadre pointillé) ; fils et appareils de mesure idéaux (ampèremètre de résistance nulle, voltmètre de résistance infinie) ; la charge R est ohmique (la « lampe » éclaire proportionnellement à sa puissance) ; régime permanent (courant continu établi, pas d'évolution temporelle). Loi de Pouillet : I = E/(r + R) ; tension aux bornes U = E − r·I = R·I. Couleur des fils = potentiel électrique (rouge = E, bleu = 0) : la chute interne r·I se voit à la sortie de la pile. Les points dorés indiquent le sens conventionnel du courant, à une vitesse proportionnelle à I.",
            en: "Assumptions: real battery = EMF E in series with its internal resistance r (dashed frame); ideal wires and meters (zero-resistance ammeter, infinite-resistance voltmeter); the load R is ohmic (the \"lamp\" glows in proportion to its power); steady state (established DC, no time evolution). Pouillet's law: I = E/(r + R); terminal voltage U = E − r·I = R·I. Wire color = electric potential (red = E, blue = 0): the internal drop r·I is visible at the battery output. The golden dots show the conventional current direction, at a speed proportional to I.",
        },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Profils en fonction de R", en: "Profiles versus R" },
        graph_current: { fr: "Courant I (A)", en: "Current I (A)" },
        graph_voltage: { fr: "Tensions (V)", en: "Voltages (V)" },
        graph_power: { fr: "Puissances (W) — maximum de P_R en R = r", en: "Powers (W) — P_R peaks at R = r" },
        zoom_fit_hint: { fr: "Ajuster la vue au circuit", en: "Fit view to the circuit" },
        emf: { fr: "Force électromotrice E", en: "Electromotive force E" },
        internal_resistance: { fr: "Résistance interne r", en: "Internal resistance r" },
        load_resistance: { fr: "Résistance de charge R", en: "Load resistance R" },
        switch_closed: { fr: "Interrupteur fermé", en: "Switch closed" },
        legend_high: { fr: "Potentiel élevé", en: "High potential" },
        legend_low: { fr: "Potentiel 0 (borne −)", en: "Potential 0 (− terminal)" },
        legend_dots: { fr: "Courant conventionnel (vitesse ∝ I)", en: "Conventional current (speed ∝ I)" },
        battery_label: { fr: "pile réelle (E, r)", en: "real battery (E, r)" },
        open_label: { fr: "circuit ouvert : I = 0", en: "open circuit: I = 0" },
        formula_current: { fr: "Loi de Pouillet", en: "Pouillet's law" },
        formula_voltage: { fr: "Tension aux bornes", en: "Terminal voltage" },
        formula_load_power: { fr: "Puissance reçue par R", en: "Power received by R" },
        formula_balance: { fr: "Bilan de puissance", en: "Power budget" },
        formula_efficiency: { fr: "Rendement", en: "Efficiency" },
        formula_matching: { fr: "Puissance maximale (R = r)", en: "Maximum power (R = r)" },
        formula_short: { fr: "Court-circuit (R = 0)", en: "Short circuit (R = 0)" },
        formula_open: { fr: "Circuit ouvert (I = 0)", en: "Open circuit (I = 0)" },
        formula_measure: { fr: "Retrouver r depuis la mesure (R, P)", en: "Recovering r from the measured (R, P)" },
        formula_target: { fr: "R pour une puissance visée P*", en: "R for a target power P*" },
        target_power: { fr: "Puissance visée P* (question)", en: "Target power P* (question)" },
        target_impossible: { fr: "impossible : P* > P_max", en: "impossible: P* > P_max" },
    };

    const parameter_config = [
        { key: "emf", min: 1, max: 24, step: 0.1, unit: "V" },
        { key: "internal_resistance", min: 0.05, max: 10, step: 0.01, unit: "Ω" },
        { key: "load_resistance", min: 0.1, max: 50, step: 0.1, unit: "Ω" },
        { key: "switch_closed", type: "toggle" },
        { key: "target_power", min: 1, max: 200, step: 1, unit: "W" },
    ];
    const parameters = {
        emf: 16,
        internal_resistance: 0.53,
        load_resistance: 4,
        switch_closed: true,
        target_power: 100,
    };

    const GRAPH_SAMPLES = 120;
    const HIGH_COLOR = [211, 47, 47];
    const LOW_COLOR = [25, 118, 210];
    const DOT_COLOR = "#fbc02d";
    const DOT_SPACING = 26;
    const LOOP_LEFT = -6;
    const LOOP_RIGHT = 6;
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

    /* currentState: every live electrical quantity */
    function currentState() {
        const circuit_current = parameters.switch_closed
            ? calc.current(parameters.emf, parameters.internal_resistance, parameters.load_resistance)
            : 0;
        return {
            current: circuit_current,
            voltage: calc.terminalVoltage(parameters.emf, parameters.internal_resistance, circuit_current),
            load_power: calc.loadPower(parameters.load_resistance, circuit_current),
            internal_power: calc.internalPower(parameters.internal_resistance, circuit_current),
            total_power: calc.totalPower(parameters.emf, circuit_current),
            efficiency: calc.efficiency(parameters.load_resistance, parameters.internal_resistance),
            max_power: calc.maxLoadPower(parameters.emf, parameters.internal_resistance),
            short_current: calc.shortCircuitCurrent(parameters.emf, parameters.internal_resistance),
        };
    }

    /* potentialColor: blue (0) → red (E) interpolation */
    function potentialColor(potential) {
        const ratio = Math.min(Math.max(potential / Math.max(parameters.emf, 1e-9), 0), 1);
        const mix = LOW_COLOR.map((low, i) => Math.round(low + (HIGH_COLOR[i] - low) * ratio));
        return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the circuit and the voltmeter */
    function fitView() {
        camera.fitTo({ left: -8.2, right: 10.4, bottom: -4.6, top: 4.8 });
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

    /* drawDots: golden current dots along a world polyline, speed ∝ I */
    function drawDots(transform, points, circuit_current, reference_current, time_seconds) {
        if (circuit_current <= 0) {
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
        const speed = 14 + 110 * circuit_current / reference_current;
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

    /* drawBattery: dashed real-battery enclosure with the EMF symbol and r box */
    function drawBattery(transform, terminal_potential, ink) {
        const x = transform.toScreenX(LOOP_LEFT);
        const long_half = Math.abs(transform.toScreenX(0.6) - transform.toScreenX(0));
        const short_half = long_half * 0.45;
        const plus_y = transform.toScreenY(-0.1);
        const minus_y = transform.toScreenY(-0.7);

        context.save();
        context.setLineDash([6, 5]);
        context.strokeStyle = "rgba(120, 130, 145, 0.7)";
        context.lineWidth = 1.5;
        context.strokeRect(
            transform.toScreenX(LOOP_LEFT - 1.3),
            transform.toScreenY(2.2),
            transform.toScreenX(LOOP_LEFT + 1.3) - transform.toScreenX(LOOP_LEFT - 1.3),
            transform.toScreenY(-1.5) - transform.toScreenY(2.2),
        );
        context.setLineDash([]);
        context.fillStyle = "rgba(120, 130, 145, 1)";
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            strings.battery_label[current_language],
            transform.toScreenX(LOOP_LEFT),
            transform.toScreenY(-1.5) + 5,
        );

        context.strokeStyle = ink;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x - long_half, plus_y);
        context.lineTo(x + long_half, plus_y);
        context.stroke();
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x - short_half, minus_y);
        context.lineTo(x + short_half, minus_y);
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(`E = ${formatNumber(parameters.emf)} V`, x + long_half + 8, (plus_y + minus_y) / 2);

        const box_top = transform.toScreenY(1.6);
        const box_bottom = transform.toScreenY(0.6);
        const box_half = Math.abs(transform.toScreenX(0.45) - transform.toScreenX(0));
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches
            ? "rgba(22, 27, 34, 0.95)"
            : "rgba(255, 255, 255, 0.95)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(x - box_half, box_top, 2 * box_half, box_bottom - box_top, 4);
        context.fill();
        context.stroke();
        context.font = "bold 11px system-ui, sans-serif";
        context.fillStyle = ink;
        context.textAlign = "center";
        context.fillText(`r = ${formatNumber(parameters.internal_resistance)} Ω`, x, (box_top + box_bottom) / 2);
        context.restore();
    }

    /* drawMeter: needle instrument (A or V) with its digital reading */
    function drawMeter(transform, world_x, world_y, letter, fraction, reading_text, ink) {
        const x = transform.toScreenX(world_x);
        const y = transform.toScreenY(world_y);
        const radius = Math.abs(transform.toScreenX(0.62) - transform.toScreenX(0));
        context.save();
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches
            ? "rgba(22, 27, 34, 0.96)"
            : "rgba(255, 255, 255, 0.96)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();

        const start_angle = -Math.PI * 0.78;
        const end_angle = -Math.PI * 0.22;
        context.strokeStyle = "rgba(120, 130, 145, 0.6)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(x, y, radius * 0.72, start_angle, end_angle);
        context.stroke();
        const needle_angle = start_angle + Math.min(Math.max(fraction, 0), 1) * (end_angle - start_angle);
        context.strokeStyle = "#d32f2f";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + radius * 0.7 * Math.cos(needle_angle), y + radius * 0.7 * Math.sin(needle_angle));
        context.stroke();

        context.fillStyle = ink;
        context.font = `bold ${Math.max(radius * 0.42, 10)}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(letter, x, y + radius * 0.18);
        context.font = "bold 12px system-ui, sans-serif";
        context.textBaseline = "top";
        context.fillText(reading_text, x, y + radius + 6);
        context.restore();
    }

    /* drawSwitch: pivoting blade at the top wire, open or closed */
    function drawSwitch(transform, ink) {
        const pivot_x = transform.toScreenX(1.2);
        const end_x = transform.toScreenX(2.6);
        const wire_y = transform.toScreenY(LOOP_TOP);
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(pivot_x, wire_y);
        if (parameters.switch_closed) {
            context.lineTo(end_x, wire_y);
        } else {
            context.lineTo(
                pivot_x + (end_x - pivot_x) * Math.cos(0.5),
                wire_y - (end_x - pivot_x) * Math.sin(0.5),
            );
        }
        context.stroke();
        context.fillStyle = ink;
        for (const contact_x of [pivot_x, end_x]) {
            context.beginPath();
            context.arc(contact_x, wire_y, 4, 0, 2 * Math.PI);
            context.fill();
        }
        if (!parameters.switch_closed) {
            context.fillStyle = "#d32f2f";
            context.font = "bold 12px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "bottom";
            context.fillText(strings.open_label[current_language], (pivot_x + end_x) / 2, wire_y - 22);
        }
        context.restore();
    }

    /* drawLamp: the load as a bulb whose glow follows its power */
    function drawLamp(transform, state, ink) {
        const x = transform.toScreenX(LOOP_RIGHT);
        const y = transform.toScreenY(0);
        const radius = Math.abs(transform.toScreenX(0.7) - transform.toScreenX(0));
        const glow_fraction = state.max_power > 0 ? Math.sqrt(state.load_power / state.max_power) : 0;
        if (glow_fraction > 0.02) {
            const halo = radius * (0.4 + 1.6 * glow_fraction);
            const gradient = context.createRadialGradient(x, y, radius * 0.3, x, y, radius + halo);
            gradient.addColorStop(0, "rgba(255, 214, 64, 0.9)");
            gradient.addColorStop(1, "rgba(255, 214, 64, 0)");
            context.save();
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(x, y, radius + halo, 0, 2 * Math.PI);
            context.fill();
            context.restore();
        }
        context.save();
        context.fillStyle = glow_fraction > 0.02 ? "rgba(255, 230, 140, 0.9)" : "rgba(120, 130, 145, 0.15)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        const cross = radius * 0.7071;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(x - cross, y - cross);
        context.lineTo(x + cross, y + cross);
        context.moveTo(x - cross, y + cross);
        context.lineTo(x + cross, y - cross);
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`R = ${formatNumber(parameters.load_resistance)} Ω`, x, y + radius + 8);
        context.fillStyle = "#b8860b";
        context.fillText(`P = ${formatNumber(state.load_power)} W`, x, y + radius + 24);
        context.restore();
    }

    /* drawScene: the full circuit; returns the live quantities */
    function drawScene(transform, time_seconds) {
        const ink = inkColor();
        const state = currentState();
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* Game mode hook — remove together with game.js (the profile graphs and
           power cards are hidden by CSS; the scene itself stays, it is the
           instrument panel the player reads) */
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const top_potential = parameters.switch_closed ? state.voltage : parameters.emf;
        const reference_current = Math.max(state.short_current, 1e-9);
        const supply_wire = [[LOOP_LEFT, 1.6], [LOOP_LEFT, LOOP_TOP], [1.2, LOOP_TOP]];
        const load_wire = [[2.6, LOOP_TOP], [LOOP_RIGHT, LOOP_TOP], [LOOP_RIGHT, 0.7]];
        const return_wire = [[LOOP_RIGHT, -0.7], [LOOP_RIGHT, LOOP_BOTTOM], [LOOP_LEFT, LOOP_BOTTOM], [LOOP_LEFT, -0.7]];
        const emf_to_internal = [[LOOP_LEFT, -0.1], [LOOP_LEFT, 0.6]];

        drawWire(transform, supply_wire, potentialColor(top_potential));
        drawWire(transform, load_wire, potentialColor(parameters.switch_closed ? state.voltage : 0));
        drawWire(transform, return_wire, potentialColor(0));
        drawWire(transform, emf_to_internal, potentialColor(parameters.emf));
        for (const path of [supply_wire, load_wire, return_wire]) {
            drawDots(transform, path, state.current, reference_current, time_seconds);
        }

        drawBattery(transform, state.voltage, ink);
        drawSwitch(transform, ink);
        drawLamp(transform, state, ink);
        drawMeter(
            transform, -2.5, LOOP_TOP, "A",
            state.current / reference_current,
            `I = ${formatNumber(state.current)} A`,
            ink,
        );
        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.7)";
        context.lineWidth = 1.5;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(transform.toScreenX(LOOP_RIGHT), transform.toScreenY(0.7));
        context.lineTo(transform.toScreenX(8.6), transform.toScreenY(0.62));
        context.moveTo(transform.toScreenX(LOOP_RIGHT), transform.toScreenY(-0.7));
        context.lineTo(transform.toScreenX(8.6), transform.toScreenY(-0.62));
        context.stroke();
        context.restore();
        drawMeter(
            transform, 8.6, 0, "V",
            (parameters.switch_closed ? state.voltage : parameters.emf) / Math.max(parameters.emf, 1e-9),
            `U = ${formatNumber(parameters.switch_closed ? state.voltage : parameters.emf)} V`,
            ink,
        );

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.simple_circuit_game_overlay === "function") {
            globalThis.simple_circuit_game_overlay(context, transform, {
                load_power: state.load_power,
                switch_closed: parameters.switch_closed,
                load_resistance: parameters.load_resistance,
            });
        }
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(state) {
        const cards = {
            current: {
                substitution: `${formatNumber(parameters.emf)} / (${formatNumber(parameters.internal_resistance)} + ${formatNumber(parameters.load_resistance)})`,
                result: `${formatNumber(parameters.switch_closed ? state.current : 0)} A`,
            },
            voltage: {
                substitution: `${formatNumber(parameters.emf)} − ${formatNumber(parameters.internal_resistance)} × ${formatNumber(state.current)}`,
                result: `${formatNumber(state.voltage)} V`,
            },
            load_power: {
                substitution: `${formatNumber(parameters.load_resistance)} × ${formatNumber(state.current)}² = ${formatNumber(state.voltage)} × ${formatNumber(state.current)}`,
                result: `${formatNumber(state.load_power)} W`,
            },
            balance: {
                substitution: `${formatNumber(state.load_power)} + ${formatNumber(state.internal_power)}`,
                result: `${formatNumber(state.total_power)} W = E·I ✓`,
            },
            efficiency: {
                substitution: `${formatNumber(parameters.load_resistance)} / (${formatNumber(parameters.load_resistance)} + ${formatNumber(parameters.internal_resistance)})`,
                result: `${formatNumber(state.efficiency * 100)} %`,
            },
            matching: {
                substitution: `${formatNumber(parameters.emf)}² / (4 × ${formatNumber(parameters.internal_resistance)})`,
                result: `${formatNumber(state.max_power)} W`,
            },
            short: {
                substitution: `${formatNumber(parameters.emf)} / ${formatNumber(parameters.internal_resistance)}`,
                result: `${formatNumber(state.short_current)} A`,
            },
            open: {
                substitution: `I = 0 ⇒ U = E`,
                result: `${formatNumber(parameters.emf)} V`,
            },
            measure: {
                substitution: `${formatNumber(parameters.emf)} × √(${formatNumber(parameters.load_resistance)} / ${formatNumber(state.load_power)}) − ${formatNumber(parameters.load_resistance)}`,
                result: state.load_power > 1e-9
                    ? `${formatNumber(calc.internalFromPower(parameters.emf, parameters.load_resistance, state.load_power))} Ω = r ✓`
                    : "—",
            },
            target: {
                substitution: `${formatNumber(parameters.target_power)} = ${formatNumber(parameters.emf)}²·R / (R + ${formatNumber(parameters.internal_resistance)})²`,
                result: (() => {
                    const roots = calc.loadForPower(parameters.emf, parameters.internal_resistance, parameters.target_power);
                    return roots === null
                        ? strings.target_impossible[current_language]
                        : `R = ${formatNumber(roots.low)} Ω ${current_language === "fr" ? "ou" : "or"} ${formatNumber(roots.high)} Ω`;
                })(),
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: I(R), U(R) and the three powers versus R with live cursor */
    function drawGraphs() {
        const current_points = [];
        const voltage_points = [];
        const emf_points = [];
        const load_power_points = [];
        const internal_power_points = [];
        const total_power_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const load = 0.1 + (49.9 * i) / GRAPH_SAMPLES;
            const circuit_current = calc.current(parameters.emf, parameters.internal_resistance, load);
            current_points.push([load, circuit_current]);
            voltage_points.push([load, calc.terminalVoltage(parameters.emf, parameters.internal_resistance, circuit_current)]);
            emf_points.push([load, parameters.emf]);
            load_power_points.push([load, calc.loadPower(load, circuit_current)]);
            internal_power_points.push([load, calc.internalPower(parameters.internal_resistance, circuit_current)]);
            total_power_points.push([load, calc.totalPower(parameters.emf, circuit_current)]);
        }
        const target_points = [[0.1, parameters.target_power], [50, parameters.target_power]];
        const options = { cursor_time: parameters.load_resistance, x_label: "R (Ω)" };
        graph.drawTimeGraph(document.getElementById("graph_current"), [
            { label: "I", color: "#1976d2", points: current_points },
        ], { ...options, unit: "A" });
        graph.drawTimeGraph(document.getElementById("graph_voltage"), [
            { label: "U", color: "#d32f2f", points: voltage_points },
            { label: "E", color: "#8e24aa", points: emf_points },
        ], { ...options, unit: "V" });
        graph.drawTimeGraph(document.getElementById("graph_power"), [
            { label: "P_R", color: "#43a047", points: load_power_points },
            { label: "P_r", color: "#e8722c", points: internal_power_points },
            { label: "P_tot", color: "#8e24aa", points: total_power_points },
            { label: "P*", color: "#b8860b", points: target_points },
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

    /* animationFrame: continuous redraw (current dots, glow, game effects) */
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
