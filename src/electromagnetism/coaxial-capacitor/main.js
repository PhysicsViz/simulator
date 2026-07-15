/*
 * main.js — Coaxial capacitor page logic: cross-section scene (inner cylinder
 * with + signs, insulator ring, outer tube with − signs or uncharged, radial
 * field arrows, draggable radial probe reading E(r) and V(r), a/b dimension
 * markers), parameters (λ, a, b, L, outer-tube toggle for the classic
 * question 4), live formula cards (Gauss, E(r), V(r), ΔV, boundary condition,
 * u(r), C, U) and radial-profile graphs E(r), V(r), u(r). Static exercise: no
 * transport panel; the graphs plot profiles versus r. World units on the
 * canvas are centimeters. Classic script (works via file://); reads the
 * globals of calcul.js, canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.coaxial_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Câble coaxial (condensateur cylindrique)", en: "Coaxial cable (cylindrical capacitor)" },
        assumption: {
            fr: "Hypothèses : cylindres coaxiaux de longueur L ≫ b (effets de bord négligés, L n'intervient que dans C et U), conducteurs équipotentiels, +λ par unité de longueur sur le cylindre intérieur (rayon a) et −λ sur le tube extérieur (rayon b, épaisseur négligeable) — décochez pour un tube non chargé (question classique). Référence imposée V(b) = 0. Vue en coupe, distances en cm ; glissez la sonde dorée pour mesurer E(r) et V(r).",
            en: "Assumptions: coaxial cylinders of length L ≫ b (edge effects neglected, L only enters C and U), equipotential conductors, +λ per unit length on the inner cylinder (radius a) and −λ on the outer tube (radius b, negligible thickness) — untick for an uncharged tube (the classic question). Imposed reference V(b) = 0. Cross-section view, distances in cm; drag the golden probe to measure E(r) and V(r).",
        },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Profils radiaux", en: "Radial profiles" },
        graph_field: { fr: "Champ E(r)", en: "Field E(r)" },
        graph_potential: { fr: "Potentiel V(r) (V(b) = 0)", en: "Potential V(r) (V(b) = 0)" },
        graph_energy: { fr: "Densité d'énergie u(r)", en: "Energy density u(r)" },
        zoom_fit_hint: { fr: "Recentrer la vue", en: "Recenter the view" },
        lambda_microcoulombs: { fr: "Densité linéique de charge λ", en: "Linear charge density λ" },
        radius_a_cm: { fr: "Rayon intérieur a", en: "Inner radius a" },
        radius_b_cm: { fr: "Rayon extérieur b", en: "Outer radius b" },
        cable_length: { fr: "Longueur du câble L", en: "Cable length L" },
        outer_charged: { fr: "Tube extérieur chargé (−λ)", en: "Outer tube charged (−λ)" },
        legend_field: { fr: "Champ E", en: "Field E" },
        legend_probe: { fr: "Sonde (E, V à la distance r)", en: "Probe (E, V at distance r)" },
        formula_gauss: { fr: "Théorème de Gauss", en: "Gauss's theorem" },
        formula_gauss_note: { fr: "cylindre de rayon r et longueur ℓ", en: "cylinder of radius r and length ℓ" },
        formula_field: { fr: "Champ entre les armatures", en: "Field between the plates" },
        formula_potential: { fr: "Potentiel (V(b) = 0)", en: "Potential (V(b) = 0)" },
        formula_difference: { fr: "Différence de potentiel", en: "Potential difference" },
        formula_boundary: { fr: "Condition aux limites en r = a", en: "Boundary condition at r = a" },
        formula_energy_density: { fr: "Densité d'énergie à la sonde", en: "Energy density at the probe" },
        formula_capacitance: { fr: "Capacité (géométrie seule !)", en: "Capacitance (geometry only!)" },
        formula_stored: { fr: "Énergie stockée", en: "Stored energy" },
        inside_metal: { fr: "dans le métal : E = 0", en: "inside the metal: E = 0" },
        outside_zero: { fr: "à l'extérieur : λ_int = 0", en: "outside: enclosed λ = 0" },
    };

    const parameter_config = [
        { key: "lambda_microcoulombs", min: 0.1, max: 5, step: 0.1, unit: "µC/m" },
        { key: "radius_a_cm", min: 0.5, max: 4, step: 0.1, unit: "cm" },
        { key: "radius_b_cm", min: 2, max: 15, step: 0.1, unit: "cm" },
        { key: "cable_length", min: 0.1, max: 10, step: 0.1, unit: "m" },
        { key: "outer_charged", type: "toggle" },
    ];
    const parameters = {
        lambda_microcoulombs: 1,
        radius_a_cm: 2,
        radius_b_cm: 8,
        cable_length: 1,
        outer_charged: true,
    };

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const camera = globalThis.scene_camera.createCamera(canvas);
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };

    let current_language = localStorage.getItem("simulator_language") || "fr";
    let probe = { x: 5, y: 2 };
    let dragging_probe = false;
    let pointer_down_position = null;

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* formatField / formatPotential / formatCapacitance / formatEnergy: adaptive units */
    function formatField(value) {
        return Math.abs(value) >= 1000
            ? `${formatNumber(value / 1000)} kV/m`
            : `${formatNumber(value)} V/m`;
    }
    function formatPotential(value) {
        return Math.abs(value) >= 1000
            ? `${formatNumber(value / 1000)} kV`
            : `${formatNumber(value)} V`;
    }
    function formatCapacitance(value) {
        return `${formatNumber(value * 1e12)} pF`;
    }
    function formatEnergy(value) {
        if (Math.abs(value) >= 1) {
            return `${formatNumber(value)} J`;
        }
        return Math.abs(value) >= 1e-3
            ? `${formatNumber(value * 1e3)} mJ`
            : `${formatNumber(value * 1e6)} µJ`;
    }

    /* geometry: SI values with b kept above a */
    function geometry() {
        const radius_a = parameters.radius_a_cm / 100;
        const radius_b = Math.max(parameters.radius_b_cm, parameters.radius_a_cm + 0.5) / 100;
        return { radius_a, radius_b, lambda: parameters.lambda_microcoulombs * 1e-6 };
    }

    /* probeRadius: distance from the axis, in meters */
    function probeRadius() {
        return Math.max(Math.hypot(probe.x, probe.y), 0.2) / 100;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the outer tube with margin (cm world units) */
    function fitView() {
        const extent = Math.max(parameters.radius_b_cm, parameters.radius_a_cm + 0.5) * 1.45;
        camera.fitTo({ left: -extent, right: extent, bottom: -extent * 0.75, top: extent * 0.75 });
    }

    /* worldFromPixel: inverse camera mapping for pointer interactions */
    function worldFromPixel(pixel_x, pixel_y) {
        const bounds = camera.transform().bounds;
        return {
            x: bounds.left + (pixel_x / canvas.width) * (bounds.right - bounds.left),
            y: bounds.top - (pixel_y / canvas.height) * (bounds.top - bounds.bottom),
        };
    }

    /* pixelFromEvent: pointer event → internal canvas pixels */
    function pixelFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * canvas.width / rect.width,
            y: (event.clientY - rect.top) * canvas.height / rect.height,
        };
    }

    /* drawScene: cross-section, field arrows, probe and dimension markers */
    function drawScene(transform) {
        const ink = inkColor();
        const { radius_a, radius_b, lambda } = geometry();
        const a_cm = radius_a * 100;
        const b_cm = radius_b * 100;
        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(0);
        const pixels_per_cm = Math.abs(transform.toScreenX(1) - center_x);

        context.save();
        context.fillStyle = "rgba(38, 166, 154, 0.07)";
        context.beginPath();
        context.arc(center_x, center_y, b_cm * pixels_per_cm, 0, 2 * Math.PI);
        context.arc(center_x, center_y, a_cm * pixels_per_cm, 0, 2 * Math.PI, true);
        context.fill();

        context.fillStyle = "rgba(120, 130, 145, 0.5)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, a_cm * pixels_per_cm, 0, 2 * Math.PI);
        context.fill();
        context.stroke();

        context.strokeStyle = ink;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(center_x, center_y, b_cm * pixels_per_cm, 0, 2 * Math.PI);
        context.stroke();

        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * 2 * Math.PI;
            context.fillStyle = "#d32f2f";
            context.fillText(
                "+",
                center_x + Math.cos(angle) * (a_cm * pixels_per_cm - 9),
                center_y + Math.sin(angle) * (a_cm * pixels_per_cm - 9),
            );
            if (parameters.outer_charged) {
                context.fillStyle = "#1976d2";
                context.fillText(
                    "−",
                    center_x + Math.cos(angle + 0.13) * (b_cm * pixels_per_cm + 10),
                    center_y + Math.sin(angle + 0.13) * (b_cm * pixels_per_cm + 10),
                );
            }
        }

        context.strokeStyle = "#1976d2";
        context.lineWidth = 1.4;
        context.fillStyle = "#1976d2";
        context.font = "italic bold 13px system-ui, sans-serif";
        context.beginPath();
        context.moveTo(center_x, center_y);
        context.lineTo(center_x + a_cm * pixels_per_cm * Math.cos(-2.3), center_y + a_cm * pixels_per_cm * Math.sin(-2.3));
        context.stroke();
        context.fillText(
            "a",
            center_x + (a_cm * pixels_per_cm / 2) * Math.cos(-2.3) - 10,
            center_y + (a_cm * pixels_per_cm / 2) * Math.sin(-2.3),
        );
        context.beginPath();
        context.moveTo(center_x, center_y);
        context.lineTo(center_x + b_cm * pixels_per_cm * Math.cos(-0.7), center_y + b_cm * pixels_per_cm * Math.sin(-0.7));
        context.stroke();
        context.fillText(
            "b",
            center_x + (b_cm * pixels_per_cm * 0.72) * Math.cos(-0.7) + 10,
            center_y + (b_cm * pixels_per_cm * 0.72) * Math.sin(-0.7),
        );
        context.restore();

        const arrow_radii = [a_cm * 1.25, (a_cm + b_cm) / 2, b_cm * 0.88];
        if (!parameters.outer_charged) {
            arrow_radii.push(b_cm * 1.25);
        }
        for (const radius_cm of arrow_radii) {
            const field = calc.fieldAt(lambda, radius_a, radius_b, radius_cm / 100, parameters.outer_charged);
            if (field < 1) {
                continue;
            }
            const length = Math.min(8 + 10 * Math.log10(1 + field / 1000), 40);
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * 2 * Math.PI + 0.26;
                const start_x = center_x + Math.cos(angle) * radius_cm * pixels_per_cm;
                const start_y = center_y + Math.sin(angle) * radius_cm * pixels_per_cm;
                draw.drawVector(context, start_x, start_y, Math.cos(angle) * length, Math.sin(angle) * length, {
                    color: "rgba(38, 166, 154, 0.6)",
                    line_width: 1.6,
                });
            }
        }

        const probe_screen_x = transform.toScreenX(probe.x);
        const probe_screen_y = transform.toScreenY(probe.y);
        const probe_r = probeRadius();
        context.save();
        context.strokeStyle = "rgba(184, 134, 11, 0.5)";
        context.setLineDash([5, 5]);
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(center_x, center_y, probe_r * 100 * pixels_per_cm, 0, 2 * Math.PI);
        context.stroke();
        context.setLineDash([]);
        context.restore();

        const probe_field = calc.fieldAt(lambda, radius_a, radius_b, probe_r, parameters.outer_charged);
        if (probe_field > 1) {
            const direction_x = probe.x / Math.hypot(probe.x, probe.y);
            const direction_y = probe.y / Math.hypot(probe.x, probe.y);
            const length = Math.min(16 + 12 * Math.log10(1 + probe_field / 1000), 60);
            draw.drawVector(context, probe_screen_x, probe_screen_y, direction_x * length, -direction_y * length, {
                color: "#b8860b",
                line_width: 3,
                label: "E",
            });
        }
        context.save();
        context.strokeStyle = "#b8860b";
        context.fillStyle = "rgba(251, 192, 45, 0.35)";
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(probe_screen_x, probe_screen_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        const probe_potential = calc.potentialAt(lambda, radius_a, radius_b, probe_r, parameters.outer_charged);
        context.fillText(
            `r = ${formatNumber(probe_r * 100)} cm · E = ${formatField(probe_field)} · V = ${formatPotential(probe_potential)}`,
            probe_screen_x,
            probe_screen_y + 13,
        );
        context.restore();

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.coaxial_game_overlay === "function") {
            globalThis.coaxial_game_overlay(context, transform, {
                radius_a_cm: a_cm,
                radius_b_cm: b_cm,
            });
        }
    }

    /* updateFormulas: refresh every formula card */
    function updateFormulas() {
        const { radius_a, radius_b, lambda } = geometry();
        const probe_r = probeRadius();
        const between = probe_r >= radius_a && probe_r <= radius_b;
        const field = calc.fieldAt(lambda, radius_a, radius_b, probe_r, parameters.outer_charged);
        const enclosed_note = probe_r < radius_a
            ? strings.inside_metal[current_language]
            : (probe_r > radius_b && parameters.outer_charged ? strings.outside_zero[current_language]
                : `λ_int = ${formatNumber(parameters.lambda_microcoulombs)} µC/m`);
        const difference = calc.potentialDifference(lambda, radius_a, radius_b);
        const sigma = calc.surfaceChargeDensity(lambda, radius_a);
        const capacitance = calc.capacitance(radius_a, radius_b, parameters.cable_length);
        const cards = {
            gauss: {
                substitution: strings.formula_gauss_note[current_language],
                result: enclosed_note,
            },
            field: {
                substitution: between
                    ? `(${formatNumber(parameters.lambda_microcoulombs)} × 10⁻⁶) / (2π·ε₀ × ${formatNumber(probe_r * 100)} × 10⁻²)`
                    : `r = ${formatNumber(probe_r * 100)} cm ∉ [a, b]`,
                result: formatField(field),
            },
            potential: {
                substitution: probe_r < radius_b
                    ? `λ/(2π·ε₀) × ln(${formatNumber(radius_b * 100)} / ${formatNumber(Math.max(probe_r, radius_a) * 100)})`
                    : `V(b) = 0${parameters.outer_charged ? "" : " − λ/(2π·ε₀)·ln(r/b)"}`,
                result: formatPotential(calc.potentialAt(lambda, radius_a, radius_b, probe_r, parameters.outer_charged)),
            },
            difference: {
                substitution: `λ/(2π·ε₀) × ln(${formatNumber(radius_b * 100)} / ${formatNumber(radius_a * 100)})`,
                result: formatPotential(difference),
            },
            boundary: {
                substitution: `σ_a = λ/(2π·a) = ${formatNumber(sigma * 1e6)} µC/m² → σ_a/ε₀`,
                result: formatField(sigma / calc.VACUUM_PERMITTIVITY),
            },
            energy_density: {
                substitution: `8,854×10⁻¹² × (${formatField(field)})² / 2`,
                result: `${formatNumber(calc.energyDensity(field))} J/m³`,
            },
            capacitance: {
                substitution: `2π·ε₀ × ${formatNumber(parameters.cable_length)} / ln(${formatNumber(radius_b * 100)}/${formatNumber(radius_a * 100)})`,
                result: formatCapacitance(capacitance),
            },
            stored: {
                substitution: `½ × ${formatCapacitance(capacitance)} × (${formatPotential(difference)})²`,
                result: formatEnergy(calc.storedEnergy(lambda, radius_a, radius_b, parameters.cable_length)),
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: E(r), V(r) and u(r) radial profiles with the probe cursor */
    function drawGraphs() {
        const { radius_a, radius_b, lambda } = geometry();
        const max_r = radius_b * 1.6;
        const field_points = [];
        const potential_points = [];
        const energy_points = [];
        for (let i = 1; i <= 160; i++) {
            const r = (max_r * i) / 160;
            const field = calc.fieldAt(lambda, radius_a, radius_b, r, parameters.outer_charged);
            field_points.push([r * 100, field / 1000]);
            potential_points.push([r * 100, calc.potentialAt(lambda, radius_a, radius_b, r, parameters.outer_charged) / 1000]);
            energy_points.push([r * 100, calc.energyDensity(field)]);
        }
        const cursor = probeRadius() * 100;
        graph.drawTimeGraph(document.getElementById("graph_field"), [
            { label: "E", color: "#26a69a", points: field_points },
        ], { cursor_time: cursor, unit: "kV/m", x_label: "r (cm)" });
        graph.drawTimeGraph(document.getElementById("graph_potential"), [
            { label: "V", color: "#1976d2", points: potential_points },
        ], { cursor_time: cursor, unit: "kV", x_label: "r (cm)" });
        graph.drawTimeGraph(document.getElementById("graph_energy"), [
            { label: "u", color: "#d32f2f", points: energy_points },
        ], { cursor_time: cursor, unit: "J/m³", x_label: "r (cm)" });
    }

    /* render: scene + formulas + profiles */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        drawScene(camera.transform());
        updateFormulas();
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs();
        }
    }

    /* animationFrame: continuous redraw (drag, camera, game effects) */
    function animationFrame() {
        render();
        requestAnimationFrame(animationFrame);
    }

    /* buildControls: slider + number pair per numeric parameter, checkbox for the toggle */
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
        if (!camera.isTouched()) {
            fitView();
        }
    }

    /* bindPointer: probe dragging (captures before the camera's pan) */
    function bindPointer() {
        canvas.addEventListener("pointerdown", (event) => {
            pointer_down_position = { x: event.clientX, y: event.clientY };
            const pixel = pixelFromEvent(event);
            const world = worldFromPixel(pixel.x, pixel.y);
            if (Math.hypot(world.x - probe.x, world.y - probe.y) < 1.2) {
                dragging_probe = true;
                event.stopImmediatePropagation();
                canvas.setPointerCapture(event.pointerId);
            }
        });
        canvas.addEventListener("pointermove", (event) => {
            if (!dragging_probe) {
                return;
            }
            const pixel = pixelFromEvent(event);
            const world = worldFromPixel(pixel.x, pixel.y);
            probe.x = Math.round(world.x * 10) / 10;
            probe.y = Math.round(world.y * 10) / 10;
            event.stopImmediatePropagation();
        });
        for (const event_name of ["pointerup", "pointercancel"]) {
            canvas.addEventListener(event_name, () => {
                dragging_probe = false;
            });
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
        document.getElementById("zoom_fit_button").title = strings.zoom_fit_hint[language];
        document.getElementById("language_toggle").textContent = language === "fr" ? "EN" : "FR";
    }

    /* init: build controls, bind everything, start the render loop */
    function init() {
        buildControls();
        bindPointer();
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
