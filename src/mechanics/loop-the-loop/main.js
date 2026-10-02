/*
 * main.js — Loop-the-loop page logic: animated scene (ramp with its support,
 * rail with ties, circular or clothoid loop, dimension lines h and H, the h_min
 * level with its critical point, traveled trace, predicted free-fall flight
 * after take-off, osculating circle of radius r at the ball, P / N / v / a
 * vectors drawn per unit mass so that a = P/m + N/m closes graphically, and a
 * free-body inset with the resultant), shared pan/zoom camera, transport over
 * a precomputed RK4 trajectory, parameters (loop shape, release height h, loop
 * radius R, mass m, g), live formulas in the course notation (a_θ = −g sin(φ),
 * a_r = −v²/r, N = m (v²/r + g cos(φ)), energy, h_min, MRUA flight) and time
 * graphs of positions, speed, accelerations and normal force. Classic script
 * (works via file://); reads the globals of calcul.js, canvas_draw.js,
 * scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.loop_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Looping", en: "Loop-the-loop" },
        assumption: {
            fr: "Hypothèses : bille ponctuelle de masse m lâchée sans vitesse initiale à la hauteur h ; rail sans frottement, résistance de l'air négligée, g uniforme. La bille n'est pas retenue par le rail : elle le quitte dès que la réaction normale N s'annule, puis tombe en chute libre (MRUA) jusqu'à retoucher le rail, où la simulation s'arrête (choc non modélisé). Rampe en arc de cercle de 60° (rayon 2h), piste horizontale de longueur R, puis looping circulaire de rayon R ou clothoïde de même hauteur H = 2R (courbure proportionnelle à la distance parcourue : r → ∞ à l'entrée, r minimal au sommet). φ est l'inclinaison du rail (angle de la vitesse avec l'horizontale) et r le rayon de courbure local. Le mouvement s(t) le long du rail est intégré numériquement (RK4) ; v découle de la conservation de l'énergie mécanique.",
            en: "Assumptions: point ball of mass m released from rest at height h; frictionless rail, air resistance neglected, uniform g. The ball is not held on the rail: it leaves it as soon as the normal reaction N vanishes, then falls freely (constant acceleration) until it touches the rail again, where the simulation stops (impact not modelled). 60° circular-arc ramp (radius 2h), horizontal run of length R, then a circular loop of radius R or a clothoid of the same height H = 2R (curvature proportional to the distance travelled: r → ∞ at the entry, smallest r at the top). φ is the rail inclination (angle of the velocity with the horizontal) and r the local radius of curvature. The motion s(t) along the rail is integrated numerically (RK4); v follows from conservation of mechanical energy.",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Paramètres", en: "Parameters" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_positions: { fr: "Positions x, y (m)", en: "Positions x, y (m)" },
        graph_speed: { fr: "Vitesse v (m/s)", en: "Speed v (m/s)" },
        graph_accelerations: { fr: "Accélérations a_θ, a_r (m/s²)", en: "Accelerations a_θ, a_r (m/s²)" },
        graph_normal: { fr: "Force normale N et poids P (N)", en: "Normal force N and weight P (N)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au parcours", en: "Fit view to the track" },
        shape: { fr: "Forme du looping", en: "Loop shape" },
        shape_circle: { fr: "Cercle", en: "Circle" },
        shape_clothoid: { fr: "Clothoïde (optimale)", en: "Clothoid (optimal)" },
        start_height: { fr: "Hauteur de départ h", en: "Release height h" },
        loop_radius: { fr: "Rayon du looping R (H = 2R)", en: "Loop radius R (H = 2R)" },
        mass: { fr: "Masse m", en: "Mass m" },
        gravity: { fr: "Accélération de pesanteur g", en: "Gravitational acceleration g" },
        legend_weight: { fr: "Poids P", en: "Weight P" },
        legend_normal: { fr: "Réaction normale N", en: "Normal reaction N" },
        legend_velocity: { fr: "Vitesse v", en: "Velocity v" },
        legend_acceleration: { fr: "Accélération a", en: "Acceleration a" },
        legend_force: { fr: "Résultante ΣF", en: "Net force ΣF" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
        label_takeoff: { fr: "décollage (N = 0)", en: "take-off (N = 0)" },
        label_impact: { fr: "impact", en: "impact" },
        label_critical: { fr: "point critique", en: "critical point" },
        label_flight: { fr: "en vol", en: "in flight" },
        formula_weight: { fr: "Poids", en: "Weight" },
        formula_speed: { fr: "Vitesse (conservation de l'énergie)", en: "Speed (energy conservation)" },
        formula_a_theta: { fr: "Accélération tangentielle", en: "Tangential acceleration" },
        formula_a_r: { fr: "Accélération radiale (vers le centre de courbure)", en: "Radial acceleration (toward the centre of curvature)" },
        formula_normal: { fr: "Réaction normale du rail", en: "Normal reaction of the rail" },
        formula_load: { fr: "Facteur de charge", en: "Load factor" },
        formula_top_speed: { fr: "Vitesse minimale au sommet", en: "Minimum speed at the top" },
        formula_normal_top: { fr: "Réaction au sommet (v_s² = 2 g (h − H))", en: "Reaction at the top (v_s² = 2 g (h − H))" },
        formula_h_min: { fr: "Hauteur minimale (N ≥ 0 partout)", en: "Minimum height (N ≥ 0 everywhere)" },
        formula_position: { fr: "Abscisse curviligne s(t)", en: "Arc length s(t)" },
        formula_flight_x: { fr: "Vol libre : horizontale (MRU)", en: "Free flight: horizontal (uniform)" },
        formula_flight_y: { fr: "Vol libre : verticale (MRUA)", en: "Free flight: vertical (uniformly accelerated)" },
        straight_line: { fr: "r = ∞ (ligne droite) → 0", en: "r = ∞ (straight line) → 0" },
        no_contact: { fr: "en vol : plus de contact", en: "in flight: no contact" },
        top_not_reached: { fr: "h < H : sommet non atteint", en: "h < H: top not reached" },
        leaves_before_top: { fr: "< 0 : la bille quitte le rail avant", en: "< 0: the ball leaves the rail before" },
        rk4_note: { fr: "intégration numérique (RK4)", en: "numerical integration (RK4)" },
        flight_note: { fr: "vol libre depuis le décollage", en: "free flight since take-off" },
        no_takeoff: { fr: "aucun décollage pour ce h", en: "no take-off for this h" },
        takeoff_later: { fr: "décollage à t = {t} s", en: "take-off at t = {t} s" },
        not_applicable: { fr: "—", en: "—" },
    };

    const SHAPES = ["circle", "clothoid"];
    const parameter_config = [
        { key: "start_height", min: 0, max: 20, step: 0.01, unit: "m" },
        { key: "loop_radius", min: 0.2, max: 5, step: 0.1, unit: "m" },
        { key: "mass", min: 0.1, max: 5, step: 0.1, unit: "kg" },
        { key: "gravity", min: 1, max: 25, step: 0.01, unit: "m/s²" },
    ];
    const parameters = {
        shape: "circle",
        start_height: 3,
        loop_radius: 1,
        mass: 1,
        gravity: 9.81,
    };

    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const MAX_DURATION = 20;
    const SIMULATION_RATE = 240;
    const SUBSTEPS = 8;
    const GRAPH_STRIDE = 4;
    const FORCE_LENGTH_RATIO = 1.2;
    const FIT_MARGIN_X = 150;
    const FIT_MARGIN_Y = 120;
    const VELOCITY_LENGTH_RATIO = 0.8;
    const WEIGHT_COLOR = "#d32f2f";
    const NORMAL_COLOR = "#2e7d32";
    const TRACE_COLOR = "#1976d2";
    const CRITICAL_COLOR = "#00897b";
    const FLIGHT_COLOR = "#c2185b";

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
    let track = null;
    let rail_points = [];
    let rail_parts = null;
    let graph_series = null;
    let critical = null;
    let trajectory = null;
    let extent = null;
    let max_force_per_mass = 1;
    let max_speed = 1;

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* formatOperand: like formatNumber, but negative values are parenthesized */
    function formatOperand(value) {
        return value < 0 ? `(${formatNumber(value)})` : formatNumber(value);
    }

    /* displayDegrees: inclination in degrees, the exit straight (phi = 2π) shown as 0° */
    function displayDegrees(phi) {
        const degrees = phi * 180 / Math.PI;
        return degrees > 359.995 ? degrees - 360 : degrees;
    }

    /* isDark: current color scheme */
    function isDark() {
        return matchMedia("(prefers-color-scheme: dark)").matches;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return isDark() ? "#e8ecf3" : "#1c2026";
    }

    /* rebuild: rail, critical point, RK4 trajectory and vector scales for the current parameters */
    function rebuild() {
        track = calc.buildTrack(parameters.shape, parameters.loop_radius, parameters.start_height);
        rail_points = calc.trackSamples(track);
        const half = (track.loop_start + track.loop_end) / 2;
        rail_parts = {
            ramp: track.segments[0].name === "ramp" ? rail_points.filter((point) => point.s <= track.segments[0].length) : [],
            behind: rail_points.filter((point) => point.s >= half && point.s <= track.loop_end),
            before: rail_points.filter((point) => point.s <= half),
            after: rail_points.filter((point) => point.s >= track.loop_end),
        };
        critical = calc.minimumHeight(track);
        trajectory = calc.simulate(track, parameters.gravity, SIMULATION_RATE, SUBSTEPS, MAX_DURATION);

        extent = { min_x: Infinity, max_x: -Infinity, max_y: 0, loop_min_x: Infinity, loop_max_x: -Infinity };
        for (const point of rail_points) {
            extent.min_x = Math.min(extent.min_x, point.x);
            extent.max_x = Math.max(extent.max_x, point.x);
            extent.max_y = Math.max(extent.max_y, point.y);
            if (point.s >= track.loop_start && point.s <= track.loop_end) {
                extent.loop_min_x = Math.min(extent.loop_min_x, point.x);
                extent.loop_max_x = Math.max(extent.loop_max_x, point.x);
            }
        }

        max_force_per_mass = parameters.gravity;
        max_speed = 1e-9;
        for (const sample of trajectory.samples) {
            max_force_per_mass = Math.max(max_force_per_mass, sample.normal_per_mass, Math.hypot(sample.a_theta, sample.a_r));
            max_speed = Math.max(max_speed, sample.speed);
        }

        graph_series = buildGraphSeries();
        const timeline = document.getElementById("timeline");
        timeline.max = Math.max(trajectory.duration, 0.01);
        simulation_time = Math.min(simulation_time, trajectory.duration);
    }

    /* fitView: frame ramp, loop, exit run, dimension lines and the release height;
       spare vertical room goes above the scene so the floor stays near the bottom */
    function fitView() {
        const radius = parameters.loop_radius;
        /* Game mode hook — remove together with game.js */
        const game_extent = typeof globalThis.loop_game_view_extent === "function" ? globalThis.loop_game_view_extent() : null;
        const rect = game_extent !== null ? game_extent : {
            left: extent.min_x - 0.7 * radius,
            right: Math.max(extent.max_x, extent.loop_max_x + 0.9 * radius),
            bottom: -0.25 * radius,
            top: Math.max(parameters.start_height, extent.max_y) + 0.35 * radius,
        };
        const usable_width = canvas.width - FIT_MARGIN_X;
        const usable_height = canvas.height - FIT_MARGIN_Y;
        const width_limited_scale = usable_width / (rect.right - rect.left);
        if (width_limited_scale * (rect.top - rect.bottom) < usable_height) {
            rect.top = rect.bottom + usable_height / width_limited_scale;
        }
        camera.fitTo(rect);
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
        const gradient = context.createLinearGradient(0, ground_y, 0, ground_y + 60);
        gradient.addColorStop(0, isDark() ? "rgba(140, 150, 165, 0.22)" : "rgba(120, 130, 145, 0.20)");
        gradient.addColorStop(1, "rgba(120, 130, 145, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, ground_y, canvas.width, Math.max(canvas.height - ground_y, 0));
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
        const ramp = rail_parts.ramp;
        if (ramp.length < 2) {
            return;
        }
        context.save();
        tracePath(transform, ramp);
        context.lineTo(transform.toScreenX(ramp[0].x), transform.toScreenY(0));
        context.closePath();
        context.fillStyle = isDark() ? "rgba(161, 136, 127, 0.14)" : "rgba(141, 110, 99, 0.10)";
        context.fill();
        context.clip();
        context.strokeStyle = isDark() ? "rgba(161, 136, 127, 0.28)" : "rgba(141, 110, 99, 0.22)";
        context.lineWidth = 1;
        context.beginPath();
        const left = transform.toScreenX(ramp[0].x);
        const top = transform.toScreenY(ramp[0].y);
        const bottom = transform.toScreenY(0);
        for (let offset = left - (bottom - top); offset < transform.toScreenX(ramp[ramp.length - 1].x); offset += 12) {
            context.moveTo(offset, bottom);
            context.lineTo(offset + (bottom - top), top);
        }
        context.stroke();
        context.restore();
    }

    /* drawDimension: vertical double arrow from y = 0 to a height, with a label */
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
            context.lineTo(screen_x - 4, tip_y + 8 * direction);
            context.lineTo(screen_x + 4, tip_y + 8 * direction);
            context.closePath();
            context.fill();
        }
        context.font = "italic bold 13px system-ui, sans-serif";
        context.textAlign = label_side < 0 ? "right" : "left";
        context.textBaseline = "middle";
        context.fillText(label, screen_x + 8 * label_side, (top + bottom) / 2);
        context.restore();
    }

    /* drawMinimumHeight: h_min level and the critical point where N first vanishes */
    function drawMinimumHeight(transform) {
        if (critical === null) {
            return;
        }
        const level_y = transform.toScreenY(critical.height);
        context.save();
        context.strokeStyle = CRITICAL_COLOR;
        context.fillStyle = CRITICAL_COLOR;
        context.lineWidth = 1.4;
        context.setLineDash([7, 6]);
        context.beginPath();
        context.moveTo(transform.toScreenX(extent.min_x - 0.5 * parameters.loop_radius), level_y);
        context.lineTo(transform.toScreenX(extent.loop_max_x + 0.2 * parameters.loop_radius), level_y);
        context.stroke();
        context.setLineDash([]);
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "right";
        context.textBaseline = "bottom";
        context.fillText(`h_min = ${formatNumber(critical.height)} m`, transform.toScreenX(extent.loop_max_x + 0.2 * parameters.loop_radius), level_y - 4);

        const point_x = transform.toScreenX(critical.x);
        const point_y = transform.toScreenY(critical.y);
        context.beginPath();
        context.moveTo(point_x, point_y - 6);
        context.lineTo(point_x + 6, point_y);
        context.lineTo(point_x, point_y + 6);
        context.lineTo(point_x - 6, point_y);
        context.closePath();
        context.fill();
        context.font = "11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
            strings.label_critical[current_language],
            point_x + Math.sin(critical.phi) * 20,
            point_y + Math.cos(critical.phi) * 20,
        );
        context.restore();
    }

    /* drawRailPath: ties on the outer side, then a tube-like rail stroke */
    function drawRailPath(transform, points, alpha) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const tie_spacing = Math.max(0.12 * parameters.loop_radius, 14 / pixels_per_meter);
        context.save();
        context.globalAlpha = alpha;
        context.strokeStyle = isDark() ? "#a1887f" : "#8d6e63";
        context.lineWidth = 2;
        context.beginPath();
        let next_tie = points[0].s;
        for (const point of points) {
            if (point.s < next_tie) {
                continue;
            }
            next_tie = point.s + tie_spacing;
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
        tracePath(transform, points);
        context.strokeStyle = isDark() ? "#8a96a8" : "#4a5568";
        context.lineWidth = 6;
        context.stroke();
        tracePath(transform, points);
        context.strokeStyle = isDark() ? "#dfe6ef" : "#b8c2d0";
        context.lineWidth = 1.8;
        context.stroke();
        context.restore();
    }

    /* drawRail: for the clothoid the descending half crosses the ascending one, so
       it is drawn first and dimmed, as if laterally offset behind it */
    function drawRail(transform) {
        if (track.shape === "clothoid") {
            drawRailPath(transform, rail_parts.behind, 0.7);
            drawRailPath(transform, rail_parts.after, 1);
            drawRailPath(transform, rail_parts.before, 1);
            return;
        }
        drawRailPath(transform, rail_points, 1);
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
        context.globalAlpha = 0.85;
        context.lineWidth = 2.6;
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
        context.lineWidth = 2.2;
        context.beginPath();
        context.arc(takeoff_x, takeoff_y, 7, 0, 2 * Math.PI);
        context.stroke();
        context.font = "bold 11px system-ui, sans-serif";
        context.textAlign = Math.sin(trajectory.takeoff.phi) >= 0 ? "left" : "right";
        context.textBaseline = "middle";
        context.fillText(
            strings.label_takeoff[current_language],
            takeoff_x + Math.sin(trajectory.takeoff.phi) * 14,
            takeoff_y + Math.cos(trajectory.takeoff.phi) * 14,
        );

        if (trajectory.impact !== null && trajectory.end_reason === "impact") {
            const impact_x = transform.toScreenX(trajectory.impact.x);
            const impact_y = transform.toScreenY(trajectory.impact.y);
            context.beginPath();
            for (let k = 0; k < 16; k++) {
                const angle = (k * Math.PI) / 8;
                const radius = k % 2 === 0 ? 9 : 4;
                context.lineTo(impact_x + radius * Math.cos(angle), impact_y + radius * Math.sin(angle));
            }
            context.closePath();
            context.fill();
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings.label_impact[current_language], impact_x, impact_y + 11);
        }
        context.restore();
    }

    /* drawCurvatureCircle: osculating circle of radius r at the ball, center on the normal */
    function drawCurvatureCircle(transform, state) {
        if (state.phase !== "rail" || state.kappa <= 1 / (8 * parameters.loop_radius)) {
            return;
        }
        const radius = 1 / state.kappa;
        const center_x = state.x - Math.sin(state.phi) * radius;
        const center_y = state.y + Math.cos(state.phi) * radius;
        const screen_center_x = transform.toScreenX(center_x);
        const screen_center_y = transform.toScreenY(center_y);
        const screen_ball_x = transform.toScreenX(state.x);
        const screen_ball_y = transform.toScreenY(state.y);
        const radius_pixels = radius * (transform.toScreenX(1) - transform.toScreenX(0));
        context.save();
        context.strokeStyle = isDark() ? "rgba(144, 202, 249, 0.45)" : "rgba(25, 118, 210, 0.35)";
        context.fillStyle = context.strokeStyle;
        context.lineWidth = 1.2;
        context.setLineDash([3, 5]);
        context.beginPath();
        context.arc(screen_center_x, screen_center_y, radius_pixels, 0, 2 * Math.PI);
        context.moveTo(screen_center_x, screen_center_y);
        context.lineTo(screen_ball_x, screen_ball_y);
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.arc(screen_center_x, screen_center_y, 3, 0, 2 * Math.PI);
        context.fill();
        context.fillStyle = isDark() ? "#90caf9" : "#1565c0";
        context.font = "italic bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.textAlign = screen_ball_x >= screen_center_x ? "right" : "left";
        context.fillText(`r = ${formatNumber(radius)} m`, screen_center_x + (screen_ball_x >= screen_center_x ? -6 : 6), screen_center_y + 12);
        context.restore();
    }

    /* drawBall: shaded sphere */
    function drawBall(screen_x, screen_y, radius) {
        context.save();
        const gradient = context.createRadialGradient(screen_x - radius * 0.35, screen_y - radius * 0.35, radius * 0.1, screen_x, screen_y, radius);
        gradient.addColorStop(0, "#bbdefb");
        gradient.addColorStop(0.45, "#42a5f5");
        gradient.addColorStop(1, "#0d47a1");
        context.fillStyle = gradient;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(screen_x, screen_y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.restore();
    }

    /* drawScene: whole scene for the sample at the current time */
    function drawScene(transform, time) {
        const ink = inkColor();
        const state = calc.sampleAt(trajectory, time);
        const radius = parameters.loop_radius;
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        /* Game mode hook — remove together with game.js */
        const hide_answer = document.body.classList.contains("game-mode");

        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawGround(transform);
        drawRampSupport(transform);
        drawDimension(transform, extent.min_x - 0.3 * radius, parameters.start_height, `h = ${formatNumber(parameters.start_height)} m`, ink, -1);
        drawDimension(transform, extent.loop_max_x + 0.35 * radius, track.loop_height, `H = ${formatNumber(track.loop_height)} m`, ink, 1);
        if (!hide_answer) {
            drawMinimumHeight(transform);
        }
        drawRail(transform);
        drawTrace(transform, time);
        if (!hide_answer) {
            drawPredictedFlight(transform);
        }
        drawCurvatureCircle(transform, state);

        const ball_x = transform.toScreenX(state.x);
        const ball_y = transform.toScreenY(state.y);
        const force_scale = FORCE_LENGTH_RATIO * radius * pixels_per_meter / max_force_per_mass;
        const velocity_scale = VELOCITY_LENGTH_RATIO * radius * pixels_per_meter / max_speed;
        const acceleration = accelerationVector(state);
        const normal_x = -Math.sin(state.phi) * state.normal_per_mass;
        const normal_y = Math.cos(state.phi) * state.normal_per_mass;

        draw.drawVector(context, ball_x, ball_y, 0, parameters.gravity * force_scale, { color: WEIGHT_COLOR, label: "P" });
        draw.drawVector(context, ball_x, ball_y, normal_x * force_scale, -normal_y * force_scale, { color: NORMAL_COLOR, label: "N" });
        draw.drawVector(context, ball_x, ball_y, acceleration.x * force_scale, -acceleration.y * force_scale, {
            color: ink,
            dash: [2, 4],
            line_width: 2,
            label: "a",
        });
        draw.drawVector(context, ball_x, ball_y, state.velocity_x * velocity_scale, -state.velocity_y * velocity_scale, {
            color: ink,
            dash: [7, 5],
            line_width: 2,
            label: "v",
        });

        const ball_radius = Math.min(Math.max(0.08 * radius * pixels_per_meter, 7), 14);
        if (!hide_answer) {
            drawBall(ball_x, ball_y, ball_radius);
        }

        drawFreeBodyInset(ink, state);

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.loop_game_overlay === "function") {
            globalThis.loop_game_overlay(context, transform, {
                time,
                state,
                track,
                trajectory,
                shape: parameters.shape,
                start_height: parameters.start_height,
                loop_radius: radius,
                mass: parameters.mass,
                gravity: parameters.gravity,
                ball_radius,
            });
        }
        return { state, hide_answer };
    }

    /* drawFreeBodyInset: ball alone with P, N and the resultant ΣF = m a */
    function drawFreeBodyInset(ink, state) {
        const box_width = 168;
        const box_height = 236;
        const box_x = canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 100;
        const acceleration = accelerationVector(state);
        const net_per_mass = Math.hypot(acceleration.x, acceleration.y);
        const largest = Math.max(parameters.gravity, state.normal_per_mass, net_per_mass);
        const scale = 55 / largest;

        context.save();
        context.fillStyle = isDark() ? "rgba(22, 27, 34, 0.92)" : "rgba(255, 255, 255, 0.92)";
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
        context.restore();

        draw.drawVector(context, center_x, center_y, 0, parameters.gravity * scale, { color: WEIGHT_COLOR, label: "P" });
        draw.drawVector(context, center_x, center_y, -Math.sin(state.phi) * state.normal_per_mass * scale, -Math.cos(state.phi) * state.normal_per_mass * scale, {
            color: NORMAL_COLOR,
            label: "N",
        });
        draw.drawVector(context, center_x, center_y, acceleration.x * scale, -acceleration.y * scale, {
            color: ink,
            line_width: 4,
            label: "ΣF",
        });
        drawBall(center_x, center_y, 9);

        const weight = parameters.mass * parameters.gravity;
        const normal = parameters.mass * state.normal_per_mass;
        context.save();
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = WEIGHT_COLOR;
        context.fillText(`P = ${formatNumber(weight)} N`, center_x, center_y + 78);
        context.fillStyle = NORMAL_COLOR;
        context.fillText(state.phase === "flight"
            ? `N = 0 (${strings.label_flight[current_language]})`
            : `N = ${formatNumber(normal)} N`, center_x, center_y + 94);
        context.fillStyle = ink;
        context.fillText(`ΣF = ${formatNumber(parameters.mass * net_per_mass)} N`, center_x, center_y + 110);
        context.restore();
    }

    /* updateFormulas: refresh substitution text and result for every formula card */
    function updateFormulas(state) {
        const g = parameters.gravity;
        const m = parameters.mass;
        const h = parameters.start_height;
        const phi_degrees = displayDegrees(state.phi);
        const in_flight = state.phase === "flight";
        const weight = m * g;
        const normal = m * state.normal_per_mass;
        const top_height = track.loop_height;
        const top_radius = track.top_radius;
        const top_normal = m * (2 * g * (h - top_height) / top_radius - g);
        const flight_radius = in_flight && Math.abs(Math.cos(state.phi)) > 1e-9
            ? state.speed * state.speed / (g * Math.abs(Math.cos(state.phi)))
            : Infinity;
        const curvature_radius = in_flight ? flight_radius : (state.kappa > 0 ? 1 / state.kappa : Infinity);
        const not_applicable = strings.not_applicable[current_language];

        let flight_x = { substitution: strings.no_takeoff[current_language], result: not_applicable };
        let flight_y = { substitution: strings.no_takeoff[current_language], result: not_applicable };
        if (trajectory.takeoff !== null && !in_flight) {
            const note = strings.takeoff_later[current_language].replace("{t}", formatNumber(trajectory.takeoff.time));
            flight_x = { substitution: note, result: not_applicable };
            flight_y = { substitution: note, result: not_applicable };
        } else if (in_flight) {
            const takeoff = trajectory.takeoff;
            const tau = state.time - takeoff.time;
            flight_x = {
                substitution: `${formatOperand(takeoff.velocity_x)} × ${formatNumber(tau)} + ${formatOperand(takeoff.x)}`,
                result: `x = ${formatNumber(state.x)} m`,
            };
            flight_y = {
                substitution: `−${formatNumber(g)} × ${formatNumber(tau)}² / 2 + ${formatOperand(takeoff.velocity_y)} × ${formatNumber(tau)} + ${formatNumber(takeoff.y)}`,
                result: `y = ${formatNumber(state.y)} m`,
            };
        }

        const cards = {
            weight: {
                substitution: `${formatNumber(m)} × ${formatNumber(g)}`,
                result: `${formatNumber(weight)} N`,
            },
            speed: {
                substitution: `√(2 × ${formatNumber(g)} × (${formatNumber(h)} − ${formatOperand(state.y)}))`,
                result: `${formatNumber(state.speed)} m/s`,
            },
            a_theta: {
                substitution: `−${formatNumber(g)} × sin(${formatOperand(phi_degrees)}°)`,
                result: `${formatNumber(state.a_theta)} m/s²`,
            },
            a_r: {
                substitution: Number.isFinite(curvature_radius)
                    ? `−${formatNumber(state.speed)}² / ${formatNumber(curvature_radius)}`
                    : strings.straight_line[current_language],
                result: `${formatNumber(state.a_r)} m/s²`,
            },
            normal: {
                substitution: in_flight
                    ? strings.no_contact[current_language]
                    : (Number.isFinite(curvature_radius)
                        ? `${formatNumber(m)} × (${formatNumber(state.speed)}² / ${formatNumber(curvature_radius)} + ${formatNumber(g)} × cos(${formatOperand(phi_degrees)}°))`
                        : `${formatNumber(m)} × (0 + ${formatNumber(g)} × cos(${formatOperand(phi_degrees)}°))`),
                result: `${formatNumber(normal)} N`,
            },
            load: {
                substitution: `${formatNumber(normal)} / ${formatNumber(weight)}`,
                result: `${formatNumber(normal / weight)}`,
            },
            top_speed: {
                substitution: `√(${formatNumber(g)} × ${formatNumber(top_radius)})`,
                result: `${formatNumber(Math.sqrt(g * top_radius))} m/s`,
            },
            normal_top: {
                substitution: `${formatNumber(m)} × (2 × ${formatNumber(g)} × (${formatNumber(h)} − ${formatNumber(top_height)}) / ${formatNumber(top_radius)} − ${formatNumber(g)})`,
                result: h < top_height
                    ? strings.top_not_reached[current_language]
                    : (top_normal < 0
                        ? `${formatNumber(top_normal)} N ${strings.leaves_before_top[current_language]}`
                        : `${formatNumber(top_normal)} N`),
            },
            h_min: {
                substitution: `${formatNumber(critical.y)} − ${formatNumber(critical.radius)} × cos(${formatNumber(displayDegrees(critical.phi))}°) / 2`,
                result: `${formatNumber(critical.height)} m`,
            },
            position: {
                substitution: in_flight ? strings.flight_note[current_language] : strings.rk4_note[current_language],
                result: `s = ${formatNumber(state.s)} m`,
            },
            flight_x,
            flight_y,
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
        const indices = [];
        for (let i = 0; i < samples.length; i += GRAPH_STRIDE) {
            indices.push(i);
        }
        if ((samples.length - 1) % GRAPH_STRIDE !== 0) {
            indices.push(samples.length - 1);
        }
        for (const index of indices) {
            const sample = samples[index];
            series.x.push([sample.time, sample.x]);
            series.y.push([sample.time, sample.y]);
            series.speed.push([sample.time, sample.speed]);
            series.a_theta.push([sample.time, sample.a_theta]);
            series.a_r.push([sample.time, sample.a_r]);
            series.normal.push([sample.time, parameters.mass * sample.normal_per_mass]);
            series.weight.push([sample.time, parameters.mass * parameters.gravity]);
        }
        return series;
    }

    /* drawGraphs: positions, speed, accelerations and normal force versus time with live cursor */
    function drawGraphs(time) {
        graph.drawTimeGraph(document.getElementById("graph_positions"), [
            { label: "x", color: "#1976d2", points: graph_series.x },
            { label: "y", color: "#d32f2f", points: graph_series.y },
        ], { cursor_time: time, unit: "m" });
        graph.drawTimeGraph(document.getElementById("graph_speed"), [
            { label: "v", color: "#1976d2", points: graph_series.speed },
        ], { cursor_time: time, unit: "m/s" });
        graph.drawTimeGraph(document.getElementById("graph_accelerations"), [
            { label: "a_θ", color: "#1976d2", points: graph_series.a_theta },
            { label: "a_r", color: "#d32f2f", points: graph_series.a_r },
        ], { cursor_time: time, unit: "m/s²" });
        graph.drawTimeGraph(document.getElementById("graph_normal"), [
            { label: "N", color: NORMAL_COLOR, points: graph_series.normal },
            { label: "P", color: WEIGHT_COLOR, points: graph_series.weight },
        ], { cursor_time: time, unit: "N" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const time = Math.min(simulation_time, trajectory.duration);
        const scene_values = drawScene(camera.transform(), time);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        document.getElementById("timeline").value = time;
        updateFormulas(scene_values.state);
        if (!scene_values.hide_answer) {
            drawGraphs(time);
        }
    }

    /* animationFrame: advance simulation time while playing, then render */
    function animationFrame(timestamp) {
        if (is_playing) {
            if (last_frame_timestamp !== null) {
                const delta_seconds = Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
                simulation_time += delta_seconds * playback_speed;
                if (simulation_time >= trajectory.duration) {
                    simulation_time = trajectory.duration;
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

    /* stepTime: shift simulation time by a signed amount, clamped to the trajectory */
    function stepTime(delta_seconds) {
        simulation_time = Math.min(Math.max(simulation_time + delta_seconds, 0), trajectory.duration);
    }

    /* buildShapeRow: segmented circle / clothoid selector */
    function buildShapeRow(container) {
        const row = document.createElement("div");
        row.className = "parameter-row";
        const label = document.createElement("span");
        label.className = "row-label";
        label.dataset.i18n = "shape";
        const group = document.createElement("div");
        group.className = "shape-buttons";
        for (const shape of SHAPES) {
            const button = document.createElement("button");
            button.type = "button";
            button.id = `shape_${shape}`;
            button.dataset.i18n = `shape_${shape}`;
            button.classList.toggle("active", shape === parameters.shape);
            button.addEventListener("click", () => applyShape(shape));
            group.append(button);
        }
        row.append(label, group);
        container.append(row);
    }

    /* buildControls: shape selector, then one slider + number input pair per numeric parameter */
    function buildControls() {
        const container = document.getElementById("parameter_rows");
        buildShapeRow(container);
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

    /* applyParameter: update a parameter from either input, mirror it, rebuild the trajectory */
    function applyParameter(key, raw_value, mirror_input) {
        const value = Number(raw_value);
        const config = parameter_config.find((entry) => entry.key === key);
        if (raw_value === "" || !Number.isFinite(value) || value < config.min || value > config.max) {
            return;
        }
        parameters[key] = value;
        mirror_input.value = raw_value;
        rebuild();
        if (!camera.isTouched()) {
            fitView();
        }
    }

    /* applyShape: switch the loop shape and rebuild */
    function applyShape(shape) {
        parameters.shape = shape;
        for (const candidate of SHAPES) {
            document.getElementById(`shape_${candidate}`).classList.toggle("active", candidate === shape);
        }
        rebuild();
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
            if (!is_playing && simulation_time >= trajectory.duration) {
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

        rebuild();
        applyLanguage(current_language);
        fitView();
        requestAnimationFrame(animationFrame);
    }

    init();
})();
