/*
 * main.js — Electrostatic-pendulum page logic: static scene with the two
 * vertical plates (polarity signs following the sign of ΔV), a field-arrow
 * grid, the thread and charged sphere at the equilibrium angle with an angle
 * arc, weight / tension / electric-force vectors and a free-body diagram
 * inset; shared pan/zoom camera with auto-fit; parameters φ and ΔV are LINKED
 * (editing either recomputes the other through tan φ = q·ΔV/(L·m·g)) plus m,
 * q, L and g; formulas answering the course's two questions (ΔV = m·g·tan φ·L/q
 * and E = m·g·tan φ/q) with σ = ε₀·E, T = m·g/cos φ and F_e = q·E; profile
 * graphs of ΔV, E and T versus φ with a live cursor. Static exercise: no
 * transport panel, continuous redraw only. World units on the canvas grid are
 * CENTIMETERS. Thread display length 0.4·L (the equilibrium does not depend
 * on it).
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.charged_pendulum_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Pendule électrostatique", en: "Electrostatic pendulum" },
        assumption: {
            fr: "Hypothèses : deux plaques isolantes verticales, parallèles, infinies, de densités surfaciques +σ et −σ, distantes de L : entre elles le champ est uniforme, E = σ/ε₀ (σ/(2ε₀) par plaque), dirigé de +σ vers −σ, et ΔV = E·L. Sphère ponctuelle de charge q > 0 suspendue à un fil sans masse ; équilibre statique : tan φ = q·E/(m·g), T = m·g/cos φ. ΔV < 0 inverse la polarité des plaques (angle négatif). Les curseurs φ et ΔV sont liés : modifier l'un recalcule l'autre. Longueur du fil affichée : 0,4·L (l'équilibre n'en dépend pas). Grille du schéma en centimètres. Exercice statique : pas d'évolution temporelle.",
            en: "Assumptions: two vertical, parallel, infinite insulating plates of surface charge densities +σ and −σ, a distance L apart: between them the field is uniform, E = σ/ε₀ (σ/(2ε₀) per plate), pointing from +σ to −σ, and ΔV = E·L. Point sphere of charge q > 0 hanging from a massless thread; static equilibrium: tan φ = q·E/(m·g), T = m·g/cos φ. ΔV < 0 reverses the plate polarity (negative angle). The φ and ΔV sliders are linked: editing one recomputes the other. Displayed thread length: 0.4·L (the equilibrium does not depend on it). Canvas grid in centimeters. Static exercise: no time evolution.",
        },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Profils en fonction de φ", en: "Profiles versus φ" },
        graph_potential: { fr: "Différence de potentiel ΔV (kV)", en: "Potential difference ΔV (kV)" },
        graph_field: { fr: "Champ électrique E (kV/m)", en: "Electric field E (kV/m)" },
        graph_tension: { fr: "Tension du fil T (mN)", en: "Thread tension T (mN)" },
        zoom_fit_hint: { fr: "Ajuster la vue au montage", en: "Fit view to the setup" },
        phi_degrees: { fr: "Angle du fil φ", en: "Thread angle φ" },
        delta_kilovolts: { fr: "Différence de potentiel ΔV", en: "Potential difference ΔV" },
        mass_grams: { fr: "Masse de la sphère m", en: "Sphere mass m" },
        charge_nanocoulombs: { fr: "Charge de la sphère q", en: "Sphere charge q" },
        plate_centimeters: { fr: "Distance entre les plaques L", en: "Plate separation L" },
        gravity: { fr: "Pesanteur g", en: "Gravity g" },
        legend_weight: { fr: "Poids P = m·g", en: "Weight P = m·g" },
        legend_tension: { fr: "Tension du fil T", en: "Thread tension T" },
        legend_electric: { fr: "Force électrique F = q·E", en: "Electric force F = q·E" },
        legend_field: { fr: "Champ E", en: "Field E" },
        fbd_title: { fr: "Bilan des forces (ΣF = 0)", en: "Free-body diagram (ΣF = 0)" },
        formula_equilibrium: { fr: "Équilibre du fil", en: "Thread equilibrium" },
        formula_field: { fr: "2. Champ électrique", en: "2. Electric field" },
        formula_potential: { fr: "1. Différence de potentiel", en: "1. Potential difference" },
        formula_sigma: { fr: "Densité surfacique des plaques", en: "Plate surface charge density" },
        formula_tension: { fr: "Tension du fil", en: "Thread tension" },
        formula_force: { fr: "Force électrique", en: "Electric force" },
    };

    const parameter_config = [
        { key: "phi_degrees", min: -80, max: 80, step: 0.1, unit: "°" },
        { key: "delta_kilovolts", min: -100, max: 100, step: 0.1, unit: "kV" },
        { key: "mass_grams", min: 0.1, max: 20, step: 0.1, unit: "g" },
        { key: "charge_nanocoulombs", min: 0.5, max: 50, step: 0.1, unit: "nC" },
        { key: "plate_centimeters", min: 2, max: 20, step: 0.5, unit: "cm" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        phi_degrees: 30,
        delta_kilovolts: 0,
        mass_grams: 1.5,
        charge_nanocoulombs: 8.9,
        plate_centimeters: 5,
        gravity: 9.81,
    };

    const THREAD_RATIO = 0.4;
    const GRAPH_SAMPLES = 80;
    const PROFILE_MAX_DEGREES = 80;
    const FORCE_ARROW_PIXELS = 60;
    const TENSION_COLOR = "#8e24aa";
    const WEIGHT_COLOR = "#d32f2f";
    const ELECTRIC_COLOR = "#1976d2";
    const FIELD_COLOR = "rgba(38, 166, 154, 0.6)";
    const SUPERSCRIPT_DIGITS = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

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

    /* formatScientific: mantissa × 10^exponent with superscripts for very small
       or very large magnitudes, plain 2-decimal format otherwise */
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
    function massKilograms() {
        return parameters.mass_grams / 1000;
    }
    function chargeCoulombs() {
        return parameters.charge_nanocoulombs * 1e-9;
    }
    function plateMeters() {
        return parameters.plate_centimeters / 100;
    }
    function phiRadians() {
        return parameters.phi_degrees * Math.PI / 180;
    }

    /* syncPotentialFromAngle: recompute ΔV from the current φ (and m, q, L, g) */
    function syncPotentialFromAngle() {
        parameters.delta_kilovolts = calc.potentialFromAngle(
            massKilograms(), parameters.gravity, phiRadians(), chargeCoulombs(), plateMeters(),
        ) / 1000;
    }

    /* syncAngleFromPotential: recompute φ from the current ΔV (and m, q, L, g) */
    function syncAngleFromPotential() {
        const field = calc.electricField(parameters.delta_kilovolts * 1000, plateMeters());
        parameters.phi_degrees = calc.equilibriumAngle(chargeCoulombs(), field, massKilograms(), parameters.gravity)
            * 180 / Math.PI;
    }

    /* setInputPair: push a computed value into a slider + number pair */
    function setInputPair(key, value) {
        const rounded = Math.round(value * 100) / 100;
        document.getElementById(`slider_${key}`).value = rounded;
        document.getElementById(`number_${key}`).value = rounded;
    }

    /* currentState: every derived quantity for the current parameters */
    function currentState() {
        const field = calc.electricField(parameters.delta_kilovolts * 1000, plateMeters());
        return {
            field,
            electric_force: calc.electricForce(chargeCoulombs(), field),
            weight: massKilograms() * parameters.gravity,
            tension: calc.threadTension(massKilograms(), parameters.gravity, phiRadians()),
            sigma: calc.surfaceChargeDensity(field),
        };
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the plates and the pendulum (world units: centimeters) */
    function fitView() {
        const half_gap = parameters.plate_centimeters / 2;
        camera.fitTo({
            left: -half_gap - 2,
            right: half_gap + 2,
            bottom: -1.3 * parameters.plate_centimeters - 1,
            top: 0.35 * parameters.plate_centimeters + 1,
        });
    }

    /* drawPlates: vertical slabs at ±L/2 with polarity signs following sign(ΔV) */
    function drawPlates(transform) {
        const half_gap = parameters.plate_centimeters / 2;
        const top = 0.25 * parameters.plate_centimeters;
        const bottom = -1.25 * parameters.plate_centimeters;
        const left_positive = parameters.delta_kilovolts >= 0;
        for (const [world_x, is_left] of [[-half_gap, true], [half_gap, false]]) {
            const slab_outer = transform.toScreenX(world_x + (is_left ? -0.14 : 0.14) * parameters.plate_centimeters * 0.2);
            const slab_inner = transform.toScreenX(world_x);
            const slab_top = transform.toScreenY(top);
            const slab_bottom = transform.toScreenY(bottom);
            context.save();
            context.fillStyle = "rgba(120, 130, 145, 0.35)";
            context.fillRect(Math.min(slab_outer, slab_inner), slab_top, Math.abs(slab_outer - slab_inner) + 2, slab_bottom - slab_top);
            context.strokeStyle = "rgba(120, 130, 145, 0.8)";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(slab_inner, slab_top);
            context.lineTo(slab_inner, slab_bottom);
            context.stroke();
            if (parameters.delta_kilovolts !== 0) {
                const positive = is_left ? left_positive : !left_positive;
                context.fillStyle = positive ? "#d32f2f" : "#1976d2";
                context.font = "bold 14px system-ui, sans-serif";
                context.textAlign = "center";
                context.textBaseline = "middle";
                const sign_x = (slab_outer + slab_inner) / 2 + (is_left ? -8 : 8);
                for (let i = 0; i < 7; i++) {
                    const sign_y = slab_top + ((i + 0.5) / 7) * (slab_bottom - slab_top);
                    context.fillText(positive ? "+" : "−", sign_x, sign_y);
                }
                context.font = "bold 13px system-ui, sans-serif";
                context.fillText(positive ? "+σ" : "−σ", sign_x, slab_top - 12);
            }
            context.restore();
        }
    }

    /* drawFieldArrows: horizontal arrow grid between the plates, + plate → − plate */
    function drawFieldArrows(transform) {
        if (parameters.delta_kilovolts === 0) {
            return;
        }
        const direction = parameters.delta_kilovolts > 0 ? 1 : -1;
        const arrow_world = 0.34 * parameters.plate_centimeters;
        const arrow_pixels = (transform.toScreenX(arrow_world) - transform.toScreenX(0)) * direction;
        for (const height_ratio of [-0.15, -0.55, -0.95]) {
            const screen_y = transform.toScreenY(height_ratio * parameters.plate_centimeters);
            draw.drawVector(context, transform.toScreenX(-direction * arrow_world / 2), screen_y, arrow_pixels, 0, {
                color: FIELD_COLOR,
                line_width: 1.6,
            });
        }
        context.save();
        context.fillStyle = "rgba(38, 166, 154, 0.95)";
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText("E", transform.toScreenX(0), transform.toScreenY(-0.15 * parameters.plate_centimeters) - 8);
        context.restore();
    }

    /* drawPendulum: support, thread at φ, sphere, angle arc; returns sphere screen pos */
    function drawPendulum(transform, ink) {
        const thread_length = THREAD_RATIO * parameters.plate_centimeters;
        const phi = phiRadians();
        const sphere_world_x = thread_length * Math.sin(phi);
        const sphere_world_y = -thread_length * Math.cos(phi);
        const pivot_x = transform.toScreenX(0);
        const pivot_y = transform.toScreenY(0);
        const sphere_x = transform.toScreenX(sphere_world_x);
        const sphere_y = transform.toScreenY(sphere_world_y);

        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.9)";
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(transform.toScreenX(-0.1 * parameters.plate_centimeters), pivot_y);
        context.lineTo(transform.toScreenX(0.1 * parameters.plate_centimeters), pivot_y);
        context.stroke();

        context.strokeStyle = ink;
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(pivot_x, pivot_y);
        context.lineTo(sphere_x, sphere_y);
        context.stroke();

        context.setLineDash([4, 4]);
        context.strokeStyle = "rgba(120, 130, 145, 0.7)";
        context.beginPath();
        context.moveTo(pivot_x, pivot_y);
        context.lineTo(pivot_x, transform.toScreenY(-thread_length));
        context.stroke();
        context.setLineDash([]);

        const arc_radius = Math.abs(transform.toScreenX(thread_length * 0.45) - transform.toScreenX(0));
        context.strokeStyle = "#b8860b";
        context.lineWidth = 2;
        context.beginPath();
        if (phi >= 0) {
            context.arc(pivot_x, pivot_y, arc_radius, Math.PI / 2 - phi, Math.PI / 2);
        } else {
            context.arc(pivot_x, pivot_y, arc_radius, Math.PI / 2, Math.PI / 2 - phi);
        }
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = phi >= 0 ? "left" : "right";
        context.textBaseline = "top";
        context.fillText(
            `φ = ${formatNumber(parameters.phi_degrees)}°`,
            pivot_x + (phi >= 0 ? 10 : -10),
            pivot_y + arc_radius + 6,
        );

        const sphere_radius = Math.max(Math.abs(transform.toScreenX(0.045 * parameters.plate_centimeters) - transform.toScreenX(0)), 7);
        const gradient = context.createRadialGradient(
            sphere_x - sphere_radius * 0.3, sphere_y - sphere_radius * 0.3, sphere_radius * 0.2,
            sphere_x, sphere_y, sphere_radius,
        );
        gradient.addColorStop(0, "#f2b6b6");
        gradient.addColorStop(1, "#c62828");
        context.fillStyle = gradient;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(sphere_x, sphere_y, sphere_radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = `bold ${Math.max(sphere_radius, 10)}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("+", sphere_x, sphere_y);
        context.restore();

        return { sphere_x, sphere_y };
    }

    /* drawSphereForces: P, T and F_e applied on the sphere */
    function drawSphereForces(sphere_position, state, ink) {
        const reference = Math.max(state.tension, state.weight, Math.abs(state.electric_force), 1e-12);
        const scale = FORCE_ARROW_PIXELS / reference;
        const phi = phiRadians();
        draw.drawVector(context, sphere_position.sphere_x, sphere_position.sphere_y, 0, state.weight * scale, {
            color: WEIGHT_COLOR,
            label: "P",
        });
        if (Math.abs(state.electric_force) * scale > 1) {
            draw.drawVector(context, sphere_position.sphere_x, sphere_position.sphere_y, state.electric_force * scale, 0, {
                color: ELECTRIC_COLOR,
                label: "F = q·E",
            });
        }
        draw.drawVector(
            context,
            sphere_position.sphere_x,
            sphere_position.sphere_y,
            -Math.sin(phi) * state.tension * scale,
            -Math.cos(phi) * state.tension * scale,
            { color: TENSION_COLOR, label: "T" },
        );
    }

    /* drawFreeBodyInset: the sphere alone, the three forces closing to ΣF = 0 */
    function drawFreeBodyInset(state, ink) {
        const box_width = 210;
        const box_height = 216;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 92;
        const reference = Math.max(state.tension, state.weight, Math.abs(state.electric_force), 1e-12);
        const scale = 54 / reference;
        const phi = phiRadians();

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

        context.fillStyle = "#c62828";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center_x, center_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();

        draw.drawVector(context, center_x, center_y, 0, state.weight * scale, { color: WEIGHT_COLOR, label: "P" });
        if (Math.abs(state.electric_force) * scale > 1) {
            draw.drawVector(context, center_x, center_y, state.electric_force * scale, 0, {
                color: ELECTRIC_COLOR,
                label: "F",
            });
        }
        draw.drawVector(context, center_x, center_y, -Math.sin(phi) * state.tension * scale, -Math.cos(phi) * state.tension * scale, {
            color: TENSION_COLOR,
            label: "T",
        });

        context.save();
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = WEIGHT_COLOR;
        context.fillText(`P = ${formatNumber(state.weight * 1000)} mN`, center_x, box_y + box_height - 52);
        context.fillStyle = ELECTRIC_COLOR;
        context.fillText(`F = ${formatNumber(state.electric_force * 1000)} mN`, center_x, box_y + box_height - 37);
        context.fillStyle = TENSION_COLOR;
        context.fillText(`T = ${formatNumber(state.tension * 1000)} mN`, center_x, box_y + box_height - 22);
        context.restore();
    }

    /* drawScene: plates, field, pendulum, forces and inset; returns live quantities */
    function drawScene(transform) {
        const ink = inkColor();
        const state = currentState();

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawPlates(transform);
        drawFieldArrows(transform);
        const sphere_position = drawPendulum(transform, ink);

        /* Game mode hook — remove together with game.js (the force values reveal
           q = F/E, i.e. the mystery charge the game asks to measure) */
        if (!document.body.classList.contains("game-mode")) {
            drawSphereForces(sphere_position, state, ink);
            drawFreeBodyInset(state, ink);
        }

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.charged_pendulum_game_overlay === "function") {
            globalThis.charged_pendulum_game_overlay(context, transform, {
                phi_degrees: parameters.phi_degrees,
                delta_kilovolts: parameters.delta_kilovolts,
                sphere_x: sphere_position.sphere_x,
                sphere_y: sphere_position.sphere_y,
            });
        }
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(state) {
        const tangent = Math.tan(phiRadians());
        const cards = {
            equilibrium: {
                substitution: `tan(${formatNumber(parameters.phi_degrees)}°) = ${formatNumber(Math.abs(tangent))} ; q·E/(m·g) = ${formatNumber(Math.abs(state.electric_force) / Math.max(state.weight, 1e-12))}`,
                result: "ΣF = 0 ✓",
            },
            field: {
                substitution: `(${formatNumber(parameters.mass_grams)} × 10⁻³) × ${formatNumber(parameters.gravity)} × tan(${formatNumber(parameters.phi_degrees)}°) / (${formatNumber(parameters.charge_nanocoulombs)} × 10⁻⁹)`,
                result: `${formatScientific(state.field)} V/m`,
            },
            potential: {
                substitution: `${formatScientific(state.field)} × ${formatNumber(plateMeters())}`,
                result: `${formatScientific(state.field * plateMeters())} V = ${formatNumber(parameters.delta_kilovolts)} kV`,
            },
            sigma: {
                substitution: `${current_language === "fr" ? "8,854 × 10⁻¹²" : "8.854 × 10⁻¹²"} × ${formatScientific(Math.abs(state.field))}`,
                result: `${formatNumber(state.sigma * 1e6)} µC/m²`,
            },
            tension: {
                substitution: `(${formatNumber(parameters.mass_grams)} × 10⁻³) × ${formatNumber(parameters.gravity)} / cos(${formatNumber(parameters.phi_degrees)}°)`,
                result: `${formatNumber(state.tension * 1000)} mN`,
            },
            force: {
                substitution: `(${formatNumber(parameters.charge_nanocoulombs)} × 10⁻⁹) × ${formatScientific(state.field)}`,
                result: `${formatNumber(state.electric_force * 1000)} mN`,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: ΔV, E and T profiles versus φ (0…80°) with a cursor at |φ| */
    function drawGraphs() {
        const potential_points = [];
        const field_points = [];
        const tension_points = [];
        for (let i = 0; i <= GRAPH_SAMPLES; i++) {
            const angle_degrees = (PROFILE_MAX_DEGREES * i) / GRAPH_SAMPLES;
            const angle = angle_degrees * Math.PI / 180;
            const field = calc.fieldFromAngle(massKilograms(), parameters.gravity, angle, chargeCoulombs());
            potential_points.push([angle_degrees, field * plateMeters() / 1000]);
            field_points.push([angle_degrees, field / 1000]);
            tension_points.push([angle_degrees, calc.threadTension(massKilograms(), parameters.gravity, angle) * 1000]);
        }
        const cursor = Math.abs(parameters.phi_degrees);
        const x_label = "φ (°)";
        graph.drawTimeGraph(document.getElementById("graph_potential"), [
            { label: "ΔV", color: "#1976d2", points: potential_points },
        ], { cursor_time: cursor, unit: "kV", x_label });
        graph.drawTimeGraph(document.getElementById("graph_field"), [
            { label: "E", color: "#26a69a", points: field_points },
        ], { cursor_time: cursor, unit: "kV/m", x_label });
        graph.drawTimeGraph(document.getElementById("graph_tension"), [
            { label: "T", color: "#8e24aa", points: tension_points },
        ], { cursor_time: cursor, unit: "mN", x_label });
    }

    /* render: draw the scene, formulas and graphs (static exercise) */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const state = drawScene(camera.transform());
        updateFormulas(state);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs();
        }
    }

    /* animationFrame: continuous redraw (camera interactions, game effects) */
    function animationFrame() {
        render();
        requestAnimationFrame(animationFrame);
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

    /* applyParameter: update a parameter and keep φ and ΔV consistent —
       editing φ drives ΔV, anything else drives φ from the kept ΔV */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        if (!Number.isFinite(value)) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        if (key === "phi_degrees") {
            syncPotentialFromAngle();
            setInputPair("delta_kilovolts", parameters.delta_kilovolts);
        } else {
            syncAngleFromPotential();
            setInputPair("phi_degrees", parameters.phi_degrees);
        }
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

    /* init: sync the linked pair, build controls, bind camera and language */
    function init() {
        syncPotentialFromAngle();
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
