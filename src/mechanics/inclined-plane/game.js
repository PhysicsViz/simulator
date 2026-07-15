/*
 * game.js — EXPERIMENTAL target game mode for the inclined plane exercise.
 * The slope angle is imposed by the challenge (input locked); the student tunes
 * v0 and the friction coefficient μ. Two random challenge types:
 *   - "stop": bring the block to a PERMANENT stop inside a zone s* ± 0.3 m —
 *     which requires both the right stopping distance AND μ ≥ tan α so the
 *     block holds once stopped;
 *   - "speed": cross the gate at s* (going up) with |v| inside the target
 *     window v* ± max(15 %, 0.3 m/s).
 * Every challenge is provably solvable within the input ranges (pure checker +
 * constructive generation + Monte-Carlo tests). Failures: stopping outside the
 * zone, crossing the gate at the wrong speed, or never reaching the target.
 * Milestone tiers as in the other exercises. Self-contained: to remove, delete
 * this file, its test file, the GAME MODE blocks in index.html, and the marked
 * "Game mode hook" lines in main.js. Integration surface: the "game-mode" body
 * class (set here), globalThis.incline_game_overlay (called by main.js each
 * frame) and globalThis.incline_game_view_extent (read by main.js fitView).
 * Pure logic is exposed as globalThis.incline_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const SPEED_INPUT_MAX = 10;
    const FRICTION_INPUT_MAX = 1.5;
    const STOP_TOLERANCE = 0.3;

    /* speedWindow: tolerance around a target crossing speed */
    function speedWindow(target_speed) {
        return Math.max(0.15 * target_speed, 0.3);
    }

    /* isChallengeFeasible: some (v0 ≤ 10, μ ≤ 1.5) solves the challenge.
       stop: at the minimal holding μ = tan α, the needed v0 = √(4·g·sin α·s*)
       must fit the input range (larger μ only lowers... raises the needed v0,
       so the easiest point is μ = tan α). speed: at μ = 0 the needed
       v0 = √(v*² + 2·g·sin α·s*) is minimal. */
    function isChallengeFeasible(challenge, gravity = GRAVITY) {
        const angle = challenge.angle_degrees * Math.PI / 180;
        if (Math.tan(angle) > FRICTION_INPUT_MAX) {
            return false;
        }
        if (challenge.type === "stop") {
            const needed_speed = Math.sqrt(4 * gravity * Math.sin(angle) * challenge.target_position);
            return needed_speed <= SPEED_INPUT_MAX && challenge.target_position > STOP_TOLERANCE;
        }
        const needed_speed = Math.sqrt(
            challenge.target_speed * challenge.target_speed
            + 2 * gravity * Math.sin(angle) * challenge.target_position,
        );
        return needed_speed <= SPEED_INPUT_MAX && challenge.target_speed > 0;
    }

    /* randomChallenge: imposed angle + target, guaranteed solvable. rng injectable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const candidate = rng() < 0.5
                ? {
                    type: "stop",
                    angle_degrees: Math.round(10 + rng() * 25),
                    target_position: Math.round((2 + rng() * 4) * 10) / 10,
                }
                : {
                    type: "speed",
                    angle_degrees: Math.round(10 + rng() * 20),
                    target_position: Math.round((2 + rng() * 3) * 10) / 10,
                    target_speed: Math.round((1 + rng() * 3) * 10) / 10,
                };
            if (isChallengeFeasible(candidate)) {
                return candidate;
            }
        }
        return { type: "stop", angle_degrees: 20, target_position: 3 };
    }

    globalThis.incline_game = {
        randomChallenge,
        isChallengeFeasible,
        speedWindow,
        MILESTONES,
        GRAVITY,
        STOP_TOLERANCE,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Défi pente", en: "Slope challenge" },
        panel_title: { fr: "Défi pente", en: "Slope challenge" },
        hint: {
            fr: "La pente α est imposée : réglez v₀ et μ. Défi « arrêt » : immobilisez le bloc dans la zone verte (il doit y RESTER — pensez à tan α ≤ μ). Défi « vitesse » : franchissez la porte à la vitesse demandée.",
            en: "The slope α is imposed: tune v₀ and μ. \"Stop\" challenge: bring the block to rest inside the green zone (it must STAY — remember tan α ≤ μ). \"Speed\" challenge: cross the gate at the requested speed.",
        },
        new_target: { fr: "Nouveau défi", en: "New challenge" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Défis réussis", en: "Challenges cleared" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Défi", en: "Challenge" },
        stop_info: {
            fr: "ARRÊT : immobilisez le bloc à s = {s} m (± {tol} m) · pente α = {a}°",
            en: "STOP: bring the block to rest at s = {s} m (± {tol} m) · slope α = {a}°",
        },
        speed_info: {
            fr: "VITESSE : franchissez s = {s} m à v = {v} m/s (± {w}) · pente α = {a}°",
            en: "SPEED: cross s = {s} m at v = {v} m/s (± {w}) · slope α = {a}°",
        },
        live_label: { fr: "État du bloc", en: "Block state" },
        scored: { fr: "DÉFI RÉUSSI !", en: "CHALLENGE CLEARED!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        stopped_wrong: { fr: "Arrêté hors de la zone…", en: "Stopped outside the zone…" },
        slid_back: { fr: "Le bloc n'est pas resté immobile !", en: "The block did not stay put!" },
        too_fast: { fr: "Trop rapide à la porte !", en: "Too fast at the gate!" },
        too_slow: { fr: "Trop lent à la porte !", en: "Too slow at the gate!" },
        never_reached: { fr: "La cible n'a pas été atteinte…", en: "The target was never reached…" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let stopped_seconds = 0;
    let was_inside_zone_stopped = false;
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

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatValue: one-decimal number matching the page locale */
    function formatValue(value) {
        const text = value.toFixed(1);
        return currentLanguage() === "fr" ? text.replace(".", ",") : text;
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

    /* lockAngleInput: impose the challenge's slope angle (restore on exit) */
    function lockAngleInput() {
        const slider = document.getElementById("slider_angle_degrees");
        const number = document.getElementById("number_angle_degrees");
        slider.disabled = game_active;
        number.disabled = game_active;
        if (game_active) {
            number.value = challenge.angle_degrees;
            number.dispatchEvent(new Event("input"));
        }
    }

    /* newChallenge: fresh solvable challenge, run reset, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        attempt_over = true;
        lockAngleInput();
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
        panel_elements.tab_simulation.textContent = strings.tab_simulation[language];
        panel_elements.tab_game.textContent = strings.tab_game[language];
        panel_elements.title.textContent = strings.panel_title[language];
        panel_elements.hint.textContent = strings.hint[language];
        panel_elements.new_target_button.textContent = strings.new_target[language];
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

        cards.target.name.textContent = strings.target_label[language];
        cards.target.value.textContent = challenge.type === "stop"
            ? strings.stop_info[language]
                .replace("{s}", formatValue(challenge.target_position))
                .replace("{tol}", formatValue(STOP_TOLERANCE))
                .replace("{a}", challenge.angle_degrees)
            : strings.speed_info[language]
                .replace("{s}", formatValue(challenge.target_position))
                .replace("{v}", formatValue(challenge.target_speed))
                .replace("{w}", formatValue(speedWindow(challenge.target_speed)))
                .replace("{a}", challenge.angle_degrees);

        cards.live.name.textContent = strings.live_label[language];
    }

    /* setActive: toggle game mode; resets the run so every attempt starts clean */
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
        stopped_seconds = 0;
        attempt_over = true;
        lockAngleInput();
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
        new_target_button.addEventListener("click", newChallenge);
        head.append(title, hint, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            live: createCard("game-value game-live"),
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

    /* showBanner: display a canvas banner for a duration */
    function showBanner(key, color, seconds) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
    }

    /* failAttempt: show the reason, schedule a reset */
    function failAttempt(reason_key) {
        attempt_over = true;
        pending_fail = true;
        showBanner(reason_key, "#d32f2f", 1.6);
        updatePanel();
    }

    /* succeedAttempt: count the goal, celebrate, schedule a new challenge */
    function succeedAttempt(context, transform) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        const target_world = targetWorld(transform);
        spawnConfetti(target_world.x, target_world.y);
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner("scored", "#e8722c", 2);
        updatePanel();
    }

    /* slope helpers matching main.js conventions (start mark 2 m up the slope) */
    function slopeUnit() {
        const angle = challenge.angle_degrees * Math.PI / 180;
        return { x: Math.cos(angle), y: Math.sin(angle) };
    }
    function worldOfPosition(position) {
        const unit = slopeUnit();
        return { x: (2 + position) * unit.x, y: (2 + position) * unit.y };
    }
    function targetWorld(transform) {
        const world = worldOfPosition(challenge.target_position);
        return { x: transform.toScreenX(world.x), y: transform.toScreenY(world.y) };
    }

    /* drawTarget: green stop zone with a flag, or a speed gate with its label */
    function drawTarget(context, transform) {
        const unit = slopeUnit();
        const normal = { x: -unit.y, y: unit.x };
        if (challenge.type === "stop") {
            const from = worldOfPosition(challenge.target_position - STOP_TOLERANCE);
            const to = worldOfPosition(challenge.target_position + STOP_TOLERANCE);
            context.save();
            context.strokeStyle = "rgba(67, 160, 71, 0.9)";
            context.lineWidth = 6;
            context.beginPath();
            context.moveTo(transform.toScreenX(from.x), transform.toScreenY(from.y));
            context.lineTo(transform.toScreenX(to.x), transform.toScreenY(to.y));
            context.stroke();
            context.font = "20px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "bottom";
            const flag = worldOfPosition(challenge.target_position);
            context.fillText("🚩", transform.toScreenX(flag.x + normal.x * 0.3), transform.toScreenY(flag.y + normal.y * 0.3));
            context.restore();
            return;
        }
        const gate = worldOfPosition(challenge.target_position);
        context.save();
        context.strokeStyle = "#8e24aa";
        context.lineWidth = 3;
        context.setLineDash([6, 4]);
        context.beginPath();
        context.moveTo(transform.toScreenX(gate.x), transform.toScreenY(gate.y));
        context.lineTo(
            transform.toScreenX(gate.x + normal.x * 1.2),
            transform.toScreenY(gate.y + normal.y * 1.2),
        );
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#8e24aa";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(
            `|v| = ${formatValue(challenge.target_speed)} ± ${formatValue(speedWindow(challenge.target_speed))} m/s`,
            transform.toScreenX(gate.x + normal.x * 1.5),
            transform.toScreenY(gate.y + normal.y * 1.5),
        );
        context.restore();
    }

    /* drawEffects: confetti particles and banners, advanced by dt */
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
            context.font = "bold 38px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings[banner_key][language], context.canvas.width / 2, 30);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    76,
                );
            }
            context.restore();
            if (banner_seconds <= 0) {
                milestone_level = null;
                if (pending_success) {
                    pending_success = false;
                    newChallenge();
                } else if (pending_fail) {
                    pending_fail = false;
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

        drawTarget(context, transform);
        panel_elements.cards.live.value.textContent =
            `s = ${formatValue(state.position)} m · v = ${formatValue(state.velocity)} m/s`;

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                stopped_seconds = 0;
                was_inside_zone_stopped = false;
                updatePanel();
            }
            if (!attempt_over) {
                checkProgress(context, transform, state);
            }
        }
        previous_state = state;

        drawEffects(context, delta_seconds);
    }

    /* checkProgress: challenge-specific success and failure detection */
    function checkProgress(context, transform, state) {
        const dt = state.time - previous_state.time;
        if (challenge.type === "stop") {
            if (Math.abs(state.velocity) < 1e-6) {
                stopped_seconds += dt;
                was_inside_zone_stopped = Math.abs(state.position - challenge.target_position) <= STOP_TOLERANCE;
                if (stopped_seconds >= 0.6) {
                    if (was_inside_zone_stopped) {
                        succeedAttempt(context, transform);
                    } else {
                        failAttempt("stopped_wrong");
                    }
                }
            } else {
                if (stopped_seconds > 0 && was_inside_zone_stopped) {
                    failAttempt("slid_back");
                    return;
                }
                stopped_seconds = 0;
            }
            if (state.time >= 19.5) {
                failAttempt("never_reached");
            }
            return;
        }
        if (previous_state.position < challenge.target_position && state.position >= challenge.target_position) {
            const crossing_speed = Math.abs(state.velocity);
            const window = speedWindow(challenge.target_speed);
            if (Math.abs(crossing_speed - challenge.target_speed) <= window) {
                succeedAttempt(context, transform);
            } else {
                failAttempt(crossing_speed > challenge.target_speed ? "too_fast" : "too_slow");
            }
            return;
        }
        const turned_around = previous_state.velocity > 0 && state.velocity <= 0
            && state.position < challenge.target_position;
        if (turned_around || state.time >= 19.5) {
            failAttempt("never_reached");
        }
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    /* in game mode, any parameter change resets the run so attempts start clean */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.incline_game_overlay = overlay;
    /* fit-view extent for main.js: keep the target in frame */
    globalThis.incline_game_view_extent = () => (game_active
        ? { max_position: challenge.target_position + 1 }
        : null);
})();
