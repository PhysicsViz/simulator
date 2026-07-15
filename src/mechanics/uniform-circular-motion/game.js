/*
 * game.js — EXPERIMENTAL "don't soak the teacher" game mode for the uniform
 * circular motion exercise: the classic bucket-of-water problem. A bucket of
 * water spins in a VERTICAL circle (radius R and mass m imposed by the
 * challenge, inputs locked) while the teacher stands right below. The student
 * picks the constant speed v: too slow and the water falls out at the top
 * (v < √(g·R) — the classic result), too fast and the rope snaps at the bottom
 * (T = m·(v²/R + g) > T_max) — either way the teacher gets soaked. Surviving
 * two full revolutions dry scores. Every challenge is provably solvable: the
 * generated T_max always leaves a speed window above √(g·R) inside the slider
 * range (pure checker + Monte-Carlo tests). Milestone tiers as in the other
 * exercises. Self-contained: to remove, delete this file, its test file, the
 * GAME MODE blocks in index.html, and the marked "Game mode hook" lines in
 * main.js. Integration surface: the "game-mode" body class (set here),
 * globalThis.circular_motion_game_overlay (called by main.js each frame) and
 * globalThis.circular_motion_game_view_extent (read by main.js fitView).
 * Pure logic is exposed as globalThis.circular_motion_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const SPEED_MIN = 0.5;
    const SPEED_MAX = 15;
    const REVOLUTIONS_TO_WIN = 2;

    /* isChallengeFeasible: a winning speed window [√(g·R), v_max] exists inside
       the speed input range, with at least 10% width */
    function isChallengeFeasible(challenge, gravity = GRAVITY) {
        const minimum_speed = Math.sqrt(gravity * challenge.radius);
        const max_speed_squared = (challenge.tension_max / challenge.mass - gravity) * challenge.radius;
        if (max_speed_squared <= 0) {
            return false;
        }
        const maximum_speed = Math.sqrt(max_speed_squared);
        return minimum_speed >= SPEED_MIN
            && minimum_speed <= SPEED_MAX
            && maximum_speed >= minimum_speed * 1.1
            && minimum_speed < SPEED_MAX;
    }

    /* randomChallenge: radius, bucket mass and rope limit with a guaranteed window.
       At the minimum speed the bottom tension is m·(g·R/R + g) = 2·m·g, so any
       T_max = 2·m·g·(1.2 … 2.0) leaves 20–100% tension headroom. rng injectable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = {
                radius: Math.round((0.5 + rng() * 0.8) * 10) / 10,
                mass: Math.round((0.5 + rng() * 1) * 10) / 10,
                tension_max: 0,
            };
            candidate.tension_max = 2 * candidate.mass * GRAVITY * (1.2 + rng() * 0.8);
            if (isChallengeFeasible(candidate)) {
                return candidate;
            }
        }
        return { radius: 0.8, mass: 1, tension_max: 2 * GRAVITY * 1.5 };
    }

    globalThis.circular_motion_game = {
        randomChallenge,
        isChallengeFeasible,
        MILESTONES,
        GRAVITY,
        SPEED_MIN,
        SPEED_MAX,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Ne mouille pas le prof !", en: "Don't soak the teacher!" },
        panel_title: { fr: "Ne mouille pas le prof !", en: "Don't soak the teacher!" },
        hint: {
            fr: "Le seau d'eau tourne en cercle vertical au-dessus du prof. Trop lent au sommet : l'eau tombe. Trop rapide : la corde casse en bas (T > T_max). Choisissez v et tenez deux tours complets !",
            en: "The water bucket spins in a vertical circle above the teacher. Too slow at the top: the water falls. Too fast: the rope snaps at the bottom (T > T_max). Pick v and survive two full revolutions!",
        },
        new_target: { fr: "Nouveau défi", en: "New challenge" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Profs restés secs", en: "Teachers kept dry" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Défi", en: "Challenge" },
        target_info: {
            fr: "R = {r} m · m = {m} kg · corde : T_max = {t} N",
            en: "R = {r} m · m = {m} kg · rope: T_max = {t} N",
        },
        tension_label: { fr: "Tension actuelle", en: "Current tension" },
        scored: { fr: "LE PROF EST SEC !", en: "THE TEACHER IS DRY!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        water_fell: { fr: "L'eau est tombée — prof mouillé !", en: "The water fell — teacher soaked!" },
        rope_broke: { fr: "La corde a cassé — tout sur le prof !", en: "The rope snapped — all over the teacher!" },
    };

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let previous_state = null;
    let drops = [];
    let banner_seconds = 0;
    let banner_key = null;
    let banner_color = "#e8722c";
    let milestone_level = null;
    let pending_success = false;
    let pending_fail = false;
    let teacher_soaked = false;
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

    /* lockChallengeInputs: impose the challenge's R and m (restore on exit) */
    function lockChallengeInputs() {
        for (const [key, value] of [["radius", challenge.radius], ["mass", challenge.mass]]) {
            const slider = document.getElementById(`slider_${key}`);
            const number = document.getElementById(`number_${key}`);
            slider.disabled = game_active;
            number.disabled = game_active;
            if (game_active) {
                number.value = value.toFixed(1);
                number.dispatchEvent(new Event("input"));
            }
        }
    }

    /* newChallenge: fresh feasible challenge, spin reset, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        attempt_over = true;
        teacher_soaked = false;
        lockChallengeInputs();
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
        cards.target.value.textContent = strings.target_info[language]
            .replace("{r}", formatValue(challenge.radius))
            .replace("{m}", formatValue(challenge.mass))
            .replace("{t}", formatValue(challenge.tension_max));

        cards.tension.name.textContent = strings.tension_label[language];
    }

    /* setActive: toggle game mode; resets the spin so every attempt starts clean */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        previous_state = null;
        drops = [];
        banner_seconds = 0;
        milestone_level = null;
        pending_success = false;
        pending_fail = false;
        teacher_soaked = false;
        attempt_over = true;
        lockChallengeInputs();
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
            tension: createCard("game-value game-tension"),
            target: createCard("game-target-value game-target"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = { panel, title, hint, new_target_button, tab_simulation, tab_game, cards };
    }

    /* spawnDrops: burst of water drops (screen px) with an initial velocity */
    function spawnDrops(screen_x, screen_y, velocity_x, velocity_y) {
        for (let i = 0; i < 40; i++) {
            drops.push({
                x: screen_x + (Math.random() - 0.5) * 14,
                y: screen_y + (Math.random() - 0.5) * 8,
                velocity_x: velocity_x + (Math.random() - 0.5) * 60,
                velocity_y: velocity_y + (Math.random() - 0.5) * 40,
                life: 3,
            });
        }
    }

    /* showBanner: display a canvas banner for a duration */
    function showBanner(key, color, seconds) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
    }

    /* failAttempt: pause the spin, soak the teacher, schedule a reset */
    function failAttempt(reason_key) {
        attempt_over = true;
        pending_fail = true;
        teacher_soaked = true;
        showBanner(reason_key, "#d32f2f", 2);
        document.getElementById("play_pause_button").click();
        updatePanel();
    }

    /* succeedAttempt: count the dry teacher, celebrate, schedule a new challenge */
    function succeedAttempt(context) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
        }
        spawnDrops(context.canvas.width / 2, context.canvas.height / 3, 0, -120);
        showBanner("scored", "#e8722c", 2);
        updatePanel();
    }

    /* drawSceneExtras: ground, teacher, bucket over the ball, rope limit label */
    function drawSceneExtras(context, transform, state) {
        const ground_y = groundWorldY();
        const ground_screen = transform.toScreenY(ground_y);
        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.10)";
        context.fillRect(0, ground_screen, context.canvas.width, context.canvas.height - ground_screen);
        context.strokeStyle = "rgba(120, 130, 145, 0.8)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, ground_screen);
        context.lineTo(context.canvas.width, ground_screen);
        context.stroke();

        const teacher_x = transform.toScreenX(0);
        context.font = "42px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText("🧑‍🏫", teacher_x, ground_screen + 2);
        if (teacher_soaked) {
            context.font = "26px system-ui, sans-serif";
            context.fillText("💦", teacher_x, ground_screen - 38);
        }

        context.fillStyle = "#8e24aa";
        context.font = "bold 12px system-ui, sans-serif";
        context.textBaseline = "middle";
        context.fillText(
            `T_max = ${formatValue(challenge.tension_max)} N`,
            transform.toScreenX(0),
            transform.toScreenY(0) - 16,
        );
        context.restore();

        const bucket_x = transform.toScreenX(state.radius * Math.cos(state.angle));
        const bucket_y = transform.toScreenY(state.radius * Math.sin(state.angle));
        context.save();
        context.font = "26px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("🪣", bucket_x, bucket_y);
        context.restore();
    }

    /* groundWorldY: the teacher stands a little below the circle */
    function groundWorldY() {
        return -challenge.radius - 0.9;
    }

    /* drawEffects: water drops (projectile motion in screen px) and banners */
    function drawEffects(context, transform, delta_seconds) {
        const ground_screen = transform.toScreenY(groundWorldY());
        const surviving_drops = [];
        for (const drop of drops) {
            drop.life -= delta_seconds;
            drop.velocity_y += 500 * delta_seconds;
            drop.x += drop.velocity_x * delta_seconds;
            drop.y += drop.velocity_y * delta_seconds;
            if (drop.life <= 0 || drop.y > ground_screen + 6) {
                continue;
            }
            context.save();
            context.fillStyle = "rgba(25, 118, 210, 0.85)";
            context.beginPath();
            context.arc(drop.x, drop.y, 3, 0, 2 * Math.PI);
            context.fill();
            context.restore();
            surviving_drops.push(drop);
        }
        drops = surviving_drops;

        const language = currentLanguage();
        if (banner_seconds > 0) {
            banner_seconds -= delta_seconds;
            context.save();
            context.globalAlpha = Math.min(banner_seconds, 1);
            context.fillStyle = banner_color;
            context.font = "bold 36px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings[banner_key][language], context.canvas.width / 2, 30);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    74,
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
                    teacher_soaked = false;
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

        drawSceneExtras(context, transform, state);
        const tension = globalThis.circular_motion_calcul.ropeTension(
            state.mass, GRAVITY, state.radius, state.speed, state.angle,
        );
        panel_elements.cards.tension.value.textContent =
            `${formatValue(Math.max(tension, 0))} / ${formatValue(challenge.tension_max)} N`;

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                teacher_soaked = false;
                updatePanel();
            }
            if (!attempt_over) {
                checkProgress(context, transform, state);
            }
        }
        previous_state = state;

        drawEffects(context, transform, delta_seconds);
    }

    /* crossed: the angle passed a marker angle (mod 2π) between two samples */
    function crossed(previous_angle, current_angle, marker) {
        const turns_before = Math.floor((previous_angle - marker) / (2 * Math.PI));
        const turns_after = Math.floor((current_angle - marker) / (2 * Math.PI));
        return turns_after > turns_before;
    }

    /* checkProgress: top crossing → water check, bottom crossing → rope check,
       two full revolutions dry → success */
    function checkProgress(context, transform, state) {
        const minimum_speed = Math.sqrt(GRAVITY * state.radius);
        if (crossed(previous_state.angle, state.angle, Math.PI / 2)
            && state.speed < minimum_speed) {
            const top_x = transform.toScreenX(0);
            const top_y = transform.toScreenY(state.radius);
            spawnDrops(top_x, top_y, -state.speed * 30, 0);
            failAttempt("water_fell");
            return;
        }
        if (crossed(previous_state.angle, state.angle, -Math.PI / 2)) {
            const bottom_tension = globalThis.circular_motion_calcul.ropeTension(
                state.mass, GRAVITY, state.radius, state.speed, -Math.PI / 2,
            );
            if (bottom_tension > challenge.tension_max) {
                spawnDrops(
                    transform.toScreenX(0),
                    transform.toScreenY(-state.radius),
                    state.speed * 30,
                    -80,
                );
                failAttempt("rope_broke");
                return;
            }
        }
        if (state.angle >= REVOLUTIONS_TO_WIN * 2 * Math.PI) {
            succeedAttempt(context);
        }
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    /* in game mode, any parameter change resets the spin so every attempt starts
       at theta = 0 with the chosen speed */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.circular_motion_game_overlay = overlay;
    /* fit-view extent for main.js: keep the ground and the teacher in frame */
    globalThis.circular_motion_game_view_extent = () => (game_active
        ? { bottom: groundWorldY() - 0.3 }
        : null);
})();
