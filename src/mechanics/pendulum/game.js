/*
 * game.js — EXPERIMENTAL wall-breaker game mode for the pendulum exercise.
 * Two walls stand on the swing plane, each occupying its own RADIAL band
 * [inner_radius, outer_radius]: the bob (at radius L) only touches a wall when
 * crossing its angle with inner ≤ L ≤ outer — the rope length is part of the
 * puzzle. The ORANGE brick wall must be smashed (touch it with speed ≥ its
 * threshold) and the GRAY steel wall must be PRESERVED (never touch it with
 * speed ≥ its threshold); the gray band always covers the orange band, so no
 * playable length dodges the forbidden wall. The rope snaps above T_max. After
 * a broken gray wall, it reappears at the end of the fail sequence while the
 * smashed orange wall only reappears on the next launch. The start position is
 * forced to a minimum angular distance from the walls. Every generated
 * situation is provably solvable: constructive generation + the pure checker
 * isSituationFeasible (rejection loop, deterministic fallback), both exported
 * for tests. Thresholds, bands, T_max and the forced start are drawn directly
 * on the canvas. The already-traveled trace stays visible (allowed here);
 * formulas, graphs and time scrubbing are hidden; any parameter change resets
 * the swing; milestone tiers as in the other exercises. Self-contained: to
 * remove, delete this file, its test file, the GAME MODE blocks in index.html,
 * and the marked "Game mode hook" line in main.js. Integration surface: the
 * "game-mode" body class (set here) and globalThis.pendulum_game_overlay
 * (called by main.js each frame).
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const START_GAP_DEGREES = 80;
    const LENGTH_MIN = 0.5;
    const LENGTH_MAX = 5;
    const SPEED_INPUT_MAX = 10;

    /* isWithinBand: the bob at this rope length touches the wall's radial band */
    function isWithinBand(length, wall) {
        return length >= wall.inner_radius && length <= wall.outer_radius;
    }

    /* isCrossing: true when the angle passed the wall angle between two samples */
    function isCrossing(previous_angle, current_angle, wall_angle) {
        return (previous_angle - wall_angle) * (current_angle - wall_angle) <= 0
            && previous_angle !== current_angle;
    }

    /* isSituationFeasible: true when some rope length in [length_min, length_max]
       allows a winning swing — the bob touches the orange wall, a speed window
       exists (either the gray wall is out of radial reach, or the energy window
       v1² < v2² + 2·g·L·(cos θ1 − cos θ2) is non-empty), the minimum successful
       swing stays under the tension limit, and the required energy is reachable
       with the available θ0/v0 inputs */
    function isSituationFeasible(walls, gravity, mass, length_min = LENGTH_MIN, length_max = LENGTH_MAX) {
        const reachable_low = Math.max(walls.break_wall.inner_radius, length_min);
        const reachable_high = Math.min(walls.break_wall.outer_radius, length_max);
        if (reachable_low > reachable_high) {
            return false;
        }
        const break_angle = walls.break_wall.angle_degrees * Math.PI / 180;
        const preserve_angle = walls.preserve_wall.angle_degrees * Math.PI / 180;
        const min_speed_squared = walls.break_wall.min_speed * walls.break_wall.min_speed;
        for (let i = 0; i <= 40; i++) {
            const length = reachable_low + ((reachable_high - reachable_low) * i) / 40;
            const energy_gap = 2 * gravity * length * (Math.cos(break_angle) - Math.cos(preserve_angle));
            const window_ok = !isWithinBand(length, walls.preserve_wall)
                || min_speed_squared < walls.preserve_wall.max_speed * walls.preserve_wall.max_speed + energy_gap;
            const bottom_speed_squared = min_speed_squared + 2 * gravity * length * (1 - Math.cos(break_angle));
            const tension_ok = mass * (gravity + bottom_speed_squared / length) <= walls.tension_max + 1e-9;
            const max_reachable_squared = SPEED_INPUT_MAX * SPEED_INPUT_MAX
                + 2 * gravity * length * (Math.cos(break_angle) + 1);
            const energy_ok = max_reachable_squared >= min_speed_squared;
            if (window_ok && tension_ok && energy_ok) {
                return true;
            }
        }
        return false;
    }

    /* buildCandidate: one random situation. The preserve band always COVERS the
       orange band (with random margins), so no playable rope length can reach the
       orange wall while dodging the gray one. The speed window and tension limit
       are constructed at the binding length (the orange band's inner edge: both
       the energy gap and the tension margin are worst there), so they hold for
       every length in the band */
    function buildCandidate(gravity, mass, rng) {
        const break_angle_degrees = -(20 + rng() * 30);
        const preserve_angle_degrees = break_angle_degrees - (15 + rng() * 20);
        const break_min_speed = 3 + rng() * 2;
        const break_inner = 0.8 + rng() * 1.0;
        const break_outer = break_inner + 0.8 + rng() * 1.0;
        const preserve_inner = Math.max(break_inner - (0.1 + rng() * 0.4), 0.3);
        const preserve_outer = break_outer + 0.1 + rng() * 0.4;
        const reference_length = break_inner;
        const break_angle = break_angle_degrees * Math.PI / 180;
        const preserve_angle = preserve_angle_degrees * Math.PI / 180;

        const energy_gap = 2 * gravity * reference_length * (Math.cos(break_angle) - Math.cos(preserve_angle));
        const preserve_max_speed = Math.sqrt(Math.max(
            break_min_speed * break_min_speed + (3 + rng() * 3) - energy_gap,
            0.25,
        ));

        const bottom_speed_squared = break_min_speed * break_min_speed
            + 2 * gravity * reference_length * (1 - Math.cos(break_angle));
        const required_tension = mass * (gravity + bottom_speed_squared / reference_length);
        return {
            break_wall: {
                angle_degrees: break_angle_degrees,
                min_speed: break_min_speed,
                inner_radius: break_inner,
                outer_radius: break_outer,
            },
            preserve_wall: {
                angle_degrees: preserve_angle_degrees,
                max_speed: preserve_max_speed,
                inner_radius: preserve_inner,
                outer_radius: preserve_outer,
            },
            tension_max: required_tension * (1.15 + rng() * 0.3),
            min_start_angle_degrees: Math.ceil(break_angle_degrees + START_GAP_DEGREES),
        };
    }

    /* randomWalls: feasible random situation (rejection loop + deterministic fallback) */
    function randomWalls(gravity, mass, rng = Math.random) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = buildCandidate(gravity, mass, rng);
            if (isSituationFeasible(candidate, gravity, mass)) {
                return candidate;
            }
        }
        return buildCandidate(gravity, mass, () => 0.5);
    }

    globalThis.pendulum_game = {
        randomWalls,
        buildCandidate,
        isSituationFeasible,
        isCrossing,
        isWithinBand,
        MILESTONES,
        START_GAP_DEGREES,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Casse-mur", en: "Wall breaker" },
        panel_title: { fr: "Casse-mur", en: "Wall breaker" },
        hint: {
            fr: "Cassez le mur orange SANS casser le mur gris : jouez sur θ₀, v₀ et la longueur L (un mur ne se touche que si L passe dans sa bande), sans dépasser la tension limite !",
            en: "Smash the orange wall WITHOUT breaking the gray one: use θ₀, v₀ and the length L (a wall is only touched when L falls in its band), without exceeding the tension limit!",
        },
        new_target: { fr: "Nouveaux murs", en: "New walls" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Défis réussis", en: "Challenges cleared" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        walls_label: { fr: "Murs", en: "Walls" },
        walls_info: {
            fr: "À casser (orange) : θ = {a1}°, v ≥ {v1} m/s, r = {i1}–{o1} m · À préserver (gris) : θ = {a2}°, v < {v2} m/s, r = {i2}–{o2} m",
            en: "To smash (orange): θ = {a1}°, v ≥ {v1} m/s, r = {i1}–{o1} m · To preserve (gray): θ = {a2}°, v < {v2} m/s, r = {i2}–{o2} m",
        },
        rope_label: { fr: "Corde", en: "Rope" },
        rope_info: {
            fr: "T_max = {t} N · départ imposé : θ₀ ≥ {s}°",
            en: "T_max = {t} N · forced start: θ₀ ≥ {s}°",
        },
        tension_label: { fr: "Tension actuelle", en: "Current tension" },
        wall_broken: { fr: "MUR CASSÉ !", en: "WALL SMASHED!" },
        cleared: { fr: "RÉUSSI !", en: "CLEARED!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        too_slow: { fr: "Trop lent…", en: "Too slow…" },
        missed_wall: { fr: "Le mur orange n'a pas été touché !", en: "The orange wall was never touched!" },
        preserve_broken: { fr: "Le mur à préserver a cassé !", en: "The protected wall broke!" },
        rope_broken: { fr: "La corde a cassé !", en: "The rope snapped!" },
    };
    const DEBRIS_COLORS = ["#b5651d", "#8a3d12", "#d9822b", "#7a8494"];

    let game_active = false;
    let walls = null;
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let break_wall_broken = false;
    let preserve_wall_broken = false;
    let previous_state = null;
    let particles = [];
    let banner_seconds = 0;
    let banner_key = null;
    let banner_color = "#e8722c";
    let milestone_level = null;
    let pending_success = false;
    let pending_fail = false;
    let last_overlay_milliseconds = null;
    let panel_elements = null;
    let original_angle_min = null;

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatValue: one-decimal number matching the page locale */
    function formatValue(value) {
        const text = value.toFixed(1);
        return currentLanguage() === "fr" ? text.replace(".", ",") : text;
    }

    /* live parameter reads, so the game follows the current inputs */
    function currentGravity() {
        return Number(document.getElementById("number_gravity").value) || 9.81;
    }
    function currentLength() {
        return Number(document.getElementById("number_rod_length").value) || 2;
    }
    function currentMass() {
        return Number(document.getElementById("number_mass").value) || 1;
    }

    /* nextMilestone: first tier strictly above the score, null once all are reached */
    function nextMilestone(score) {
        for (const milestone of MILESTONES) {
            if (score < milestone) {
                return milestone;
            }
        }
        return null;
    }

    /* clampStartAngle: enforce the forced start distance from the walls */
    function clampStartAngle() {
        const slider = document.getElementById("slider_initial_angle_degrees");
        const number = document.getElementById("number_initial_angle_degrees");
        if (original_angle_min === null) {
            original_angle_min = number.min;
        }
        if (!game_active) {
            slider.min = original_angle_min;
            number.min = original_angle_min;
            return;
        }
        slider.min = walls.min_start_angle_degrees;
        number.min = walls.min_start_angle_degrees;
        if (Number(number.value) < walls.min_start_angle_degrees) {
            number.value = walls.min_start_angle_degrees;
            number.dispatchEvent(new Event("input"));
        }
    }

    /* newWalls: fresh feasible situation, swing reset, panel refreshed */
    function newWalls() {
        walls = randomWalls(currentGravity(), currentMass(), Math.random);
        break_wall_broken = false;
        preserve_wall_broken = false;
        attempt_over = true;
        clampStartAngle();
        updatePanel();
        document.getElementById("reset_button").click();
        document.getElementById("zoom_fit_button").click();
    }

    /* updatePanel: refresh tabs and header always, stat cards once walls exist */
    function updatePanel() {
        if (panel_elements === null) {
            return;
        }
        const language = currentLanguage();
        panel_elements.tab_simulation.textContent = strings.tab_simulation[language];
        panel_elements.tab_game.textContent = strings.tab_game[language];
        panel_elements.title.textContent = strings.panel_title[language];
        panel_elements.hint.textContent = strings.hint[language];
        panel_elements.new_target_button.textContent = strings.new_target[language];
        if (walls === null) {
            return;
        }
        const cards = panel_elements.cards;

        const next = nextMilestone(goals);
        const reached_count = MILESTONES.filter((milestone) => goals >= milestone).length;
        cards.objective.name.textContent = strings.objective_label[language];
        cards.objective.value.textContent = next === null ? `${goals} ✓` : `${goals} / ${next}`;
        cards.objective.sub.textContent = next === null
            ? strings.max_tier[language]
            : `${strings.tier_label[language]} ${reached_count + 1} / ${MILESTONES.length}`;

        cards.score.name.textContent = strings.score_label[language];
        cards.score.value.textContent = String(goals);

        cards.attempts.name.textContent = strings.attempts_label[language];
        cards.attempts.value.textContent = String(attempts);

        cards.success.name.textContent = strings.success_label[language];
        cards.success.value.textContent = attempts > 0 ? `${Math.round((100 * goals) / attempts)} %` : "—";

        cards.walls.name.textContent = strings.walls_label[language];
        cards.walls.value.textContent = strings.walls_info[language]
            .replace("{a1}", formatValue(walls.break_wall.angle_degrees))
            .replace("{v1}", formatValue(walls.break_wall.min_speed))
            .replace("{i1}", formatValue(walls.break_wall.inner_radius))
            .replace("{o1}", formatValue(walls.break_wall.outer_radius))
            .replace("{a2}", formatValue(walls.preserve_wall.angle_degrees))
            .replace("{v2}", formatValue(walls.preserve_wall.max_speed))
            .replace("{i2}", formatValue(walls.preserve_wall.inner_radius))
            .replace("{o2}", formatValue(walls.preserve_wall.outer_radius));

        cards.rope.name.textContent = strings.rope_label[language];
        cards.rope.value.textContent = strings.rope_info[language]
            .replace("{t}", formatValue(walls.tension_max))
            .replace("{s}", formatValue(walls.min_start_angle_degrees));

        cards.tension.name.textContent = strings.tension_label[language];
    }

    /* setActive: toggle game mode; resets the swing so no attempt state leaks */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        previous_state = null;
        particles = [];
        banner_seconds = 0;
        milestone_level = null;
        pending_success = false;
        pending_fail = false;
        if (active && walls === null) {
            walls = randomWalls(currentGravity(), currentMass(), Math.random);
        }
        break_wall_broken = false;
        preserve_wall_broken = false;
        attempt_over = true;
        clampStartAngle();
        updatePanel();
        document.getElementById("reset_button").click();
        document.getElementById("zoom_fit_button").click();
    }

    /* createCard: one stat card matching the formula-card presentation */
    function createCard(value_class) {
        const card = document.createElement("div");
        card.className = "formula-card";
        const name = document.createElement("span");
        name.className = "name";
        const value = document.createElement("div");
        value.className = value_class;
        const sub = document.createElement("div");
        sub.className = "game-sub";
        card.append(name, value, sub);
        return { card, name, value, sub };
    }

    /* buildUi: mode tabs in the mount point + full-width stats panel below the scene */
    function buildUi() {
        const mount = document.getElementById("game_mode_mount");
        const tabs = document.createElement("div");
        tabs.className = "mode-tabs";
        const tab_simulation = document.createElement("button");
        tab_simulation.type = "button";
        tab_simulation.className = "active";
        const tab_game = document.createElement("button");
        tab_game.type = "button";
        tab_simulation.addEventListener("click", () => setActive(false));
        tab_game.addEventListener("click", () => setActive(true));
        tabs.append(tab_simulation, tab_game);
        mount.append(tabs);

        const panel = document.createElement("section");
        panel.className = "panel game-panel";
        panel.style.display = "none";

        const head = document.createElement("div");
        head.className = "panel-head";
        const title = document.createElement("h2");
        const hint = document.createElement("span");
        hint.className = "game-hint";
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newWalls);
        head.append(title, hint, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            tension: createCard("game-value game-tension"),
            walls: createCard("game-target-value game-target"),
            rope: createCard("game-target-value game-rope"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = { panel, title, hint, new_target_button, tab_simulation, tab_game, cards };
    }

    /* spawnDebris: burst of particles at a screen position */
    function spawnDebris(screen_x, screen_y) {
        for (let i = 0; i < 70; i++) {
            const direction = Math.random() * 2 * Math.PI;
            const speed = 80 + Math.random() * 240;
            particles.push({
                x: screen_x,
                y: screen_y,
                velocity_x: Math.cos(direction) * speed,
                velocity_y: Math.sin(direction) * speed - 120,
                color: DEBRIS_COLORS[i % DEBRIS_COLORS.length],
                life: 1 + Math.random() * 0.6,
            });
        }
    }

    /* showBanner: display a canvas banner for a duration */
    function showBanner(key, color, seconds) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
    }

    /* failAttempt: pause the swing (fails are only detected while time advances,
       so the transport is necessarily playing), show the reason, schedule a reset */
    function failAttempt(reason_key) {
        attempt_over = true;
        pending_fail = true;
        showBanner(reason_key, "#d32f2f", 1.5);
        document.getElementById("play_pause_button").click();
        updatePanel();
    }

    /* succeedAttempt: count the goal, celebrate, schedule new walls */
    function succeedAttempt(context) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnDebris(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner("cleared", "#e8722c", 2);
        updatePanel();
    }

    /* drawWall: wall spanning its own radial band; style differentiates smash vs preserve */
    function drawWall(context, transform, wall, style) {
        const angle = wall.angle_degrees * Math.PI / 180;
        const radial = { x: Math.sin(angle), y: -Math.cos(angle) };
        const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
        const inner = wall.inner_radius;
        const outer = wall.outer_radius;
        const half_width = 0.02 * (inner + outer);
        const corners = [
            [inner * radial.x - half_width * tangent.x, inner * radial.y - half_width * tangent.y],
            [inner * radial.x + half_width * tangent.x, inner * radial.y + half_width * tangent.y],
            [outer * radial.x + half_width * tangent.x, outer * radial.y + half_width * tangent.y],
            [outer * radial.x - half_width * tangent.x, outer * radial.y - half_width * tangent.y],
        ];
        context.save();
        context.fillStyle = style.fill;
        context.strokeStyle = style.stroke;
        context.lineWidth = 1.5;
        context.beginPath();
        corners.forEach(([world_x, world_y], index) => {
            const screen_x = transform.toScreenX(world_x);
            const screen_y = transform.toScreenY(world_y);
            if (index === 0) {
                context.moveTo(screen_x, screen_y);
            } else {
                context.lineTo(screen_x, screen_y);
            }
        });
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        for (const fraction of [0.25, 0.5, 0.75]) {
            const radius = inner + (outer - inner) * fraction;
            context.moveTo(transform.toScreenX(radius * radial.x - half_width * tangent.x), transform.toScreenY(radius * radial.y - half_width * tangent.y));
            context.lineTo(transform.toScreenX(radius * radial.x + half_width * tangent.x), transform.toScreenY(radius * radial.y + half_width * tangent.y));
        }
        context.stroke();

        const label_x = transform.toScreenX((outer + 0.28) * radial.x);
        const label_y = transform.toScreenY((outer + 0.28) * radial.y);
        context.fillStyle = style.label_color;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(style.label, label_x, label_y - 16);
        context.fillText(style.condition, label_x, label_y);
        context.fillText(`r = ${formatValue(inner)}–${formatValue(outer)} m`, label_x, label_y + 16);
        context.restore();
    }

    /* drawSceneInfo: rope limit near the pivot and the forced-start marker on the arc */
    function drawSceneInfo(context, transform) {
        const length = currentLength();
        const pivot_x = transform.toScreenX(0);
        const pivot_y = transform.toScreenY(0);

        context.save();
        context.fillStyle = "#8e24aa";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(`T_max = ${formatValue(walls.tension_max)} N`, pivot_x, pivot_y - 14);

        const start_angle = walls.min_start_angle_degrees * Math.PI / 180;
        const start_direction = { x: Math.sin(start_angle), y: -Math.cos(start_angle) };
        context.strokeStyle = "rgba(67, 160, 71, 0.8)";
        context.setLineDash([5, 5]);
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(pivot_x, pivot_y);
        context.lineTo(transform.toScreenX(1.1 * length * start_direction.x), transform.toScreenY(1.1 * length * start_direction.y));
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#43a047";
        context.textBaseline = "middle";
        context.textAlign = start_direction.x >= 0 ? "left" : "right";
        context.fillText(
            `θ₀ ≥ ${formatValue(walls.min_start_angle_degrees)}°`,
            transform.toScreenX(1.16 * length * start_direction.x),
            transform.toScreenY(1.16 * length * start_direction.y),
        );
        context.restore();
    }

    /* drawEffects: debris particles and banners, advanced by dt */
    function drawEffects(context, delta_seconds) {
        const surviving_particles = [];
        for (const particle of particles) {
            particle.life -= delta_seconds;
            if (particle.life <= 0) {
                continue;
            }
            particle.velocity_y += 360 * delta_seconds;
            particle.x += particle.velocity_x * delta_seconds;
            particle.y += particle.velocity_y * delta_seconds;
            context.save();
            context.globalAlpha = Math.min(particle.life, 1);
            context.fillStyle = particle.color;
            context.fillRect(particle.x - 3, particle.y - 3, 6, 6);
            context.restore();
            surviving_particles.push(particle);
        }
        particles = surviving_particles;

        const language = currentLanguage();
        if (banner_seconds > 0) {
            banner_seconds -= delta_seconds;
            context.save();
            context.globalAlpha = Math.min(banner_seconds, 1);
            context.fillStyle = banner_color;
            context.font = "bold 40px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings[banner_key][language], context.canvas.width / 2, 30);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    78,
                );
            }
            context.restore();
            if (banner_seconds <= 0) {
                milestone_level = null;
                if (pending_success) {
                    pending_success = false;
                    newWalls();
                } else if (pending_fail) {
                    pending_fail = false;
                    preserve_wall_broken = false;
                    document.getElementById("reset_button").click();
                }
            }
        }
    }

    /* overlay: called by main.js at the end of every frame while the page renders */
    function overlay(context, transform, state) {
        if (!game_active) {
            last_overlay_milliseconds = null;
            return;
        }
        const now_milliseconds = performance.now();
        const delta_seconds = last_overlay_milliseconds === null
            ? 0
            : Math.min((now_milliseconds - last_overlay_milliseconds) / 1000, 0.05);
        last_overlay_milliseconds = now_milliseconds;

        const language = currentLanguage();
        if (!break_wall_broken) {
            drawWall(context, transform, walls.break_wall, {
                fill: "#b5651d",
                stroke: "#8a3d12",
                label: language === "fr" ? "✔ à casser" : "✔ smash it",
                condition: `v ≥ ${formatValue(walls.break_wall.min_speed)} m/s`,
                label_color: "#e8722c",
            });
        }
        if (!preserve_wall_broken) {
            drawWall(context, transform, walls.preserve_wall, {
                fill: "#6b7684",
                stroke: "#4a545e",
                label: language === "fr" ? "✘ à préserver" : "✘ preserve it",
                condition: `v < ${formatValue(walls.preserve_wall.max_speed)} m/s`,
                label_color: "#d32f2f",
            });
        }
        drawSceneInfo(context, transform);
        panel_elements.cards.tension.value.textContent =
            `${formatValue(state.tension)} / ${formatValue(walls.tension_max)} N`;

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                break_wall_broken = false;
                preserve_wall_broken = false;
                updatePanel();
            }
            if (!attempt_over) {
                if (state.tension > walls.tension_max) {
                    failAttempt("rope_broken");
                } else {
                    checkProgress(context, transform, state);
                }
            }
        }
        previous_state = state;

        drawEffects(context, delta_seconds);
    }

    /* checkProgress: wall crossings (with radial contact) and turnarounds decide
       success or failure */
    function checkProgress(context, transform, state) {
        const length = currentLength();
        const break_angle = walls.break_wall.angle_degrees * Math.PI / 180;
        const preserve_angle = walls.preserve_wall.angle_degrees * Math.PI / 180;

        if (!break_wall_broken
            && isCrossing(previous_state.angle, state.angle, break_angle)
            && isWithinBand(length, walls.break_wall)) {
            if (Math.abs(state.speed) >= walls.break_wall.min_speed) {
                break_wall_broken = true;
                spawnDebris(
                    transform.toScreenX(length * Math.sin(break_angle)),
                    transform.toScreenY(-length * Math.cos(break_angle)),
                );
                showBanner("wall_broken", "#43a047", 1);
            } else {
                failAttempt("too_slow");
            }
            return;
        }

        if (isCrossing(previous_state.angle, state.angle, preserve_angle)
            && isWithinBand(length, walls.preserve_wall)) {
            if (Math.abs(state.speed) >= walls.preserve_wall.max_speed) {
                preserve_wall_broken = true;
                spawnDebris(
                    transform.toScreenX(length * Math.sin(preserve_angle)),
                    transform.toScreenY(-length * Math.cos(preserve_angle)),
                );
                failAttempt("preserve_broken");
            } else if (break_wall_broken) {
                succeedAttempt(context);
            }
            return;
        }

        const turned_around = previous_state.angular_velocity * state.angular_velocity <= 0
            && previous_state.angular_velocity !== state.angular_velocity;
        if (turned_around && state.angle < 0) {
            if (break_wall_broken) {
                succeedAttempt(context);
            } else if (isWithinBand(length, walls.break_wall)) {
                failAttempt("too_slow");
            } else {
                failAttempt("missed_wall");
            }
        }
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    /* in game mode, any parameter change resets the swing, and theta0 stays at the
       forced distance from the walls */
    document.getElementById("parameter_rows").addEventListener("input", (event) => {
        if (game_active) {
            document.getElementById("reset_button").click();
            if (event.target.id === "number_initial_angle_degrees") {
                clampStartAngle();
            }
        }
    });

    buildUi();
    updatePanel();
    globalThis.pendulum_game_overlay = overlay;
})();
