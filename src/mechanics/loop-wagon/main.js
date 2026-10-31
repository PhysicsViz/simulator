/*
 * main.js — Wagon loop-the-loop page logic: fixed scene (no zoom or pan; the
 * rail is proportional to R, so the view is a fixed frame in units of R and the
 * picture never moves), ramp with its support, rail with ties, circular loop,
 * dimension lines h and H = 2R, the h_min = 5R/2 level, angle θ and radius in
 * the loop, traveled trace, predicted free flight after take-off, the wagon
 * with P / N / v / a drawn per unit mass so that a = P/m + N/m closes
 * graphically. The free space of the canvas holds the free-body diagram (P, N,
 * ΣF), the energy bars (E_c, E_p, E_m), a live readout (position on the rail, v,
 * N, n, verdict) and the legend: in a column right of the loop on wide
 * canvases, in a band above the rail on narrow ones. Transport over a
 * precomputed RK4 trajectory (rewound to t = 0 shortly after the end), compact
 * parameters (h ≤ 3R follows R, R, m, g), live formulas in the course notation
 * and one tabbed time graph (positions, speed, accelerations, normal force).
 * Classic script (works via file://); reads the globals of calcul.js,
 * canvas_draw.js and graph_plot.js.
 */
(() => {
    const calc = globalThis.loop_wagon_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Looping (wagon)", en: "Loop-the-loop (wagon)" },
        assumption: {
            fr: "Hypothèses : wagon = point matériel de masse m lâché sans vitesse à la hauteur h ; rail sans frottement, air négligé, g uniforme. Le wagon n'est pas retenu (pas de roues anti-décollage) : il quitte le rail dès que N = 0, puis suit une parabole (MRUA) jusqu'au rail, où la simulation s'arrête (choc non modélisé). Rampe à 60° partant de 3R, raccordée au sol par un arc de rayon R, piste de longueur R, looping circulaire de rayon R. φ : inclinaison du rail (en vol : direction de la vitesse), θ : angle depuis le bas du looping ; en vol, τ = t − t_d et u₀, v₀, x₀, y₀ sont les composantes de la vitesse et de la position au décollage. s(t) est intégré numériquement (RK4) ; v découle de la conservation de l'énergie.",
            en: "Assumptions: wagon = point mass m released from rest at height h; frictionless rail, air neglected, uniform g. The wagon is not held (no upstop wheels): it leaves the rail as soon as N = 0, then follows a parabola (constant acceleration) back to the rail, where the simulation stops (impact not modelled). 60° ramp starting at 3R, joined to the floor by an arc of radius R, run-in of length R, circular loop of radius R. φ: rail inclination (in flight: direction of the velocity), θ: angle from the bottom of the loop; in flight, τ = t − t_d and u₀, v₀, x₀, y₀ are the velocity and position components at take-off. s(t) is integrated numerically (RK4); v follows from energy conservation.",
        },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        graphs_title: { fr: "Graphe", en: "Graph" },
        graph_positions: { fr: "Positions x, y (m)", en: "Positions x, y (m)" },
        graph_speed: { fr: "Vitesse v (m/s)", en: "Speed v (m/s)" },
        graph_accelerations: { fr: "Accélérations a_θ, a_r (m/s²)", en: "Accelerations a_θ, a_r (m/s²)" },
        graph_normal: { fr: "Réaction N et poids P (N)", en: "Normal force N and weight P (N)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        start_height: { fr: "Hauteur de départ h", en: "Release height h" },
        loop_radius: { fr: "Rayon du looping R", en: "Loop radius R" },
        mass: { fr: "Masse du wagon m", en: "Wagon mass m" },
        gravity: { fr: "Pesanteur g", en: "Gravity g" },
        legend_weight: { fr: "Poids P", en: "Weight P" },
        legend_normal: { fr: "Réaction N", en: "Normal N" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        legend_force: { fr: "Résultante ΣF", en: "Net force ΣF" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        energy_title: { fr: "Énergie", en: "Energy" },
        state_title: { fr: "État", en: "State" },
        label_takeoff: { fr: "décollage (N = 0)", en: "take-off (N = 0)" },
        label_impact: { fr: "impact", en: "impact" },
        segment_incline: { fr: "rampe", en: "ramp" },
        segment_fillet: { fr: "raccord (r = R)", en: "fillet (r = R)" },
        segment_run_in: { fr: "piste", en: "run-in" },
        segment_loop: { fr: "looping, θ = {theta}°", en: "loop, θ = {theta}°" },
        segment_exit: { fr: "sortie", en: "exit" },
        segment_flight: { fr: "en vol (N = 0)", en: "in flight (N = 0)" },
        verdict_loops: { fr: "h ≥ 5R/2 : le wagon fait le tour", en: "h ≥ 5R/2: the wagon loops" },
        verdict_takeoff: { fr: "R < h < 5R/2 : décollage à θ_d = {theta}°", en: "R < h < 5R/2: take-off at θ_d = {theta}°" },
        verdict_back: { fr: "h ≤ R : demi-tour à θ = {theta}°", en: "h ≤ R: turns back at θ = {theta}°" },
        verdict_rest: { fr: "h = 0 : le wagon reste au repos", en: "h = 0: the wagon stays at rest" },
        formula_weight: { fr: "Poids", en: "Weight" },
        formula_speed: { fr: "Vitesse (énergie)", en: "Speed (energy)" },
        formula_a_theta: { fr: "Accélération tangentielle", en: "Tangential acceleration" },
        formula_a_r: { fr: "Accélération radiale", en: "Radial acceleration" },
        formula_normal: { fr: "Réaction normale", en: "Normal reaction" },
        formula_load: { fr: "Facteur de charge", en: "Load factor" },
        formula_top_speed: { fr: "Vitesse au sommet", en: "Speed at the top" },
        formula_top_minimum: { fr: "Vitesse minimale au sommet", en: "Minimum speed at the top" },
        formula_normal_top: { fr: "Réaction au sommet", en: "Reaction at the top" },
        formula_h_min: { fr: "Hauteur minimale (N_s ≥ 0)", en: "Minimum height (N_s ≥ 0)" },
        formula_takeoff: { fr: "Angle de décollage (N = 0)", en: "Take-off angle (N = 0)" },
        formula_flight: { fr: "Vol libre (MRU / MRUA)", en: "Free flight (uniform / uniformly accelerated)" },
        straight_line: { fr: "r = ∞ (droite) → 0", en: "r = ∞ (straight) → 0" },
        no_contact: { fr: "en vol : plus de contact", en: "in flight: no contact" },
        top_not_reached: { fr: "h < 2R : sommet non atteint", en: "h < 2R: top not reached" },
        leaves_before_top: { fr: "< 0 : décollage avant le sommet", en: "< 0: take-off before the top" },
        no_takeoff_loops: { fr: "h ≥ 5R/2 : pas de décollage", en: "h ≥ 5R/2: no take-off" },
        no_takeoff_low: { fr: "h ≤ R : N > 0, pas de décollage", en: "h ≤ R: N > 0, no take-off" },
        no_flight: { fr: "pas de vol pour ce h", en: "no flight for this h" },
        flight_later: { fr: "décollage à t = {t} s", en: "take-off at t = {t} s" },
        not_applicable: { fr: "—", en: "—" },
    };

    const parameter_config = [
        { key: "start_height", min: 0, max: 6, step: 0.01, unit: "m" },
        { key: "loop_radius", min: 0.5, max: 10, step: 0.1, unit: "m" },
        { key: "mass", min: 1, max: 1000, step: 1, unit: "kg" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        start_height: 5.5,
        loop_radius: 2,
        mass: 200,
        gravity: 9.81,
    };
    const GRAPHS = [
        { key: "positions", label: "x, y" },
        { key: "speed", label: "v" },
        { key: "accelerations", label: "a" },
        { key: "normal", label: "N" },
    ];

    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const END_HOLD_MILLISECONDS = 800;
    const MAX_DURATION = 30;
    const MAX_DURATION_CAP = 120;
    const SIMULATION_RATE = 240;
    const SUBSTEPS = 8;
    const GRAPH_STRIDE = 4;
    const FRAME = { left: -3.9, right: 3.35, bottom: -0.42, top: 3.32 };
    const COLUMN_START = 1.5;
    const BAND_MINIMUM = 190;
    const BOX_GAP = 8;
    const UI_REFERENCE_WIDTH = 1100;
    const UI_REFERENCE_HEIGHT = 560;
    const UI_SCALE_MIN = 1;
    const UI_SCALE_MAX = 1.8;
    const NARROW_WIDTH = 640;
    const STATE_BOX_HEIGHT = 74;
    const FORCE_LENGTH_RATIO = 0.9;
    const VELOCITY_LENGTH_RATIO = 0.8;
    const WAGON_LENGTH_RATIO = 0.42;
    const WEIGHT_COLOR = "#d32f2f";
    const NORMAL_COLOR = "#2e7d32";
    const TRACE_COLOR = "#1976d2";
    const CRITICAL_COLOR = "#00897b";
    const FLIGHT_COLOR = "#c2185b";
    const KINETIC_COLOR = "#1976d2";
    const POTENTIAL_COLOR = "#00897b";
    const MECHANICAL_COLOR = "#78909c";

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };

    let current_language = localStorage.getItem("simulator_language") || "fr";
    let simulation_time = 0;
    let is_playing = false;
    let playback_speed = 1;
    let last_frame_timestamp = null;
    let rewind_timestamp = null;
    let current_graph = "positions";
    let track = null;
    let rail_points = [];
    let ramp_points = [];
    let trajectory = null;
    let graph_series = null;
    let max_force_per_mass = 1;
    let max_speed = 1;
    let ui_scale = 1;

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN),
       true minus sign, no "−0,00" */
    function formatNumber(value) {
        const shown = Math.abs(value) < 0.005 ? 0 : value;
        return number_formatters[current_language].format(shown).replace("-", "−");
    }

    /* formatOperand: like formatNumber, but negative values are parenthesized */
    function formatOperand(value) {
        return value <= -0.005 ? `(${formatNumber(value)})` : formatNumber(value);
    }

    /* formatEnergy: energy in J below 1 kJ, in kJ above */
    function formatEnergy(value, reference) {
        return reference < 1000 ? `${formatNumber(value)} J` : `${formatNumber(value / 1000)} kJ`;
    }

    /* text: translated string with {name} placeholders filled */
    function text(key, values = {}) {
        return Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), strings[key][current_language]);
    }

    /* displayDegrees: inclination in degrees, the exit straight (phi = 2π) shown as 0° */
    function displayDegrees(phi) {
        const degrees = phi * 180 / Math.PI;
        return degrees > 359.995 ? degrees - 360 : degrees;
    }

    /* font: canvas font scaled with the canvas size (ui_scale) */
    function font(size, style = "") {
        return `${style} ${Math.round(size * ui_scale)}px system-ui, sans-serif`.trim();
    }

    /* px: a length in canvas pixels scaled with the canvas size */
    function px(length) {
        return length * ui_scale;
    }

    /* vector: shared arrow drawing with label font and stroke scaled like the scene */
    function vector(start_x, start_y, delta_x, delta_y, options) {
        draw.drawVector(context, start_x, start_y, delta_x, delta_y, {
            font: font(13, "bold"),
            ...options,
            line_width: (options.line_width ?? 2.5) * ui_scale,
        });
    }

    /* isDark: current color scheme */
    function isDark() {
        return matchMedia("(prefers-color-scheme: dark)").matches;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return isDark() ? "#e8ecf3" : "#1c2026";
    }

    /* runDuration: length of the run driving the clock */
    function runDuration() {
        /* Game mode hook — remove together with game.js */
        const game_duration = typeof globalThis.loop_wagon_game_duration === "function" ? globalThis.loop_wagon_game_duration() : null;
        return game_duration === null ? trajectory.duration : game_duration;
    }

    /* rebuild: rail, RK4 trajectory, vector scales and graph series for the current parameters */
    function rebuild() {
        track = calc.buildTrack(parameters.loop_radius, parameters.start_height);
        rail_points = [];
        for (const segment of track.segments) {
            const count = segment.kappa === 0 ? 2 : Math.max(Math.ceil(segment.length * segment.kappa / 0.02), 8);
            for (let i = rail_points.length === 0 ? 0 : 1; i <= count; i++) {
                rail_points.push(calc.pointAt(track, segment.s_start + segment.length * i / count));
            }
        }
        const ramp_end = track.segments[1].s_start + track.segments[1].length;
        ramp_points = rail_points.filter((point) => point.s <= ramp_end + 1e-9);
        const crawl_time = 8 * parameters.loop_radius / Math.sqrt(2 * parameters.gravity * Math.max(track.start_height, 1e-9));
        trajectory = calc.simulate(track, parameters.gravity, SIMULATION_RATE, SUBSTEPS, Math.min(Math.max(MAX_DURATION, crawl_time), MAX_DURATION_CAP));

        max_force_per_mass = parameters.gravity;
        max_speed = 1e-9;
        for (const sample of trajectory.samples) {
            max_force_per_mass = Math.max(max_force_per_mass, sample.normal_per_mass, Math.hypot(sample.a_theta, sample.a_r));
            max_speed = Math.max(max_speed, sample.speed);
        }
        graph_series = buildGraphSeries();
        document.getElementById("timeline").max = Math.max(trajectory.duration, 0.01);
        simulation_time = Math.min(simulation_time, trajectory.duration);
    }

    /* syncCanvasSize: internal resolution of a canvas matched to its displayed size */
    function syncCanvasSize(target) {
        const width = Math.round(target.clientWidth);
        const height = Math.round(target.clientHeight);
        if (width > 0 && height > 0 && (target.width !== width || target.height !== height)) {
            target.width = width;
            target.height = height;
        }
    }

    /* sceneLayout: fixed world→screen transform (frame in units of R, floor near the
       bottom) and the boxes of the overlays — a column right of the loop when the
       canvas is wide, a band above the scene when it is tall */
    function sceneLayout() {
        const width = canvas.width;
        const height = canvas.height;
        ui_scale = Math.min(Math.max(Math.min(width / UI_REFERENCE_WIDTH, height / UI_REFERENCE_HEIGHT), UI_SCALE_MIN), UI_SCALE_MAX);
        const gap = px(BOX_GAP);
        const frame_width = FRAME.right - FRAME.left;
        const frame_height = FRAME.top - FRAME.bottom;
        const scale = Math.min(width / frame_width, height / frame_height);
        const band = height - scale * frame_height;
        const stacked = band >= px(BAND_MINIMUM);
        const offset_x = stacked ? (width - scale * frame_width) / 2 : 0;
        const radius = parameters.loop_radius;
        const pixels_per_meter = scale / radius;
        const toScreenX = (x) => offset_x + (x / radius - FRAME.left) * scale;
        const toScreenY = (y) => height - (y / radius - FRAME.bottom) * scale;
        const transform = {
            toScreenX,
            toScreenY,
            pixels_per_meter,
            bounds: {
                left: (FRAME.left - offset_x / scale) * radius,
                right: (FRAME.left + (width - offset_x) / scale) * radius,
                bottom: FRAME.bottom * radius,
                top: (FRAME.bottom + height / scale) * radius,
            },
        };

        let boxes;
        if (stacked && width < px(NARROW_WIDTH)) {
            const half = (width - 3 * gap) / 2;
            const top_height = band - 3 * gap - px(STATE_BOX_HEIGHT);
            boxes = [
                { x: gap, y: gap, width: half, height: top_height },
                { x: 2 * gap + half, y: gap, width: half, height: top_height },
                { x: gap, y: 2 * gap + top_height, width: width - 2 * gap, height: px(STATE_BOX_HEIGHT) },
            ];
        } else if (stacked) {
            const box_width = (width - 4 * gap) / 3;
            const box_height = Math.min(band - 2 * gap, px(230));
            boxes = [0, 1, 2].map((k) => ({ x: gap + k * (box_width + gap), y: gap, width: box_width, height: box_height }));
        } else {
            const left = toScreenX(COLUMN_START * radius);
            const column_width = width - left - gap;
            const column_height = toScreenY(0.55 * radius) - 2 * gap;
            if (column_width >= px(290)) {
                const top_height = Math.min(0.62 * column_height, px(240));
                const half = (column_width - gap) / 2;
                boxes = [
                    { x: left, y: gap, width: half, height: top_height },
                    { x: left + half + gap, y: gap, width: half, height: top_height },
                    { x: left, y: 2 * gap + top_height, width: column_width, height: Math.min(column_height - top_height - gap, px(130)) },
                ];
            } else {
                const box_height = (column_height - 2 * gap) / 3;
                boxes = [0, 1, 2].map((k) => ({ x: left, y: gap + k * (box_height + gap), width: column_width, height: box_height }));
            }
        }
        return { transform, boxes: { free_body: boxes[0], energy: boxes[1], state: boxes[2] } };
    }

    /* accelerationVector: total acceleration a = a_θ t + (v²/r) n on the rail, (0, −g) in flight */
    function accelerationVector(state) {
        if (state.phase === "flight") {
            return { x: 0, y: -parameters.gravity };
        }
        const centripetal = -state.a_r;
        return {
            x: state.a_theta * Math.cos(state.phi) - centripetal * Math.sin(state.phi),
            y: state.a_theta * Math.sin(state.phi) + centripetal * Math.cos(state.phi),
        };
    }

    /* tracePath: polyline through world points */
    function tracePath(transform, points) {
        context.beginPath();
        points.forEach((point, index) => {
            const screen_x = transform.toScreenX(point.x);
            const screen_y = transform.toScreenY(point.y);
            if (index === 0) {
                context.moveTo(screen_x, screen_y);
            } else {
                context.lineTo(screen_x, screen_y);
            }
        });
    }

    /* drawGround: floor at y = 0 with a soft fill below */
    function drawGround(transform) {
        const ground_y = transform.toScreenY(0);
        context.save();
        const gradient = context.createLinearGradient(0, ground_y, 0, canvas.height);
        gradient.addColorStop(0, isDark() ? "rgba(140, 150, 165, 0.22)" : "rgba(120, 130, 145, 0.20)");
        gradient.addColorStop(1, "rgba(120, 130, 145, 0.04)");
        context.fillStyle = gradient;
        context.fillRect(0, ground_y, canvas.width, canvas.height - ground_y);
        context.strokeStyle = "rgba(120, 130, 145, 0.85)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, ground_y);
        context.lineTo(canvas.width, ground_y);
        context.stroke();
        context.restore();
    }

    /* drawRampSupport: hatched structure under the ramp */
    function drawRampSupport(transform) {
        const first = ramp_points[0];
        const last = ramp_points[ramp_points.length - 1];
        const bottom = transform.toScreenY(0);
        const top = transform.toScreenY(first.y);
        context.save();
        tracePath(transform, ramp_points);
        context.lineTo(transform.toScreenX(first.x), bottom);
        context.closePath();
        context.fillStyle = isDark() ? "rgba(161, 136, 127, 0.16)" : "rgba(141, 110, 99, 0.12)";
        context.fill();
        context.clip();
        context.strokeStyle = isDark() ? "rgba(161, 136, 127, 0.3)" : "rgba(141, 110, 99, 0.24)";
        context.lineWidth = 1;
        context.beginPath();
        for (let offset = transform.toScreenX(first.x) - (bottom - top); offset < transform.toScreenX(last.x); offset += 12) {
            context.moveTo(offset, bottom);
            context.lineTo(offset + (bottom - top), top);
        }
        context.stroke();
        context.restore();
    }

    /* drawDimension: vertical double arrow from y = 0 to a height, label rotated beside it */
    function drawDimension(transform, world_x, height, label, color, label_side) {
        if (height <= 0) {
            return;
        }
        const screen_x = transform.toScreenX(world_x);
        const bottom = transform.toScreenY(0);
        const top = transform.toScreenY(height);
        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 1.3;
        context.beginPath();
        context.moveTo(screen_x, bottom);
        context.lineTo(screen_x, top);
        context.moveTo(screen_x - 6, top);
        context.lineTo(screen_x + 6, top);
        context.stroke();
        for (const [tip_y, direction] of [[top, 1], [bottom, -1]]) {
            context.beginPath();
            context.moveTo(screen_x, tip_y);
            context.lineTo(screen_x - 4, tip_y + 7 * direction);
            context.lineTo(screen_x + 4, tip_y + 7 * direction);
            context.closePath();
            context.fill();
        }
        context.translate(screen_x + 10 * label_side, (top + bottom) / 2);
        context.rotate(-Math.PI / 2);
        context.font = font(12, "italic bold");
        context.textAlign = "center";
        context.textBaseline = label_side < 0 ? "bottom" : "top";
        context.fillText(label, 0, 0);
        context.restore();
    }

    /* drawMinimumHeight: dashed h_min = 5R/2 level across the scene */
    function drawMinimumHeight(transform) {
        const radius = parameters.loop_radius;
        const level_y = transform.toScreenY(calc.minimumHeight(radius));
        const left = transform.toScreenX(track.ramp_top_x + 0.35 * radius);
        const right = transform.toScreenX(1.1 * radius);
        context.save();
        context.strokeStyle = CRITICAL_COLOR;
        context.fillStyle = CRITICAL_COLOR;
        context.lineWidth = 1.4;
        context.setLineDash([7, 6]);
        context.beginPath();
        context.moveTo(left, level_y);
        context.lineTo(right, level_y);
        context.stroke();
        context.setLineDash([]);
        context.font = font(12, "bold");
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(`h_min = 5R/2 = ${formatNumber(calc.minimumHeight(radius))} m`, transform.toScreenX(-2.6 * radius), level_y - 4);
        context.restore();
    }

    /* drawRail: ties on the outer side, then a tube-like rail stroke */
    function drawRail(transform) {
        const tie_spacing = Math.max(0.14 * parameters.loop_radius, 14 / transform.pixels_per_meter);
        context.save();
        context.strokeStyle = isDark() ? "#a1887f" : "#8d6e63";
        context.lineWidth = 2;
        context.beginPath();
        for (let s = 0; s <= track.length; s += tie_spacing) {
            const point = calc.pointAt(track, s);
            const outer_x = Math.sin(point.phi);
            const outer_y = Math.cos(point.phi);
            const screen_x = transform.toScreenX(point.x);
            const screen_y = transform.toScreenY(point.y);
            context.moveTo(screen_x - outer_x * 3, screen_y - outer_y * 3);
            context.lineTo(screen_x + outer_x * 9, screen_y + outer_y * 9);
        }
        context.stroke();
        context.lineCap = "round";
        context.lineJoin = "round";
        tracePath(transform, rail_points);
        context.strokeStyle = isDark() ? "#8a96a8" : "#4a5568";
        context.lineWidth = 6;
        context.stroke();
        tracePath(transform, rail_points);
        context.strokeStyle = isDark() ? "#dfe6ef" : "#b8c2d0";
        context.lineWidth = 1.8;
        context.stroke();
        const end = rail_points[rail_points.length - 1];
        context.fillStyle = isDark() ? "#8a96a8" : "#4a5568";
        context.fillRect(transform.toScreenX(end.x) - 3, transform.toScreenY(end.y) - 16, 6, 16);
        context.restore();
    }

    /* drawLoopAngle: radius from the centre to the wagon and the angle θ from the bottom */
    function drawLoopAngle(transform, state, ink) {
        if (state.loop_angle === null) {
            return;
        }
        const radius = parameters.loop_radius;
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(radius);
        const arc_radius = 0.28 * radius * transform.pixels_per_meter;
        context.save();
        context.strokeStyle = ink;
        context.fillStyle = ink;
        context.globalAlpha = 0.7;
        context.lineWidth = 1.2;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(center_x, center_y);
        context.lineTo(center_x, transform.toScreenY(0));
        context.moveTo(center_x, center_y);
        context.lineTo(transform.toScreenX(state.x), transform.toScreenY(state.y));
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.arc(center_x, center_y, arc_radius, Math.PI / 2, Math.PI / 2 - state.loop_angle, true);
        context.stroke();
        context.globalAlpha = 1;
        context.font = font(12, "italic");
        context.textAlign = "center";
        context.textBaseline = "middle";
        const middle = state.loop_angle / 2;
        context.fillText("θ", center_x + (arc_radius + 10) * Math.sin(middle), center_y + (arc_radius + 10) * Math.cos(middle));
        context.beginPath();
        context.arc(center_x, center_y, 2.5, 0, 2 * Math.PI);
        context.fill();
        context.restore();
    }

    /* drawTrace: path already traveled up to the current time */
    function drawTrace(transform, time) {
        const traveled = [];
        for (let i = 0; i < trajectory.samples.length && trajectory.samples[i].time <= time; i += 2) {
            traveled.push(trajectory.samples[i]);
        }
        traveled.push(calc.sampleAt(trajectory, time));
        if (traveled.length < 2) {
            return;
        }
        context.save();
        context.strokeStyle = TRACE_COLOR;
        context.globalAlpha = 0.6;
        context.lineWidth = 2.4;
        context.lineCap = "round";
        tracePath(transform, traveled);
        context.stroke();
        context.restore();
    }

    /* drawPredictedFlight: dashed parabola from the take-off point to the impact */
    function drawPredictedFlight(transform) {
        if (trajectory.takeoff === null) {
            return;
        }
        const flight = trajectory.samples.filter((sample) => sample.phase === "flight");
        context.save();
        context.strokeStyle = FLIGHT_COLOR;
        context.fillStyle = FLIGHT_COLOR;
        context.lineWidth = 1.6;
        context.setLineDash([5, 5]);
        tracePath(transform, [trajectory.takeoff, ...flight]);
        context.stroke();
        context.setLineDash([]);
        const takeoff_x = transform.toScreenX(trajectory.takeoff.x);
        const takeoff_y = transform.toScreenY(trajectory.takeoff.y);
        context.lineWidth = 2;
        context.beginPath();
        context.arc(takeoff_x, takeoff_y, 6, 0, 2 * Math.PI);
        context.stroke();
        context.font = font(11, "bold");
        context.textAlign = Math.sin(trajectory.takeoff.phi) >= 0 ? "left" : "right";
        context.textBaseline = "middle";
        context.fillText(strings.label_takeoff[current_language], takeoff_x + Math.sin(trajectory.takeoff.phi) * 14, takeoff_y + Math.cos(trajectory.takeoff.phi) * 14);
        if (trajectory.end_reason === "impact") {
            const impact_x = transform.toScreenX(trajectory.impact.x);
            const impact_y = transform.toScreenY(trajectory.impact.y);
            context.beginPath();
            for (let k = 0; k < 16; k++) {
                const angle = (k * Math.PI) / 8;
                const spike = k % 2 === 0 ? 9 : 4;
                context.lineTo(impact_x + spike * Math.cos(angle), impact_y + spike * Math.sin(angle));
            }
            context.closePath();
            context.fill();
            context.textAlign = "center";
            context.textBaseline = "bottom";
            context.fillText(strings.label_impact[current_language], impact_x, impact_y - 11);
        }
        context.restore();
    }

    /* drawWagon: roller-coaster car whose wheels sit on the rail point, body on the
       normal side (toward the centre of curvature); size = car length in pixels */
    function drawWagon(screen_x, screen_y, phi, size) {
        const wheel = 0.11 * size;
        const body_height = 0.36 * size;
        context.save();
        context.translate(screen_x, screen_y);
        context.rotate(-phi);
        context.lineJoin = "round";
        context.fillStyle = "#f9a825";
        context.strokeStyle = "#8d5b00";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(-0.5 * size, -1.6 * wheel);
        context.lineTo(0.5 * size, -1.6 * wheel);
        context.lineTo(0.56 * size, -1.6 * wheel - body_height);
        context.lineTo(0.22 * size, -1.6 * wheel - body_height);
        context.lineTo(0.12 * size, -1.6 * wheel - 0.55 * body_height);
        context.lineTo(-0.34 * size, -1.6 * wheel - 0.55 * body_height);
        context.lineTo(-0.44 * size, -1.6 * wheel - body_height * 1.05);
        context.lineTo(-0.56 * size, -1.6 * wheel - body_height * 1.05);
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = "#c62828";
        context.fillRect(-0.48 * size, -1.6 * wheel - 0.32 * body_height, 0.98 * size, 0.12 * body_height);
        for (const offset of [-0.3, 0.3]) {
            context.beginPath();
            context.arc(offset * size, -wheel, wheel, 0, 2 * Math.PI);
            context.fillStyle = "#37474f";
            context.fill();
            context.beginPath();
            context.arc(offset * size, -wheel, 0.4 * wheel, 0, 2 * Math.PI);
            context.fillStyle = "#cfd8dc";
            context.fill();
        }
        context.restore();
        return { offset: 1.6 * wheel + 0.5 * body_height };
    }

    /* panelBox: rounded translucent card drawn on the canvas, with a title */
    function panelBox(box, title, ink) {
        context.save();
        context.fillStyle = isDark() ? "rgba(22, 27, 34, 0.9)" : "rgba(255, 255, 255, 0.9)";
        context.strokeStyle = "rgba(120, 130, 145, 0.45)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(box.x, box.y, box.width, box.height, px(8));
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = font(11, "bold");
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText(title.toUpperCase(), box.x + px(9), box.y + px(7));
        context.restore();
    }

    /* drawFreeBodyBox: the wagon alone with P, N and the resultant ΣF = m a */
    function drawFreeBodyBox(box, ink, state) {
        panelBox(box, strings.fbd_title[current_language], ink);
        const side_text = box.width > 1.5 * box.height;
        const area_width = side_text ? box.width * 0.55 : box.width;
        const area_height = box.height - px(24) - px(side_text ? 6 : 48);
        const center_x = box.x + area_width / 2;
        const center_y = box.y + px(24) + area_height / 2;
        const acceleration = accelerationVector(state);
        const net_per_mass = Math.hypot(acceleration.x, acceleration.y);
        const largest = Math.max(parameters.gravity, state.normal_per_mass, net_per_mass);
        const scale = 0.4 * Math.min(area_width, area_height) / largest;
        vector(center_x, center_y, 0, parameters.gravity * scale, { color: WEIGHT_COLOR, label: "P" });
        vector(center_x, center_y, -Math.sin(state.phi) * state.normal_per_mass * scale, -Math.cos(state.phi) * state.normal_per_mass * scale, { color: NORMAL_COLOR, label: "N" });
        vector(center_x, center_y, acceleration.x * scale, -acceleration.y * scale, { color: ink, line_width: 4, label: "ΣF" });
        context.save();
        context.fillStyle = "#f9a825";
        context.strokeStyle = "#8d5b00";
        context.beginPath();
        context.arc(center_x, center_y, px(6), 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.font = font(11);
        context.textAlign = side_text ? "left" : "center";
        context.textBaseline = "top";
        const text_x = side_text ? box.x + area_width : center_x;
        const lines_y = side_text ? box.y + box.height / 2 - px(18) : box.y + box.height - px(46);
        const lines = [
            { content: `P = ${formatNumber(parameters.mass * parameters.gravity)} N`, color: WEIGHT_COLOR },
            { content: `N = ${formatNumber(parameters.mass * state.normal_per_mass)} N`, color: NORMAL_COLOR },
            { content: `ΣF = ${formatNumber(parameters.mass * net_per_mass)} N`, color: ink },
        ];
        lines.forEach((line, k) => {
            context.fillStyle = line.color;
            context.fillText(line.content, text_x, lines_y + px(13) * k, box.width - px(side_text ? 6 : 8) - (side_text ? area_width : 0));
        });
        context.restore();
    }

    /* drawEnergyBox: bars of E_c, E_p and E_m (scale: E_m = m g h) */
    function drawEnergyBox(box, ink, state) {
        panelBox(box, strings.energy_title[current_language], ink);
        const energy = calc.energies(parameters.mass, parameters.gravity, state);
        const reference = Math.max(energy.mechanical, 1e-9);
        const bars = [
            { label: "E_c", value: energy.kinetic, color: KINETIC_COLOR },
            { label: "E_p", value: energy.potential, color: POTENTIAL_COLOR },
            { label: "E_m", value: energy.mechanical, color: MECHANICAL_COLOR },
        ];
        const top = box.y + px(28);
        const bottom = box.y + box.height - px(34);
        const slot = (box.width - px(16)) / bars.length;
        context.save();
        context.font = font(10);
        context.textAlign = "center";
        bars.forEach((bar, k) => {
            const center_x = box.x + px(8) + slot * (k + 0.5);
            const bar_height = Math.max(bar.value, 0) / reference * (bottom - top);
            context.fillStyle = bar.color;
            context.fillRect(center_x - 0.3 * slot, bottom - bar_height, 0.6 * slot, bar_height);
            context.fillStyle = ink;
            context.textBaseline = "top";
            context.font = font(11, "bold");
            context.fillText(bar.label, center_x, bottom + px(3));
            context.font = font(slot < px(60) ? 9 : 10);
            context.fillText(formatEnergy(bar.value, reference), center_x, bottom + px(17), slot - 2);
        });
        context.strokeStyle = "rgba(120, 130, 145, 0.6)";
        context.beginPath();
        context.moveTo(box.x + px(8), bottom + 0.5);
        context.lineTo(box.x + box.width - px(8), bottom + 0.5);
        context.stroke();
        context.restore();
    }

    /* verdictText: what this release height leads to (closed-form angles) */
    function verdictText() {
        const radius = parameters.loop_radius;
        const height = track.start_height;
        if (height <= 0) {
            return text("verdict_rest");
        }
        if (height >= calc.minimumHeight(radius)) {
            return text("verdict_loops");
        }
        if (height > radius) {
            return text("verdict_takeoff", { theta: formatNumber(calc.takeoffAngle(height, radius) * 180 / Math.PI) });
        }
        return text("verdict_back", { theta: formatNumber(calc.stopAngle(height, radius) * 180 / Math.PI) });
    }

    /* drawStateBox: where the wagon is, its speed, N and load factor, and the verdict */
    function drawStateBox(box, ink, state) {
        panelBox(box, strings.state_title[current_language], ink);
        const where = state.segment === "loop"
            ? text("segment_loop", { theta: formatNumber(state.loop_angle * 180 / Math.PI) })
            : text(`segment_${state.segment}`);
        const lines = [
            { content: where, color: ink },
            { content: `v = ${formatNumber(state.speed)} m/s   N = ${formatNumber(parameters.mass * state.normal_per_mass)} N   n = ${formatNumber(state.normal_per_mass / parameters.gravity)}`, color: ink },
            { content: verdictText(), color: track.start_height >= calc.minimumHeight(parameters.loop_radius) ? NORMAL_COLOR : FLIGHT_COLOR },
        ];
        context.save();
        context.textAlign = "left";
        context.textBaseline = "top";
        const line_height = Math.min(px(18), (box.height - px(28)) / lines.length);
        lines.forEach((line, k) => {
            context.font = k === 2 ? font(12, "bold") : font(12);
            context.fillStyle = line.color;
            context.fillText(line.content, box.x + px(9), box.y + px(26) + k * line_height, box.width - px(18));
        });
        context.restore();
    }

    /* drawLegend: vector color convention in the floor band, bottom left */
    function drawLegend(ink) {
        const items = [
            { key: "legend_weight", color: WEIGHT_COLOR, dash: [], width: 3 },
            { key: "legend_normal", color: NORMAL_COLOR, dash: [], width: 3 },
            { key: "legend_velocity", color: ink, dash: [6, 4], width: 2 },
            { key: "legend_acceleration", color: ink, dash: [2, 3], width: 2 },
            { key: "legend_force", color: ink, dash: [], width: 5 },
        ];
        context.save();
        context.font = font(11);
        context.textBaseline = "middle";
        context.textAlign = "left";
        let x = px(10);
        const y = canvas.height - px(11);
        for (const item of items) {
            context.strokeStyle = item.color;
            context.lineWidth = px(item.width);
            context.setLineDash(item.dash);
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + px(20), y);
            context.stroke();
            context.setLineDash([]);
            context.fillStyle = ink;
            const label = canvas.width < px(700) ? strings[item.key][current_language].split(" ").pop() : strings[item.key][current_language];
            context.fillText(label, x + px(25), y);
            x += px(25) + context.measureText(label).width + px(14);
        }
        context.restore();
    }

    /* drawScene: whole scene for the sample at the current time */
    function drawScene(time) {
        const ink = inkColor();
        const state = calc.sampleAt(trajectory, time);
        const radius = parameters.loop_radius;
        const { transform, boxes } = sceneLayout();

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds, { font: font(11) });
        drawGround(transform);
        drawRampSupport(transform);
        drawDimension(transform, track.ramp_top_x - 0.25 * radius, track.start_height, `h = ${formatNumber(track.start_height)} m`, ink, -1);
        drawDimension(transform, 1.25 * radius, track.loop_height, `H = 2R = ${formatNumber(track.loop_height)} m`, ink, 1);
        drawMinimumHeight(transform);
        drawRail(transform);
        drawLoopAngle(transform, state, ink);
        drawTrace(transform, time);
        drawPredictedFlight(transform);
        drawFreeBodyBox(boxes.free_body, ink, state);
        drawEnergyBox(boxes.energy, ink, state);
        drawStateBox(boxes.state, ink, state);
        drawLegend(ink);

        const wagon_size = WAGON_LENGTH_RATIO * radius * transform.pixels_per_meter;
        const rail_x = transform.toScreenX(state.x);
        const rail_y = transform.toScreenY(state.y);
        const wagon = drawWagon(rail_x, rail_y, state.phi, wagon_size);
        const center_x = rail_x - Math.sin(state.phi) * wagon.offset;
        const center_y = rail_y - Math.cos(state.phi) * wagon.offset;
        const force_scale = FORCE_LENGTH_RATIO * radius * transform.pixels_per_meter / max_force_per_mass;
        const velocity_scale = VELOCITY_LENGTH_RATIO * radius * transform.pixels_per_meter / max_speed;
        const acceleration = accelerationVector(state);
        vector(center_x, center_y, 0, parameters.gravity * force_scale, { color: WEIGHT_COLOR, label: "P" });
        vector(center_x, center_y, -Math.sin(state.phi) * state.normal_per_mass * force_scale, -Math.cos(state.phi) * state.normal_per_mass * force_scale, { color: NORMAL_COLOR, label: "N" });
        vector(center_x, center_y, acceleration.x * force_scale, -acceleration.y * force_scale, { color: ink, dash: [2, 4], line_width: 2, label: "a" });
        vector(center_x, center_y, state.velocity_x * velocity_scale, -state.velocity_y * velocity_scale, { color: ink, dash: [7, 5], line_width: 2, label: "v" });
        return state;
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(state) {
        const g = parameters.gravity;
        const m = parameters.mass;
        const h = track.start_height;
        const radius = parameters.loop_radius;
        const phi_degrees = displayDegrees(state.phi);
        const in_flight = state.phase === "flight";
        const weight = m * g;
        const normal = m * state.normal_per_mass;
        const top_speed = calc.topSpeed(g, h, radius);
        const top_normal = m * calc.topNormalPerMass(g, h, radius);
        const takeoff_angle = calc.takeoffAngle(h, radius);
        const curvature_radius = in_flight
            ? (Math.abs(Math.cos(state.phi)) > 1e-9 ? state.speed * state.speed / (g * Math.abs(Math.cos(state.phi))) : Infinity)
            : (state.kappa > 0 ? 1 / state.kappa : Infinity);
        const not_applicable = strings.not_applicable[current_language];

        let flight = { substitution: strings.no_flight[current_language], result: not_applicable };
        if (trajectory.takeoff !== null && !in_flight) {
            flight = { substitution: text("flight_later", { t: formatNumber(trajectory.takeoff.time) }), result: not_applicable };
        } else if (in_flight) {
            const takeoff = trajectory.takeoff;
            const tau = state.time - takeoff.time;
            flight = {
                substitution: `x = ${formatOperand(takeoff.velocity_x)} × ${formatNumber(tau)} + ${formatOperand(takeoff.x)} ; y = −${formatNumber(g)} × ${formatNumber(tau)}²/2 + ${formatOperand(takeoff.velocity_y)} × ${formatNumber(tau)} + ${formatNumber(takeoff.y)}`,
                result: `(${formatNumber(state.x)} ; ${formatNumber(state.y)}) m`,
            };
        }

        let takeoff = { substitution: `2 × (${formatNumber(radius)} − ${formatNumber(h)}) / (3 × ${formatNumber(radius)})`, result: "" };
        if (takeoff_angle === null) {
            takeoff.result = h >= calc.minimumHeight(radius) ? strings.no_takeoff_loops[current_language] : strings.no_takeoff_low[current_language];
        } else {
            takeoff.result = `${formatNumber(Math.cos(takeoff_angle))} → θ_d = ${formatNumber(takeoff_angle * 180 / Math.PI)}°`;
        }

        const cards = {
            weight: { substitution: `${formatNumber(m)} × ${formatNumber(g)}`, result: `${formatNumber(weight)} N` },
            speed: { substitution: `√(2 × ${formatNumber(g)} × (${formatNumber(h)} − ${formatOperand(state.y)}))`, result: `${formatNumber(state.speed)} m/s` },
            a_theta: { substitution: `−${formatNumber(g)} × sin(${formatNumber(phi_degrees)}°)`, result: `${formatNumber(state.a_theta)} m/s²` },
            a_r: {
                substitution: Number.isFinite(curvature_radius) ? `−${formatNumber(state.speed)}² / ${formatNumber(curvature_radius)}` : strings.straight_line[current_language],
                result: `${formatNumber(state.a_r)} m/s²`,
            },
            normal: {
                substitution: in_flight
                    ? strings.no_contact[current_language]
                    : `${formatNumber(m)} × (${Number.isFinite(curvature_radius) ? `${formatNumber(state.speed)}² / ${formatNumber(curvature_radius)}` : "0"} + ${formatNumber(g)} × cos(${formatNumber(phi_degrees)}°))`,
                result: `${formatNumber(normal)} N`,
            },
            load: { substitution: `${formatNumber(normal)} / ${formatNumber(weight)}`, result: formatNumber(normal / weight) },
            top_speed: {
                substitution: `√(2 × ${formatNumber(g)} × (${formatNumber(h)} − 2 × ${formatNumber(radius)}))`,
                result: top_speed === null ? strings.top_not_reached[current_language] : `${formatNumber(top_speed)} m/s`,
            },
            top_minimum: { substitution: `√(${formatNumber(g)} × ${formatNumber(radius)})`, result: `${formatNumber(Math.sqrt(g * radius))} m/s` },
            normal_top: {
                substitution: `${formatNumber(m)} × (2 × ${formatNumber(g)} × (${formatNumber(h)} − 2 × ${formatNumber(radius)}) / ${formatNumber(radius)} − ${formatNumber(g)})`,
                result: h < 2 * radius
                    ? strings.top_not_reached[current_language]
                    : (top_normal < 0 ? `${formatNumber(top_normal)} N ${strings.leaves_before_top[current_language]}` : `${formatNumber(top_normal)} N`),
            },
            h_min: { substitution: `5 × ${formatNumber(radius)} / 2`, result: `${formatNumber(calc.minimumHeight(radius))} m` },
            takeoff,
            flight,
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* buildGraphSeries: time series of the trajectory, rebuilt with it */
    function buildGraphSeries() {
        const series = { x: [], y: [], speed: [], a_theta: [], a_r: [], normal: [], weight: [] };
        const samples = trajectory.samples;
        for (let i = 0; i < samples.length; i += GRAPH_STRIDE) {
            pushSample(series, samples[i]);
        }
        if ((samples.length - 1) % GRAPH_STRIDE !== 0) {
            pushSample(series, samples[samples.length - 1]);
        }
        return series;
    }

    /* pushSample: append one trajectory sample to every series */
    function pushSample(series, sample) {
        series.x.push([sample.time, sample.x]);
        series.y.push([sample.time, sample.y]);
        series.speed.push([sample.time, sample.speed]);
        series.a_theta.push([sample.time, sample.a_theta]);
        series.a_r.push([sample.time, sample.a_r]);
        series.normal.push([sample.time, parameters.mass * sample.normal_per_mass]);
        series.weight.push([sample.time, parameters.mass * parameters.gravity]);
    }

    /* drawGraph: the selected time graph with the live cursor */
    function drawGraph(time) {
        const target = document.getElementById("graph_canvas");
        const definitions = {
            positions: { unit: "m", series: [{ label: "x", color: "#1976d2", points: graph_series.x }, { label: "y", color: "#d32f2f", points: graph_series.y }] },
            speed: { unit: "m/s", series: [{ label: "v", color: "#1976d2", points: graph_series.speed }] },
            accelerations: { unit: "m/s²", series: [{ label: "a_θ", color: "#1976d2", points: graph_series.a_theta }, { label: "a_r", color: "#d32f2f", points: graph_series.a_r }] },
            normal: { unit: "N", series: [{ label: "N", color: NORMAL_COLOR, points: graph_series.normal }, { label: "P", color: WEIGHT_COLOR, points: graph_series.weight }] },
        };
        const definition = definitions[current_graph];
        const graph_scale = Math.min(Math.max(Math.min(target.clientWidth / 260, target.clientHeight / 150), 0.85), 1.8);
        graph.drawTimeGraph(target, definition.series, { cursor_time: time, unit: definition.unit, scale: graph_scale });
    }

    /* render: draw the scene and the graph, refresh time display, timeline and formulas */
    function render() {
        syncCanvasSize(canvas);
        const time = Math.min(simulation_time, runDuration());
        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        document.getElementById("timeline").value = time;
        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.loop_wagon_game_overlay === "function" && globalThis.loop_wagon_game_overlay(context, { time, playing: is_playing })) {
            return;
        }
        const state = drawScene(time);
        updateFormulas(state);
        drawGraph(time);
    }

    /* animationFrame: advance simulation time while playing (the end of the run is
       held briefly, then rewound to t = 0), then render */
    function animationFrame(timestamp) {
        if (is_playing) {
            if (last_frame_timestamp !== null) {
                const delta_seconds = Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
                simulation_time += delta_seconds * playback_speed;
                if (simulation_time >= runDuration()) {
                    simulation_time = runDuration();
                    setPlaying(false);
                    rewind_timestamp = timestamp + END_HOLD_MILLISECONDS;
                }
            }
            last_frame_timestamp = timestamp;
        }
        if (rewind_timestamp !== null && timestamp >= rewind_timestamp) {
            rewind_timestamp = null;
            simulation_time = 0;
        }
        render();
        requestAnimationFrame(animationFrame);
    }

    /* setPlaying: toggle play state and keep the button label in sync */
    function setPlaying(playing) {
        rewind_timestamp = null;
        is_playing = playing;
        last_frame_timestamp = null;
        document.getElementById("play_pause_button").textContent = playing ? strings.pause[current_language] : strings.play[current_language];
    }

    /* stepTime: shift simulation time by a signed amount, clamped to the run */
    function stepTime(delta_seconds) {
        rewind_timestamp = null;
        simulation_time = Math.min(Math.max(simulation_time + delta_seconds, 0), runDuration());
    }

    /* buildControls: one compact row (label, number, unit, slider) per parameter */
    function buildControls() {
        const container = document.getElementById("parameter_rows");
        for (const config of parameter_config) {
            const row = document.createElement("div");
            row.className = "parameter-row";
            const head = document.createElement("div");
            head.className = "row-head";
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
            head.append(label, value_wrap);
            row.append(head, slider);
            container.append(row);
        }
        syncHeightRange();
    }

    /* syncHeightRange: h ranges over [0, 3R] (the top of the ramp); h is clamped
       when R shrinks */
    function syncHeightRange() {
        const maximum = calc.RAMP_HEIGHT_RATIO * parameters.loop_radius;
        parameter_config[0].max = maximum;
        parameters.start_height = Math.min(parameters.start_height, maximum);
        for (const prefix of ["slider", "number"]) {
            const input = document.getElementById(`${prefix}_start_height`);
            input.max = maximum;
            input.value = parameters.start_height;
        }
    }

    /* applyParameter: update a parameter from either input, mirror it, rebuild the trajectory */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        const config = parameter_config.find((entry) => entry.key === key);
        if (raw_value === "" || !Number.isFinite(value) || value < config.min || value > config.max) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        if (key === "loop_radius") {
            syncHeightRange();
        }
        rebuild();
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

    /* buildGraphTabs: one button per time graph */
    function buildGraphTabs() {
        const container = document.getElementById("graph_tabs");
        for (const definition of GRAPHS) {
            const button = document.createElement("button");
            button.type = "button";
            button.id = `graph_tab_${definition.key}`;
            button.textContent = definition.label;
            button.classList.toggle("active", definition.key === current_graph);
            button.addEventListener("click", () => {
                current_graph = definition.key;
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
        for (const definition of GRAPHS) {
            document.getElementById(`graph_tab_${definition.key}`).title = strings[`graph_${definition.key}`][language];
        }
        document.getElementById("language_toggle").textContent = language === "fr" ? "EN" : "FR";
        setPlaying(is_playing);
    }

    /* init: build controls, bind transport and language, start the render loop */
    function init() {
        buildControls();
        buildSpeedButtons();
        buildGraphTabs();
        document.getElementById("play_pause_button").addEventListener("click", () => {
            if (!is_playing && simulation_time >= runDuration()) {
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
            rewind_timestamp = null;
            simulation_time = Number(event.target.value);
        });
        document.getElementById("language_toggle").addEventListener("click", () => {
            applyLanguage(current_language === "fr" ? "en" : "fr");
        });
        rebuild();
        applyLanguage(current_language);
        requestAnimationFrame(animationFrame);
    }

    init();
})();
