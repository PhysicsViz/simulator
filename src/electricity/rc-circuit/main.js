/*
 * main.js — RC-circuit page logic: classic diagram with the battery, a
 * two-position switch (charge through E / discharge without it), the resistor,
 * needle ammeter and the capacitor whose plates fill with ± symbols as q
 * grows, plus a needle voltmeter across it; wires colored by potential (the
 * u_R drop shrinks as i dies out) and golden current dots whose speed decays
 * exponentially — reversing direction on discharge. Transport controls over
 * five time constants; parameters E, R (kΩ), C (µF) and the mode toggle;
 * formulas for τ = R·C, the exponentials u_C(t) and i(t), q = C·u, the 63/37 %
 * rule at t = τ, the 5τ rule, the mesh law, the stored energy and the famous
 * half-energy law (whatever R, half the supplied energy heats the resistor);
 * graphs of u_C, i and the three energies.
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.rc_circuit_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Circuit RC : charge et décharge", en: "RC circuit: charging and discharging" },
        assumption: {
            fr: "Hypothèses : pile idéale (pas de résistance interne), fils et appareils de mesure idéaux, condensateur parfait. Commutateur à deux positions : en CHARGE la pile alimente R et C en série (condensateur initialement vide, u_C(0) = 0) ; en DÉCHARGE la pile est retirée du circuit et le condensateur (initialement chargé à E) se vide dans R — le courant change de sens. Loi des mailles E = R·i + u_C avec i = C·du_C/dt : solutions exponentielles exactes de constante de temps τ = R·C (des ohms × des farads = des secondes !). La simulation couvre 5τ (régime établi à 99,3 %).",
            en: "Assumptions: ideal battery (no internal resistance), ideal wires and meters, perfect capacitor. Two-position switch: in CHARGE mode the battery feeds R and C in series (capacitor initially empty, u_C(0) = 0); in DISCHARGE mode the battery is removed and the capacitor (initially charged to E) empties through R — the current reverses. Mesh law E = R·i + u_C with i = C·du_C/dt: exact exponential solutions with time constant τ = R·C (ohms × farads = seconds!). The run covers 5τ (99.3 % settled).",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_voltage: { fr: "Tension du condensateur u_C (V)", en: "Capacitor voltage u_C (V)" },
        graph_current: { fr: "Courant i (mA)", en: "Current i (mA)" },
        graph_energy: { fr: "Énergies (J) — la moitié part en chaleur !", en: "Energies (J) — half goes to heat!" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−τ/10", en: "−τ/10" },
        step_forward: { fr: "+τ/10", en: "+τ/10" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au circuit", en: "Fit view to the circuit" },
        emf: { fr: "Tension de la pile E", en: "Battery voltage E" },
        resistance_kilohms: { fr: "Résistance R", en: "Resistance R" },
        capacitance_microfarads: { fr: "Capacité C", en: "Capacitance C" },
        discharge_mode: { fr: "Mode décharge (pile retirée, u_C(0) = E)", en: "Discharge mode (battery removed, u_C(0) = E)" },
        legend_high: { fr: "Potentiel élevé", en: "High potential" },
        legend_low: { fr: "Potentiel 0", en: "Potential 0" },
        legend_dots: { fr: "Courant (vitesse ∝ i, sens réel)", en: "Current (speed ∝ i, actual direction)" },
        formula_tau: { fr: "Constante de temps", en: "Time constant" },
        formula_voltage: { fr: "Tension du condensateur", en: "Capacitor voltage" },
        formula_current: { fr: "Courant", en: "Current" },
        formula_charge: { fr: "Charge du condensateur", en: "Capacitor charge" },
        formula_at_tau: { fr: "À t = τ : la règle 63 % / 37 %", en: "At t = τ: the 63 % / 37 % rule" },
        formula_five_tau: { fr: "À t = 5·τ : régime établi", en: "At t = 5·τ: settled regime" },
        formula_mesh: { fr: "Loi des mailles", en: "Mesh law" },
        formula_stored: { fr: "Énergie stockée", en: "Stored energy" },
        formula_half: { fr: "La loi des 50 % (indépendante de R !)", en: "The 50 % law (independent of R!)" },
        math_charge_voltage: { fr: "u_C(t) = E·(1 − e^(−t/τ))", en: "u_C(t) = E·(1 − e^(−t/τ))" },
        math_discharge_voltage: { fr: "u_C(t) = E·e^(−t/τ)", en: "u_C(t) = E·e^(−t/τ)" },
        math_charge_mesh: { fr: "E = u_R + u_C", en: "E = u_R + u_C" },
        math_discharge_mesh: { fr: "u_C = −R·i = u_R", en: "u_C = −R·i = u_R" },
        half_text: {
            fr: "énergie fournie C·E² → stockée ½·C·E² + dissipée ½·C·E²",
            en: "supplied energy C·E² → stored ½·C·E² + dissipated ½·C·E²",
        },
    };

    const parameter_config = [
        { key: "emf", min: 1, max: 24, step: 0.1, unit: "V" },
        { key: "resistance_kilohms", min: 0.1, max: 100, step: 0.1, unit: "kΩ" },
        { key: "capacitance_microfarads", min: 1, max: 1000, step: 1, unit: "µF" },
        { key: "discharge_mode", type: "toggle" },
    ];
    const parameters = {
        emf: 9,
        resistance_kilohms: 10,
        capacitance_microfarads: 100,
        discharge_mode: false,
    };

    const WINDOW_TAUS = 5;
    const HIGH_COLOR = [211, 47, 47];
    const LOW_COLOR = [25, 118, 210];
    const DOT_COLOR = "#fbc02d";
    const DOT_SPACING = 26;
    const LOOP_LEFT = -6;
    const LOOP_RIGHT = 6;
    const LOOP_TOP = 3;
    const LOOP_BOTTOM = -3;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const GRAPH_SAMPLES = 150;

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
    let dot_clock = 0;

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* SI conversions from the slider units */
    function resistanceOhms() {
        return parameters.resistance_kilohms * 1000;
    }
    function capacitanceFarads() {
        return parameters.capacitance_microfarads * 1e-6;
    }
    function timeConstant() {
        return calc.timeConstant(resistanceOhms(), capacitanceFarads());
    }
    function totalTime() {
        return WINDOW_TAUS * timeConstant();
    }

    /* currentState: exact u_C, i, q and the three energies at a time */
    function currentState(time) {
        const tau = timeConstant();
        const voltage = parameters.discharge_mode
            ? calc.dischargeVoltage(parameters.emf, tau, time)
            : calc.chargeVoltage(parameters.emf, tau, time);
        const current = parameters.discharge_mode
            ? calc.dischargeCurrent(parameters.emf, resistanceOhms(), tau, time)
            : calc.chargeCurrent(parameters.emf, resistanceOhms(), tau, time);
        return {
            voltage,
            current,
            charge: calc.capacitorCharge(capacitanceFarads(), voltage),
            stored: calc.storedEnergy(capacitanceFarads(), voltage),
            supplied: parameters.discharge_mode ? 0 : calc.suppliedEnergy(parameters.emf, capacitanceFarads(), voltage),
            dissipated: calc.dissipatedEnergy(parameters.emf, capacitanceFarads(), voltage, parameters.discharge_mode),
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

    /* drawDots: golden current dots along a world polyline, speed ∝ |i| */
    function drawDots(transform, points, magnitude, reference, reversed) {
        if (magnitude <= 1e-12) {
            return;
        }
        const oriented = reversed ? [...points].reverse() : points;
        const screen_points = oriented.map(([x, y]) => [transform.toScreenX(x), transform.toScreenY(y)]);
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
        const speed = 14 + 110 * magnitude / reference;
        const offset = (dot_clock * speed) % DOT_SPACING;
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

    /* drawBattery: battery symbol on the left branch (grayed out in discharge) */
    function drawBattery(transform, ink) {
        const x = transform.toScreenX(LOOP_LEFT);
        const long_half = Math.abs(transform.toScreenX(0.6) - transform.toScreenX(0));
        const short_half = long_half * 0.45;
        const plus_y = transform.toScreenY(0.25);
        const minus_y = transform.toScreenY(-0.25);
        const color = parameters.discharge_mode ? "rgba(120, 130, 145, 0.45)" : ink;
        context.save();
        context.strokeStyle = color;
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
        context.fillStyle = color;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(`E = ${formatNumber(parameters.emf)} V`, x + long_half + 8, (plus_y + minus_y) / 2);
        context.restore();
    }

    /* drawSwitch: two-position blade at the top-left corner */
    function drawSwitch(transform, ink) {
        const pivot = [transform.toScreenX(-3.4), transform.toScreenY(LOOP_TOP)];
        const battery_contact = [transform.toScreenX(-4.6), transform.toScreenY(LOOP_TOP)];
        const bypass_contact = [transform.toScreenX(-4.6), transform.toScreenY(LOOP_TOP - 1)];
        const target = parameters.discharge_mode ? bypass_contact : battery_contact;
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(pivot[0], pivot[1]);
        context.lineTo(target[0], target[1]);
        context.stroke();
        context.fillStyle = ink;
        for (const [cx, cy] of [pivot, battery_contact, bypass_contact]) {
            context.beginPath();
            context.arc(cx, cy, 4, 0, 2 * Math.PI);
            context.fill();
        }
        context.restore();
    }

    /* drawResistor: labeled box on the top wire */
    function drawResistor(transform, ink) {
        const left = transform.toScreenX(-1.3);
        const right = transform.toScreenX(1.3);
        const top = transform.toScreenY(LOOP_TOP + 0.45);
        const bottom = transform.toScreenY(LOOP_TOP - 0.45);
        context.save();
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches
            ? "rgba(22, 27, 34, 0.95)"
            : "rgba(255, 255, 255, 0.95)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(left, top, right - left, bottom - top, 4);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`R = ${formatNumber(parameters.resistance_kilohms)} kΩ`, (left + right) / 2, (top + bottom) / 2);
        context.restore();
    }

    /* drawCapacitor: two plates whose ± symbols follow the stored charge */
    function drawCapacitor(transform, state, ink) {
        const x = transform.toScreenX(LOOP_RIGHT);
        const half_width = Math.abs(transform.toScreenX(1) - transform.toScreenX(0));
        const top_plate_y = transform.toScreenY(0.3);
        const bottom_plate_y = transform.toScreenY(-0.3);
        const fill_ratio = state.voltage / Math.max(parameters.emf, 1e-9);
        const symbol_count = Math.round(fill_ratio * 6);
        context.save();
        context.strokeStyle = potentialColor(state.voltage);
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(x - half_width, top_plate_y);
        context.lineTo(x + half_width, top_plate_y);
        context.stroke();
        context.strokeStyle = potentialColor(0);
        context.beginPath();
        context.moveTo(x - half_width, bottom_plate_y);
        context.lineTo(x + half_width, bottom_plate_y);
        context.stroke();
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        for (let i = 0; i < symbol_count; i++) {
            const symbol_x = x - half_width + (i + 0.5) * (2 * half_width / 6);
            context.fillStyle = "#d32f2f";
            context.textBaseline = "bottom";
            context.fillText("+", symbol_x, top_plate_y - 3);
            context.fillStyle = "#1976d2";
            context.textBaseline = "top";
            context.fillText("−", symbol_x, bottom_plate_y + 4);
        }
        context.fillStyle = ink;
        context.textBaseline = "top";
        context.fillText(
            `C = ${formatNumber(parameters.capacitance_microfarads)} µF · q = ${formatNumber(state.charge * 1000)} mC`,
            x,
            bottom_plate_y + 22,
        );
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
        context.fillText(reading_text, x, y + radius + 6);
        context.restore();
    }

    /* drawScene: the full RC circuit; returns the live quantities */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = currentState(time);
        const reference_current = parameters.emf / resistanceOhms();
        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const source_potential = parameters.discharge_mode ? state.voltage : parameters.emf;
        const battery_top = [[LOOP_LEFT, 0.25], [LOOP_LEFT, LOOP_TOP], [-4.6, LOOP_TOP]];
        const bypass = [[LOOP_LEFT + 0.6, LOOP_TOP - 1], [-4.6, LOOP_TOP - 1]];
        const supply_wire = [[-3.4, LOOP_TOP], [-1.3, LOOP_TOP]];
        const after_resistor = [[1.3, LOOP_TOP], [LOOP_RIGHT, LOOP_TOP], [LOOP_RIGHT, 0.3]];
        const return_wire = [[LOOP_RIGHT, -0.3], [LOOP_RIGHT, LOOP_BOTTOM], [LOOP_LEFT, LOOP_BOTTOM], [LOOP_LEFT, -0.25]];

        drawWire(transform, battery_top, potentialColor(parameters.discharge_mode ? 0 : parameters.emf));
        if (parameters.discharge_mode) {
            drawWire(transform, [[LOOP_LEFT, LOOP_BOTTOM], [LOOP_LEFT + 0.6, LOOP_BOTTOM], [LOOP_LEFT + 0.6, LOOP_TOP - 1]], potentialColor(0));
            drawWire(transform, bypass, potentialColor(0));
        }
        drawWire(transform, supply_wire, potentialColor(source_potential));
        drawWire(transform, after_resistor, potentialColor(state.voltage));
        drawWire(transform, return_wire, potentialColor(0));
        for (const path of [supply_wire, after_resistor, return_wire]) {
            drawDots(transform, path, Math.abs(state.current), reference_current, state.current < 0);
        }

        drawBattery(transform, ink);
        drawSwitch(transform, ink);
        drawResistor(transform, ink);
        drawCapacitor(transform, state, ink);
        drawMeter(
            transform, 3.2, LOOP_TOP, "A",
            Math.abs(state.current) / Math.max(reference_current, 1e-12),
            `i = ${formatNumber(state.current * 1000)} mA`,
            ink,
        );
        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.7)";
        context.lineWidth = 1.5;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(transform.toScreenX(LOOP_RIGHT), transform.toScreenY(0.3));
        context.lineTo(transform.toScreenX(8.6), transform.toScreenY(0.62));
        context.moveTo(transform.toScreenX(LOOP_RIGHT), transform.toScreenY(-0.3));
        context.lineTo(transform.toScreenX(8.6), transform.toScreenY(-0.62));
        context.stroke();
        context.restore();
        drawMeter(
            transform, 8.6, 0, "V",
            state.voltage / Math.max(parameters.emf, 1e-9),
            `u_C = ${formatNumber(state.voltage)} V`,
            ink,
        );

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.rc_circuit_game_overlay === "function") {
            globalThis.rc_circuit_game_overlay(context, transform, {
                time,
                total_time: Math.max(totalTime(), 1e-9),
                voltage: state.voltage,
                discharge_mode: parameters.discharge_mode,
            });
        }
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(time, state) {
        const tau = timeConstant();
        const resistor_voltage = Math.abs(state.current) * resistanceOhms();
        document.getElementById("math_voltage").textContent =
            strings[parameters.discharge_mode ? "math_discharge_voltage" : "math_charge_voltage"][current_language];
        document.getElementById("math_mesh").textContent =
            strings[parameters.discharge_mode ? "math_discharge_mesh" : "math_charge_mesh"][current_language];

        const cards = {
            tau: {
                substitution: `${formatNumber(parameters.resistance_kilohms)} × 10³ × ${formatNumber(parameters.capacitance_microfarads)} × 10⁻⁶`,
                result: `${formatNumber(tau)} s`,
            },
            voltage: {
                substitution: parameters.discharge_mode
                    ? `${formatNumber(parameters.emf)} × e^(−${formatNumber(time)}/${formatNumber(tau)})`
                    : `${formatNumber(parameters.emf)} × (1 − e^(−${formatNumber(time)}/${formatNumber(tau)}))`,
                result: `${formatNumber(state.voltage)} V`,
            },
            current: {
                substitution: `${parameters.discharge_mode ? "−" : ""}(${formatNumber(parameters.emf)} / ${formatNumber(parameters.resistance_kilohms)} kΩ) × e^(−t/τ)`,
                result: `${formatNumber(state.current * 1000)} mA`,
            },
            charge: {
                substitution: `${formatNumber(parameters.capacitance_microfarads)} µF × ${formatNumber(state.voltage)}`,
                result: `${formatNumber(state.charge * 1000)} mC`,
            },
            at_tau: {
                substitution: `u_C(τ) = ${formatNumber(parameters.discharge_mode ? 36.8 : 63.2)} % × E`,
                result: `${formatNumber(parameters.discharge_mode ? 0.368 * parameters.emf : 0.632 * parameters.emf)} V`,
            },
            five_tau: {
                substitution: `5 × ${formatNumber(tau)}`,
                result: `${formatNumber(5 * tau)} s (${formatNumber(99.3)} %)`,
            },
            mesh: {
                substitution: parameters.discharge_mode
                    ? `${formatNumber(state.voltage)} = ${formatNumber(resistor_voltage)}`
                    : `${formatNumber(parameters.emf)} = ${formatNumber(resistor_voltage)} + ${formatNumber(state.voltage)}`,
                result: "✓",
            },
            stored: {
                substitution: `½ × ${formatNumber(parameters.capacitance_microfarads)} µF × ${formatNumber(state.voltage)}²`,
                result: `${formatNumber(state.stored * 1000)} mJ`,
            },
            half: {
                substitution: strings.half_text[current_language],
                result: `${formatNumber(calc.storedEnergy(capacitanceFarads(), parameters.emf) * 1000)} mJ`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: u_C, i and the three energies versus time with live cursor */
    function drawGraphs(time) {
        const total_time = Math.max(totalTime(), 1e-9);
        const voltage_points = [];
        const emf_points = [];
        const current_points = [];
        const stored_points = [];
        const dissipated_points = [];
        const supplied_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const sample_time = (total_time * i) / GRAPH_SAMPLES;
            const state = currentState(sample_time);
            voltage_points.push([sample_time, state.voltage]);
            emf_points.push([sample_time, parameters.emf]);
            current_points.push([sample_time, state.current * 1000]);
            stored_points.push([sample_time, state.stored]);
            dissipated_points.push([sample_time, state.dissipated]);
            supplied_points.push([sample_time, state.supplied]);
        }
        graph.drawTimeGraph(document.getElementById("graph_voltage"), [
            { label: "u_C", color: "#1976d2", points: voltage_points },
            { label: "E", color: "#8e24aa", points: emf_points },
        ], { cursor_time: time, unit: "V" });
        graph.drawTimeGraph(document.getElementById("graph_current"), [
            { label: "i", color: "#d32f2f", points: current_points },
        ], { cursor_time: time, unit: "mA" });
        const energy_series = [
            { label: "E_C", color: "#43a047", points: stored_points },
            { label: "E_R", color: "#e8722c", points: dissipated_points },
        ];
        if (!parameters.discharge_mode) {
            energy_series.push({ label: "E_pile", color: "#8e24aa", points: supplied_points });
        }
        graph.drawTimeGraph(document.getElementById("graph_energy"), energy_series, { cursor_time: time, unit: "J" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const total_time = Math.max(totalTime(), 1e-9);
        const time = Math.min(simulation_time, total_time);
        const state = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s (${formatNumber(time / timeConstant())} τ)`;
        const timeline = document.getElementById("timeline");
        timeline.max = total_time;
        timeline.step = total_time / 1000;
        timeline.value = time;
        updateFormulas(time, state);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs(time);
        }
    }

    /* animationFrame: advance simulation time while playing, then render */
    function animationFrame(timestamp) {
        const delta_seconds = last_frame_timestamp === null
            ? 0
            : Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
        last_frame_timestamp = timestamp;
        dot_clock += delta_seconds;
        if (is_playing) {
            simulation_time += delta_seconds * playback_speed;
            if (simulation_time >= totalTime()) {
                simulation_time = totalTime();
                setPlaying(false);
            }
        }
        render();
        requestAnimationFrame(animationFrame);
    }

    /* setPlaying: toggle play state and keep the button label in sync */
    function setPlaying(playing) {
        is_playing = playing;
        document.getElementById("play_pause_button").textContent = playing
            ? strings.pause[current_language]
            : strings.play[current_language];
    }

    /* stepTime: shift simulation time by τ/10, clamped to the window */
    function stepTime(direction) {
        simulation_time = Math.min(Math.max(simulation_time + direction * timeConstant() / 10, 0), totalTime());
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
                    simulation_time = 0;
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
