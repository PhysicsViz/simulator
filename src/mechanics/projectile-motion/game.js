/*
 * game.js — EXPERIMENTAL basket-challenge game mode for the projectile exercise.
 * The student sets the launch parameters to shoot a basketball through a hoop
 * whose distance, height and rim size are randomized. While active: formulas,
 * predicted path and time scrubbing are hidden, any parameter change resets the
 * shot, the initial height h0 is capped at the hoop height, the ball resets
 * after each basket, and progress runs through milestone
 * tiers (1, 5, 10, 20, 40, 70, 100 baskets) shown with stats in a full-width
 * panel below the scene, styled like the formula panel. Self-contained: to
 * remove the feature entirely, delete this file, its test file, the GAME MODE
 * blocks in index.html, and the marked "Game mode hook" lines in main.js.
 * Integration surface: the "game-mode" body class (set here),
 * globalThis.projectile_game_overlay (called by main.js each frame) and
 * globalThis.projectile_game_view_extent (read by main.js fitView). Pure logic
 * (scoring, target generation) is exposed as globalThis.projectile_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];

    /* randomTarget: hoop at random distance, rim radius and rim height; rng injectable for tests */
    function randomTarget(rng = Math.random) {
        return {
            x: 5 + rng() * 13,
            radius: 0.35 + rng() * 0.55,
            height: 2 + rng() * 2.5,
        };
    }

    /* isScoringCrossing: true when the segment previous→current descends through
       the rim plane (y = target.height) within the rim opening */
    function isScoringCrossing(previous_position, current_position, target) {
        if (current_position.y >= previous_position.y) {
            return false;
        }
        if (previous_position.y < target.height || current_position.y > target.height) {
            return false;
        }
        const descent_ratio = (previous_position.y - target.height) / (previous_position.y - current_position.y);
        const crossing_x = previous_position.x + descent_ratio * (current_position.x - previous_position.x);
        return Math.abs(crossing_x - target.x) <= target.radius;
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

    globalThis.projectile_game = { randomTarget, isScoringCrossing, nextMilestone, MILESTONES };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Défi panier", en: "Basket challenge" },
        panel_title: { fr: "Défi panier", en: "Basket challenge" },
        hint: { fr: "Réglez v₀, θ et h₀, puis lancez !", en: "Set v₀, θ and h₀, then launch!" },
        new_target: { fr: "Nouvelle cible", en: "New target" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Paniers réussis", en: "Baskets made" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Cible", en: "Target" },
        target_info: {
            fr: "distance {d} m · hauteur {h} m · diamètre {w} m",
            en: "distance {d} m · height {h} m · diameter {w} m",
        },
        scored: { fr: "PANIER !", en: "SCORE!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        missed: { fr: "Raté…", en: "Missed…" },
    };
    const CONFETTI_COLORS = ["#e8722c", "#1976d2", "#d32f2f", "#43a047", "#fbc02d", "#8e24aa"];

    let game_active = false;
    let target = randomTarget();
    let score = 0;
    let attempts = 0;
    let scored_this_attempt = true;
    let previous_state = null;
    let particles = [];
    let celebration_seconds = 0;
    let milestone_level = null;
    let miss_seconds = 0;
    let last_overlay_milliseconds = null;
    let panel_elements = null;
    let original_height_max = null;

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatMeters: one-decimal length matching the page locale */
    function formatMeters(value) {
        const text = value.toFixed(1);
        return currentLanguage() === "fr" ? text.replace(".", ",") : text;
    }

    /* clampInitialHeight: in game mode h0 may not exceed the hoop height — launching
       from above the rim would trivialize the challenge. Tightens the input max and
       lowers the current value if needed (restores the original max on exit) */
    function clampInitialHeight() {
        const slider = document.getElementById("slider_initial_height");
        const number = document.getElementById("number_initial_height");
        if (original_height_max === null) {
            original_height_max = number.max;
        }
        if (!game_active) {
            slider.max = original_height_max;
            number.max = original_height_max;
            return;
        }
        const height_step = Number(number.step) || 0.5;
        const max_height = Math.floor(target.height / height_step) * height_step;
        slider.max = max_height;
        number.max = max_height;
        if (Number(number.value) > max_height) {
            number.value = max_height;
            number.dispatchEvent(new Event("input"));
        }
    }

    /* newTarget: fresh random target, ball back to t = 0, view refitted on the hoop */
    function newTarget() {
        target = randomTarget();
        scored_this_attempt = true;
        clampInitialHeight();
        updatePanel();
        document.getElementById("reset_button").click();
        document.getElementById("zoom_fit_button").click();
    }

    /* updatePanel: refresh tabs, header and every stat card */
    function updatePanel() {
        if (panel_elements === null) {
            return;
        }
        const language = currentLanguage();
        const cards = panel_elements.cards;
        panel_elements.tab_simulation.textContent = strings.tab_simulation[language];
        panel_elements.tab_game.textContent = strings.tab_game[language];
        panel_elements.title.textContent = strings.panel_title[language];
        panel_elements.hint.textContent = strings.hint[language];
        panel_elements.new_target_button.textContent = strings.new_target[language];

        const next = nextMilestone(score);
        const reached_count = MILESTONES.filter((milestone) => score >= milestone).length;
        cards.objective.name.textContent = strings.objective_label[language];
        cards.objective.value.textContent = next === null ? `${score} ✓` : `${score} / ${next}`;
        cards.objective.sub.textContent = next === null
            ? strings.max_tier[language]
            : `${strings.tier_label[language]} ${reached_count + 1} / ${MILESTONES.length}`;

        cards.score.name.textContent = strings.score_label[language];
        cards.score.value.textContent = String(score);

        cards.attempts.name.textContent = strings.attempts_label[language];
        cards.attempts.value.textContent = String(attempts);

        cards.success.name.textContent = strings.success_label[language];
        cards.success.value.textContent = attempts > 0 ? `${Math.round((100 * score) / attempts)} %` : "—";

        cards.target.name.textContent = strings.target_label[language];
        cards.target.value.textContent = strings.target_info[language]
            .replace("{d}", formatMeters(target.x))
            .replace("{h}", formatMeters(target.height))
            .replace("{w}", formatMeters(2 * target.radius));
    }

    /* setActive: toggle game mode (body class drives CSS and main.js prediction hiding);
       resets the simulation and refits the view so no trajectory hint leaks through */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        previous_state = null;
        scored_this_attempt = true;
        particles = [];
        celebration_seconds = 0;
        milestone_level = null;
        miss_seconds = 0;
        clampInitialHeight();
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

    /* buildUi: mode tabs in the mount point + full-width stats panel below the scene,
       so the layout (scene + side column) stays identical to the normal mode */
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
        new_target_button.addEventListener("click", newTarget);
        head.append(title, hint, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            target: createCard("game-target-value game-target"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = { panel, title, hint, new_target_button, tab_simulation, tab_game, cards };
    }

    /* spawnConfetti: burst of colored particles at a screen position */
    function spawnConfetti(screen_x, screen_y) {
        for (let i = 0; i < 90; i++) {
            const direction = Math.random() * 2 * Math.PI;
            const speed = 90 + Math.random() * 260;
            particles.push({
                x: screen_x,
                y: screen_y,
                velocity_x: Math.cos(direction) * speed,
                velocity_y: Math.sin(direction) * speed - 140,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                life: 1.1 + Math.random() * 0.6,
            });
        }
    }

    /* onScore: count the basket, detect milestone tiers, start the celebration */
    function onScore(context, transform) {
        score += 1;
        scored_this_attempt = true;
        celebration_seconds = 1.6;
        spawnConfetti(transform.toScreenX(target.x), transform.toScreenY(target.height));
        if (MILESTONES.includes(score)) {
            milestone_level = MILESTONES.indexOf(score) + 1;
            celebration_seconds = 2.2;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        updatePanel();
    }

    /* drawHoop: pole, backboard, rim and net at the target position (world coords) */
    function drawHoop(context, transform) {
        const rim_left = transform.toScreenX(target.x - target.radius);
        const rim_right = transform.toScreenX(target.x + target.radius);
        const rim_y = transform.toScreenY(target.height);
        const board_x = transform.toScreenX(target.x + target.radius + 0.15);
        const board_top = transform.toScreenY(target.height + 0.9);
        const board_bottom = transform.toScreenY(target.height - 0.15);
        const ground_y = transform.toScreenY(0);

        context.save();
        context.strokeStyle = "#78848f";
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(board_x, ground_y);
        context.lineTo(board_x, board_top);
        context.stroke();

        context.strokeStyle = "#9aa4ae";
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(board_x, board_top);
        context.lineTo(board_x, board_bottom);
        context.stroke();

        context.strokeStyle = "rgba(120, 130, 145, 0.75)";
        context.lineWidth = 1.2;
        const net_bottom_y = transform.toScreenY(target.height - 0.45);
        const net_center_x = transform.toScreenX(target.x);
        context.beginPath();
        for (let i = 0; i <= 4; i++) {
            const start_x = rim_left + ((rim_right - rim_left) * i) / 4;
            context.moveTo(start_x, rim_y);
            context.lineTo(net_center_x + (start_x - net_center_x) * 0.25, net_bottom_y);
        }
        context.stroke();

        context.strokeStyle = "#e8722c";
        context.lineWidth = 4;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(rim_left, rim_y);
        context.lineTo(rim_right, rim_y);
        context.stroke();
        context.restore();
    }

    /* drawBasketball: orange ball with seams drawn over the plain projectile dot */
    function drawBasketball(context, screen_x, screen_y) {
        const radius = 9;
        context.save();
        context.fillStyle = "#e8722c";
        context.strokeStyle = "#8a3d12";
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(screen_x, screen_y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(screen_x - radius, screen_y);
        context.lineTo(screen_x + radius, screen_y);
        context.moveTo(screen_x, screen_y - radius);
        context.lineTo(screen_x, screen_y + radius);
        context.stroke();
        context.restore();
    }

    /* drawEffects: confetti particles and score/milestone/miss banners, advanced by dt */
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
        if (celebration_seconds > 0) {
            celebration_seconds -= delta_seconds;
            context.save();
            context.globalAlpha = Math.min(celebration_seconds, 1);
            context.fillStyle = "#e8722c";
            context.font = "bold 46px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings.scored[language], context.canvas.width / 2, 30);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    84,
                );
            }
            context.restore();
            if (celebration_seconds <= 0) {
                milestone_level = null;
                newTarget();
            }
        }
        if (miss_seconds > 0) {
            miss_seconds -= delta_seconds;
            context.save();
            context.globalAlpha = Math.min(miss_seconds, 1);
            context.fillStyle = "#d32f2f";
            context.font = "bold 30px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings.missed[language], context.canvas.width / 2, 40);
            context.restore();
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

        drawHoop(context, transform);
        drawBasketball(context, transform.toScreenX(state.ball_x), transform.toScreenY(state.ball_y));

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                scored_this_attempt = false;
                miss_seconds = 0;
                updatePanel();
            }
            if (!scored_this_attempt && isScoringCrossing(
                { x: previous_state.ball_x, y: previous_state.ball_y },
                { x: state.ball_x, y: state.ball_y },
                target,
            )) {
                onScore(context, transform);
            }
            if (!scored_this_attempt && state.time >= state.total_time - 1e-9) {
                miss_seconds = 1.2;
                scored_this_attempt = true;
            }
        }
        previous_state = state;

        drawEffects(context, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    /* in game mode, any parameter change resets the shot — otherwise the student
       could scrub a half-drawn trajectory and aim with it — and h0 stays capped
       at the hoop height (typed values above the input max are pushed back down) */
    document.getElementById("parameter_rows").addEventListener("input", (event) => {
        if (game_active) {
            document.getElementById("reset_button").click();
            if (event.target.id === "number_initial_height") {
                clampInitialHeight();
            }
        }
    });

    buildUi();
    updatePanel();
    globalThis.projectile_game_overlay = overlay;
    /* fit-view extent for main.js: keep the hoop (plus headroom) in frame */
    globalThis.projectile_game_view_extent = () => (game_active
        ? { right: target.x + target.radius + 2, top: target.height + 2 }
        : null);
})();
