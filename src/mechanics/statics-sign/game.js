/*
 * game.js — EXPERIMENTAL "hang the sign" game mode for the statics exercise.
 * The challenge imposes the sign mass m1 and the cable angle theta (bar, hook
 * spacing and bar mass locked at the classroom values m2 = 2 kg, L = 1.2 m,
 * d = 0.72 m) and gives two ratings: the cable snaps above T_max and the wall
 * pivot rips out above R_max. The student chooses WHERE to hang the sign along
 * the bar: sliding it toward the pivot unloads the cable but loads the pivot,
 * and vice versa — the moment balance gives a two-sided window of valid
 * positions. Press "Accrocher !" to validate: inside the window the sign holds
 * (confetti); outside, the sign falls with a little animation and the exceeded
 * limit is reported (with the measured T and R, revealed only after the
 * attempt). Every challenge is provably solvable (constructive generation
 * around a reference position + checker + Monte-Carlo tests). Milestone tiers
 * as in the other exercises. Self-contained: to remove, delete this file, its
 * test file, the GAME MODE blocks in index.html, and the marked "Game mode
 * hook" line in main.js. Integration surface: the "game-mode" body class (set
 * here) and globalThis.statics_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.statics_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const LOCKED = { bar_mass: 2, bar_length: 1.2, hook_spacing: 0.72 };
    const POSITION_MIN = 0.1;
    const POSITION_MAX = 1.1;

    /* attemptResult: tension and pivot force for a sign position under a challenge */
    function attemptResult(sign_position, challenge) {
        const calc = globalThis.statics_calcul;
        const angle = challenge.angle_degrees * Math.PI / 180;
        const hooks = calc.hookPositions(LOCKED.bar_length, sign_position, LOCKED.hook_spacing);
        const tension = calc.cableTension(
            challenge.sign_mass, LOCKED.bar_mass, LOCKED.bar_length,
            angle, hooks.left, hooks.right, GRAVITY,
        );
        const pivot = calc.forceMagnitude(
            calc.pivotForceX(tension, angle),
            calc.pivotForceY(challenge.sign_mass, LOCKED.bar_mass, tension, angle, GRAVITY),
        );
        return { tension, pivot };
    }

    /* isAttemptValid: both ratings respected */
    function isAttemptValid(sign_position, challenge) {
        const result = attemptResult(sign_position, challenge);
        return result.tension <= challenge.tension_max && result.pivot <= challenge.pivot_max;
    }

    /* isChallengeFeasible: some position in the slider range respects both ratings */
    function isChallengeFeasible(challenge) {
        for (let position = POSITION_MIN; position <= POSITION_MAX + 1e-9; position += 0.01) {
            if (isAttemptValid(position, challenge)) {
                return true;
            }
        }
        return false;
    }

    /* randomChallenge: built around a reference position with tight margins, so a
       valid window exists but sloppy placements fail. rng injectable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = {
                sign_mass: Math.round((2 + rng() * 4) * 10) / 10,
                angle_degrees: Math.round(35 + rng() * 30),
                tension_max: 0,
                pivot_max: 0,
            };
            const reference_position = 0.25 + rng() * 0.7;
            const reference = attemptResult(reference_position, candidate);
            candidate.tension_max = Math.round(reference.tension * (1.06 + rng() * 0.12) * 10) / 10;
            candidate.pivot_max = Math.round(reference.pivot * (1.04 + rng() * 0.1) * 10) / 10;
            const tight = !isAttemptValid(POSITION_MIN, candidate) || !isAttemptValid(POSITION_MAX, candidate);
            if (tight && isChallengeFeasible(candidate)) {
                return candidate;
            }
        }
        const fallback = { sign_mass: 3, angle_degrees: 60, tension_max: 0, pivot_max: 0 };
        const reference = attemptResult(0.64, fallback);
        fallback.tension_max = Math.round(reference.tension * 1.1 * 10) / 10;
        fallback.pivot_max = Math.round(reference.pivot * 1.08 * 10) / 10;
        return fallback;
    }

    globalThis.statics_game = {
        attemptResult,
        isAttemptValid,
        isChallengeFeasible,
        randomChallenge,
        MILESTONES,
        LOCKED,
        POSITION_MIN,
        POSITION_MAX,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Accroche l'enseigne !", en: "Hang the sign!" },
        panel_title: { fr: "Accroche l'enseigne !", en: "Hang the sign!" },
        hint: {
            fr: "m₁ et θ sont imposés. Choisissez OÙ accrocher l'enseigne : vers le pivot, le câble souffle mais le pivot encaisse ; vers le bout, l'inverse. Calculez avec Σ M = 0, placez, puis accrochez !",
            en: "m₁ and θ are imposed. Choose WHERE to hang the sign: toward the pivot the cable relaxes but the pivot takes the load; toward the tip, the opposite. Compute with Σ M = 0, place it, then hang it!",
        },
        new_target: { fr: "Nouveau défi", en: "New challenge" },
        validate: { fr: "✓ Accrocher !", en: "✓ Hang it!" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Enseignes accrochées", en: "Signs hung" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Défi", en: "Challenge" },
        target_info: {
            fr: "m₁ = {m} kg · θ = {a}° · câble : T_max = {t} N · pivot : R_max = {r} N",
            en: "m₁ = {m} kg · θ = {a}° · cable: T_max = {t} N · pivot: R_max = {r} N",
        },
        last_label: { fr: "Dernière tentative", en: "Last attempt" },
        no_attempt: { fr: "—", en: "—" },
        scored: { fr: "L'ENSEIGNE TIENT !", en: "THE SIGN HOLDS!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        cable_broke: { fr: "Le câble a cassé ! (T = {t} N)", en: "The cable snapped! (T = {t} N)" },
        pivot_broke: { fr: "Le pivot a lâché ! (R = {r} N)", en: "The pivot ripped out! (R = {r} N)" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let last_attempt = null;
    let falling_sign = null;
    let particles = [];
    let banner_seconds = 0;
    let banner_key = null;
    let banner_extra = {};
    let banner_color = "#e8722c";
    let milestone_level = null;
    let pending_success = false;
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

    /* currentSignPosition: read the live input */
    function currentSignPosition() {
        return Number(document.getElementById("number_sign_position").value) || 0.64;
    }

    /* lockInputs: impose the challenge (only the sign position stays editable) */
    function lockInputs() {
        const locks = [
            ["sign_mass", challenge.sign_mass],
            ["bar_mass", LOCKED.bar_mass],
            ["bar_length", LOCKED.bar_length],
            ["angle_degrees", challenge.angle_degrees],
            ["hook_spacing", LOCKED.hook_spacing],
        ];
        for (const [key, value] of locks) {
            const slider = document.getElementById(`slider_${key}`);
            const number = document.getElementById(`number_${key}`);
            slider.disabled = game_active;
            number.disabled = game_active;
            if (game_active) {
                number.value = value;
                number.dispatchEvent(new Event("input"));
            }
        }
    }

    /* newChallenge: fresh solvable challenge */
    function newChallenge() {
        challenge = randomChallenge();
        last_attempt = null;
        falling_sign = null;
        lockInputs();
        updatePanel();
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
        panel_elements.validate_button.textContent = strings.validate[language];
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
            .replace("{m}", formatValue(challenge.sign_mass))
            .replace("{a}", challenge.angle_degrees)
            .replace("{t}", formatValue(challenge.tension_max))
            .replace("{r}", formatValue(challenge.pivot_max));

        cards.last.name.textContent = strings.last_label[language];
        cards.last.value.textContent = last_attempt === null
            ? strings.no_attempt[language]
            : `T = ${formatValue(last_attempt.tension)} / ${formatValue(challenge.tension_max)} N · R = ${formatValue(last_attempt.pivot)} / ${formatValue(challenge.pivot_max)} N`;
    }

    /* setActive: toggle game mode */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        last_attempt = null;
        falling_sign = null;
        particles = [];
        banner_seconds = 0;
        milestone_level = null;
        pending_success = false;
        lockInputs();
        updatePanel();
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

    /* buildUi: mode tabs + stats panel with the validate button */
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
        const validate_button = document.createElement("button");
        validate_button.type = "button";
        validate_button.className = "primary";
        validate_button.addEventListener("click", validateAttempt);
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newChallenge);
        head.append(title, hint, validate_button, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            last: createCard("game-target-value game-last"),
            target: createCard("game-target-value game-target"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = { panel, title, hint, new_target_button, validate_button, tab_simulation, tab_game, cards };
    }

    /* validateAttempt: check both ratings at the chosen position */
    function validateAttempt() {
        if (!game_active || pending_success) {
            return;
        }
        attempts += 1;
        const position = currentSignPosition();
        last_attempt = attemptResult(position, challenge);
        if (last_attempt.tension <= challenge.tension_max && last_attempt.pivot <= challenge.pivot_max) {
            goals += 1;
            pending_success = true;
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            showBanner("scored", "#e8722c", 2.4, {});
        } else if (last_attempt.tension > challenge.tension_max) {
            falling_sign = { time: 0, position };
            showBanner("cable_broke", "#d32f2f", 2, { t: formatValue(last_attempt.tension) });
        } else {
            falling_sign = { time: 0, position };
            showBanner("pivot_broke", "#d32f2f", 2, { r: formatValue(last_attempt.pivot) });
        }
        updatePanel();
    }

    /* showBanner: display a canvas banner for a duration */
    function showBanner(key, color, seconds, extra) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
        banner_extra = extra;
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

    /* drawRatings: T_max along the cable and R_max at the pivot, on the scene */
    function drawRatings(context, transform, state) {
        context.save();
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillStyle = "#8e24aa";
        context.fillText(
            `T_max = ${formatValue(challenge.tension_max)} N`,
            transform.toScreenX(state.bar_length * 0.55),
            transform.toScreenY(Math.min(state.wall_attachment_y, 3.4) * 0.55),
        );
        context.fillStyle = "#43a047";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            `R_max = ${formatValue(challenge.pivot_max)} N`,
            transform.toScreenX(0.1),
            transform.toScreenY(0) + 22,
        );
        context.restore();
    }

    /* drawFallingSign: little fail animation — the sign drops and tilts */
    function drawFallingSign(context, transform, delta_seconds) {
        if (falling_sign === null) {
            return;
        }
        falling_sign.time += delta_seconds;
        const drop = 0.5 * 9.81 * falling_sign.time * falling_sign.time;
        const screen_x = transform.toScreenX(falling_sign.position);
        const screen_y = transform.toScreenY(-0.38 - drop);
        context.save();
        context.translate(screen_x, screen_y);
        context.rotate(falling_sign.time * 1.6);
        context.fillStyle = "rgba(150, 130, 100, 0.9)";
        context.strokeStyle = "#5f5648";
        context.lineWidth = 2;
        context.beginPath();
        context.rect(-46, -14, 92, 28);
        context.fill();
        context.stroke();
        context.restore();
        if (falling_sign.time > 2.5) {
            falling_sign = null;
        }
    }

    /* drawEffects: confetti and banners, advanced by dt */
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
            context.font = "bold 36px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(
                strings[banner_key][language]
                    .replace("{t}", banner_extra.t || "")
                    .replace("{r}", banner_extra.r || ""),
                context.canvas.width / 2,
                30,
            );
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
                }
            }
        }
    }

    /* overlay: called by main.js at the end of every frame */
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

        if (pending_success && particles.length === 0 && banner_seconds > 2.3) {
            spawnConfetti(transform.toScreenX(state.sign_position), transform.toScreenY(-0.4));
        }
        drawRatings(context, transform, state);
        drawFallingSign(context, transform, delta_seconds);
        drawEffects(context, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.statics_game_overlay = overlay;
})();
