/*
 * main.js — Hanging-sign statics page logic: scene with the wall, pivot, bar,
 * cable (angle theta with the wall), sign on two hooks and every force vector
 * (bar weight, hook loads, cable tension, pivot reaction), free-body diagram
 * inset, parameters (m1, m2, L, theta, sign position, hook spacing), live
 * formulas (moment balance about the pivot, tension, pivot components) and
 * angle-profile graphs T(θ) and |R|(θ). Static exercise: no transport panel;
 * the graphs plot profiles versus the cable angle. Classic script (works via
 * file://); reads the globals of calcul.js, canvas_draw.js, scene_camera.js,
 * graph_plot.js.
 */
(() => {
    const calc = globalThis.statics_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Enseigne suspendue (statique)", en: "Hanging sign (statics)" },
        assumption: {
            fr: "Hypothèses : barre rigide homogène de masse m₂ articulée sans frottement sur un pivot mural (extrémité gauche), retenue à son extrémité droite par un câble tendu faisant un angle θ avec le mur. L'enseigne homogène de masse m₁ pend par deux crochets symétriques par rapport à son milieu : chaque crochet porte m₁·g/2. Équilibre statique : Σ F⃗ = 0 et Σ M = 0 (moments pris au pivot).",
            en: "Assumptions: rigid uniform bar of mass m₂ on a frictionless wall pivot (left end), held at its right end by a taut cable making an angle θ with the wall. The uniform sign of mass m₁ hangs from two hooks symmetric about its middle: each hook carries m₁·g/2. Static equilibrium: Σ F⃗ = 0 and Σ M = 0 (moments about the pivot).",
        },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Profils en fonction de l'angle θ", en: "Profiles versus the angle θ" },
        graph_tension: { fr: "Tension du câble T(θ)", en: "Cable tension T(θ)" },
        graph_pivot: { fr: "Force du pivot |R|(θ)", en: "Pivot force |R|(θ)" },
        zoom_fit_hint: { fr: "Recentrer la vue", en: "Recenter the view" },
        sign_mass: { fr: "Masse de l'enseigne m₁", en: "Sign mass m₁" },
        bar_mass: { fr: "Masse de la barre m₂", en: "Bar mass m₂" },
        bar_length: { fr: "Longueur de la barre L", en: "Bar length L" },
        angle_degrees: { fr: "Angle câble-mur θ", en: "Cable-wall angle θ" },
        sign_position: { fr: "Position du centre de l'enseigne", en: "Sign center position" },
        hook_spacing: { fr: "Écart entre les crochets", en: "Hook spacing" },
        legend_weight: { fr: "Poids (barre et crochets)", en: "Weights (bar and hooks)" },
        legend_tension: { fr: "Tension T", en: "Tension T" },
        legend_pivot: { fr: "Réaction du pivot R", en: "Pivot reaction R" },
        fbd_title: { fr: "Bilan des forces (barre)", en: "Free-body diagram (bar)" },
        sign_text: { fr: "PHYSIQUE 1", en: "PHYSICS 1" },
        formula_equilibrium: { fr: "Conditions d'équilibre", en: "Equilibrium conditions" },
        formula_equilibrium_note: { fr: "moments pris au pivot", en: "moments about the pivot" },
        formula_moment: { fr: "Balance des moments", en: "Moment balance" },
        formula_tension: { fr: "Tension du câble", en: "Cable tension" },
        formula_pivot_x: { fr: "Réaction horizontale du pivot", en: "Horizontal pivot reaction" },
        formula_pivot_y: { fr: "Réaction verticale du pivot", en: "Vertical pivot reaction" },
        formula_pivot: { fr: "Force du pivot", en: "Pivot force" },
        formula_hook: { fr: "Charge de chaque crochet", en: "Load on each hook" },
        formula_hooks_at: { fr: "Position des crochets", en: "Hook positions" },
    };

    const parameter_config = [
        { key: "sign_mass", min: 0.5, max: 10, step: 0.1, unit: "kg" },
        { key: "bar_mass", min: 0.5, max: 10, step: 0.1, unit: "kg" },
        { key: "bar_length", min: 0.6, max: 2, step: 0.05, unit: "m" },
        { key: "angle_degrees", min: 20, max: 85, step: 1, unit: "°" },
        { key: "sign_position", min: 0.1, max: 1.9, step: 0.01, unit: "m" },
        { key: "hook_spacing", min: 0.2, max: 1, step: 0.01, unit: "m" },
    ];
    const parameters = {
        sign_mass: 3,
        bar_mass: 2,
        bar_length: 1.2,
        angle_degrees: 60,
        sign_position: 0.64,
        hook_spacing: 0.72,
    };

    const GRAVITY = 9.81;
    const PIXELS_PER_NEWTON = 1.6;

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

    /* solve: hooks, tension and pivot reaction for the current parameters */
    function solve() {
        const angle = calc.degToRad(parameters.angle_degrees);
        const hooks = calc.hookPositions(parameters.bar_length, parameters.sign_position, parameters.hook_spacing);
        const tension = calc.cableTension(
            parameters.sign_mass, parameters.bar_mass, parameters.bar_length,
            angle, hooks.left, hooks.right, GRAVITY,
        );
        const pivot_x = calc.pivotForceX(tension, angle);
        const pivot_y = calc.pivotForceY(parameters.sign_mass, parameters.bar_mass, tension, angle, GRAVITY);
        return { angle, hooks, tension, pivot_x, pivot_y };
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* wallAttachmentY: cable meets the wall at y = L / tan(theta) */
    function wallAttachmentY() {
        return parameters.bar_length / Math.tan(calc.degToRad(parameters.angle_degrees));
    }

    /* fitView: frame the wall, the bar, the cable and the sign */
    function fitView() {
        camera.fitTo({
            left: -0.35,
            right: parameters.bar_length + 0.5,
            bottom: -1.2,
            top: Math.min(wallAttachmentY(), 3.4) + 0.4,
        });
    }

    /* drawScene: wall, pivot, bar, cable, sign and every force vector */
    function drawScene(transform, solution) {
        const ink = inkColor();
        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);

        const wall_x = transform.toScreenX(0);
        const pivot_y = transform.toScreenY(0);
        const bar_end_x = transform.toScreenX(parameters.bar_length);
        const attach_y = transform.toScreenY(wallAttachmentY());

        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.25)";
        context.fillRect(wall_x - 14, 0, 14, canvas.height);
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(wall_x, 0);
        context.lineTo(wall_x, canvas.height);
        context.stroke();

        context.strokeStyle = "#8e24aa";
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(bar_end_x, pivot_y);
        context.lineTo(wall_x, attach_y);
        context.stroke();

        context.strokeStyle = "#1976d2";
        context.lineWidth = 1.5;
        const cable_screen_angle = Math.atan2(pivot_y - attach_y, bar_end_x - wall_x);
        context.beginPath();
        context.arc(wall_x, attach_y, 34, Math.PI / 2, cable_screen_angle, true);
        context.stroke();
        context.fillStyle = "#1976d2";
        context.font = "italic bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        const marker_angle = (Math.PI / 2 + cable_screen_angle) / 2;
        context.fillText("θ", wall_x + 44 * Math.cos(marker_angle), attach_y + 44 * Math.sin(marker_angle));

        context.strokeStyle = ink;
        context.lineWidth = 6;
        context.beginPath();
        context.moveTo(wall_x, pivot_y);
        context.lineTo(bar_end_x, pivot_y);
        context.stroke();

        context.fillStyle = "#43a047";
        context.beginPath();
        context.moveTo(wall_x, pivot_y);
        context.lineTo(wall_x - 12, pivot_y + 12);
        context.lineTo(wall_x - 12, pivot_y - 12);
        context.closePath();
        context.fill();
        context.restore();

        const sign_width = parameters.hook_spacing + 0.24;
        const sign_left = transform.toScreenX(parameters.sign_position - sign_width / 2);
        const sign_right = transform.toScreenX(parameters.sign_position + sign_width / 2);
        const sign_top = transform.toScreenY(-0.22);
        const sign_bottom = transform.toScreenY(-0.55);
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 1.5;
        for (const hook of [solution.hooks.left, solution.hooks.right]) {
            context.beginPath();
            context.moveTo(transform.toScreenX(hook), pivot_y);
            context.lineTo(transform.toScreenX(hook), sign_top);
            context.stroke();
        }
        context.fillStyle = matchMedia("(prefers-color-scheme: dark)").matches ? "#20262f" : "#f0e6d2";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.rect(sign_left, sign_top, sign_right - sign_left, sign_bottom - sign_top);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 15px Georgia, serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
            strings.sign_text[current_language],
            (sign_left + sign_right) / 2,
            (sign_top + sign_bottom) / 2,
        );
        context.restore();

        const hook_load = parameters.sign_mass * GRAVITY / 2;
        const bar_weight = parameters.bar_mass * GRAVITY;
        for (const hook of [solution.hooks.left, solution.hooks.right]) {
            draw.drawVector(context, transform.toScreenX(hook), pivot_y, 0, hook_load * PIXELS_PER_NEWTON, {
                color: "#d32f2f",
                label: "m₁g/2",
            });
        }
        draw.drawVector(
            context,
            transform.toScreenX(parameters.bar_length / 2),
            pivot_y,
            0,
            bar_weight * PIXELS_PER_NEWTON,
            { color: "#d32f2f", label: "P₂" },
        );
        const cable_direction = {
            x: -Math.sin(solution.angle),
            y: -Math.cos(solution.angle),
        };
        draw.drawVector(
            context,
            bar_end_x,
            pivot_y,
            cable_direction.x * solution.tension * PIXELS_PER_NEWTON,
            cable_direction.y * solution.tension * PIXELS_PER_NEWTON,
            { color: "#8e24aa", label: "T" },
        );
        draw.drawVector(
            context,
            wall_x,
            pivot_y,
            solution.pivot_x * PIXELS_PER_NEWTON,
            -solution.pivot_y * PIXELS_PER_NEWTON,
            { color: "#43a047", label: "R" },
        );

        drawFreeBodyInset(ink, solution);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.statics_game_overlay === "function") {
            globalThis.statics_game_overlay(context, transform, {
                tension: solution.tension,
                pivot_x: solution.pivot_x,
                pivot_y: solution.pivot_y,
                sign_position: parameters.sign_position,
                bar_length: parameters.bar_length,
                angle_degrees: parameters.angle_degrees,
                wall_attachment_y: wallAttachmentY(),
            });
        }
    }

    /* drawFreeBodyInset: the bar alone with its five forces */
    function drawFreeBodyInset(ink, solution) {
        const box_width = 190;
        const box_height = 150;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const bar_y = box_y + 84;
        const bar_left = box_x + 24;
        const bar_right = box_x + box_width - 24;
        const scale = 42 / Math.max(solution.tension, (parameters.sign_mass + parameters.bar_mass) * GRAVITY);

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
        context.strokeStyle = ink;
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(bar_left, bar_y);
        context.lineTo(bar_right, bar_y);
        context.stroke();
        context.restore();

        const toInsetX = (position) => bar_left + (position / parameters.bar_length) * (bar_right - bar_left);
        const hook_load = parameters.sign_mass * GRAVITY / 2;
        for (const hook of [solution.hooks.left, solution.hooks.right]) {
            draw.drawVector(context, toInsetX(hook), bar_y, 0, hook_load * scale, { color: "#d32f2f" });
        }
        draw.drawVector(context, toInsetX(parameters.bar_length / 2), bar_y, 0, parameters.bar_mass * GRAVITY * scale, {
            color: "#d32f2f",
        });
        draw.drawVector(
            context,
            bar_right,
            bar_y,
            -Math.sin(solution.angle) * solution.tension * scale,
            -Math.cos(solution.angle) * solution.tension * scale,
            { color: "#8e24aa", label: "T" },
        );
        draw.drawVector(context, bar_left, bar_y, solution.pivot_x * scale, -solution.pivot_y * scale, {
            color: "#43a047",
            label: "R",
        });
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(solution) {
        const m1 = parameters.sign_mass;
        const m2 = parameters.bar_mass;
        const length = parameters.bar_length;
        const angle_degrees = parameters.angle_degrees;
        const load_moment = m2 * GRAVITY * length / 2
            + (m1 * GRAVITY / 2) * (solution.hooks.left + solution.hooks.right);
        const cards = {
            equilibrium: {
                substitution: strings.formula_equilibrium_note[current_language],
                result: "Σ F⃗ = 0 · Σ M = 0",
            },
            hooks_at: {
                substitution: `${formatNumber(parameters.sign_position)} ∓ ${formatNumber(parameters.hook_spacing)}/2`,
                result: `${formatNumber(solution.hooks.left)} m · ${formatNumber(solution.hooks.right)} m`,
            },
            hook: {
                substitution: `${formatNumber(m1)} × ${formatNumber(GRAVITY)} / 2`,
                result: `${formatNumber(m1 * GRAVITY / 2)} N`,
            },
            moment: {
                substitution: `${formatNumber(m2)}·g·${formatNumber(length)}/2 + (${formatNumber(m1)}·g/2)·(${formatNumber(solution.hooks.left)} + ${formatNumber(solution.hooks.right)})`,
                result: `${formatNumber(load_moment)} N·m`,
            },
            tension: {
                substitution: `${formatNumber(load_moment)} / (${formatNumber(length)} × cos ${angle_degrees}°)`,
                result: `${formatNumber(solution.tension)} N`,
            },
            pivot_x: {
                substitution: `${formatNumber(solution.tension)} × sin ${angle_degrees}°`,
                result: `${formatNumber(solution.pivot_x)} N`,
            },
            pivot_y: {
                substitution: `(${formatNumber(m1)} + ${formatNumber(m2)}) × ${formatNumber(GRAVITY)} − ${formatNumber(solution.tension)} × cos ${angle_degrees}°`,
                result: `${formatNumber(solution.pivot_y)} N`,
            },
            pivot: {
                substitution: `√(${formatNumber(solution.pivot_x)}² + ${formatNumber(solution.pivot_y)}²)`,
                result: `${formatNumber(calc.forceMagnitude(solution.pivot_x, solution.pivot_y))} N`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: T and |R| versus the cable angle, cursor at the current angle */
    function drawGraphs() {
        const hooks = calc.hookPositions(parameters.bar_length, parameters.sign_position, parameters.hook_spacing);
        const tension_points = [];
        const pivot_points = [];
        for (let degrees = 20; degrees <= 85; degrees += 0.5) {
            const angle = calc.degToRad(degrees);
            const tension = calc.cableTension(
                parameters.sign_mass, parameters.bar_mass, parameters.bar_length,
                angle, hooks.left, hooks.right, GRAVITY,
            );
            tension_points.push([degrees, tension]);
            pivot_points.push([degrees, calc.forceMagnitude(
                calc.pivotForceX(tension, angle),
                calc.pivotForceY(parameters.sign_mass, parameters.bar_mass, tension, angle, GRAVITY),
            )]);
        }
        graph.drawTimeGraph(document.getElementById("graph_tension"), [
            { label: "T", color: "#8e24aa", points: tension_points },
        ], { cursor_time: parameters.angle_degrees, unit: "N", x_label: "θ (°)" });
        graph.drawTimeGraph(document.getElementById("graph_pivot"), [
            { label: "|R|", color: "#43a047", points: pivot_points },
        ], { cursor_time: parameters.angle_degrees, unit: "N", x_label: "θ (°)" });
    }

    /* render: scene + formulas + angle profiles */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const solution = solve();
        drawScene(camera.transform(), solution);
        updateFormulas(solution);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs();
        }
    }

    /* animationFrame: continuous redraw (camera, game effects) */
    function animationFrame() {
        render();
        requestAnimationFrame(animationFrame);
    }

    /* buildControls: one slider + number input pair per physical parameter */
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
        if (!camera.isTouched()) {
            fitView();
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
