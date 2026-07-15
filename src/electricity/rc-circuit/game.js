/*
 * game.js — EXPERIMENTAL RC-timer game mode for the RC-circuit exercise.
 * A buzzer LED fires when the charging capacitor reaches an imposed threshold
 * voltage u_s; the battery E is imposed and locked (charge mode forced), and
 * the student designs the timer by choosing R AND C so the LED fires at the
 * imposed instant t* (±5 %) — the 555-timer principle: the crossing happens
 * at t = τ·ln(E/(E − u_s)) with τ = R·C, so the whole hyperbola R·C = τ*
 * works and the student learns that only the product matters. Every
 * generated situation is provably solvable: t* is built from a reference
 * (R, C) pair on the slider grids and the pure checker re-scans the R grid,
 * snapping C to its own grid (rejection sampling + deterministic fallback
 * E = 9 V, u_s = 5.7 V, t* = 1 s where R = 10 kΩ, C = 100 µF wins).
 * Formulas, graphs and time scrubbing are hidden while active; the meters
 * stay visible; any parameter change resets the run; milestone tiers as in
 * the other exercises. Self-contained: to remove, delete this file, its test
 * file, the GAME MODE blocks in index.html, and the marked "Game mode hook"
 * line in main.js. Integration surface: the "game-mode" body class (set
 * here) and globalThis.rc_circuit_game_overlay (called by main.js each
 * frame). Pure logic is exposed as globalThis.rc_circuit_game for tests.
 */
(() => {
    const calc = globalThis.rc_circuit_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const TOLERANCE = 0.05;
    const RESISTANCE_MIN = 0.1;
    const RESISTANCE_MAX = 100;
    const RESISTANCE_STEP = 0.1;
    const CAPACITANCE_MIN = 1;
    const CAPACITANCE_MAX = 1000;
    const CAPACITANCE_STEP = 1;

    /* triggerFor: LED instant for slider values (R in kΩ, C in µF) */
    function triggerFor(challenge, resistance_kilohms, capacitance_microfarads) {
        return calc.triggerTime(
            challenge.emf,
            calc.timeConstant(resistance_kilohms * 1000, capacitance_microfarads * 1e-6),
            challenge.threshold,
        );
    }

    /* isTimingMet: within the ±5 % tolerance */
    function isTimingMet(trigger_time, target_time) {
        return Number.isFinite(trigger_time)
            && Math.abs(trigger_time - target_time) <= TOLERANCE * target_time + 1e-12;
    }

    /* winningPairs: sample of slider-grid (R, C) pairs firing on time */
    function winningPairs(challenge) {
        const pairs = [];
        const needed_tau = challenge.target_time
            / Math.log(challenge.emf / (challenge.emf - challenge.threshold));
        const steps = Math.round((RESISTANCE_MAX - RESISTANCE_MIN) / RESISTANCE_STEP);
        for (let i = 0; i <= steps; i++) {
            const resistance = Math.round((RESISTANCE_MIN + i * RESISTANCE_STEP) * 10) / 10;
            const capacitance = Math.round(needed_tau / (resistance * 1000) / 1e-6);
            if (capacitance < CAPACITANCE_MIN || capacitance > CAPACITANCE_MAX) {
                continue;
            }
            if (isTimingMet(triggerFor(challenge, resistance, capacitance), challenge.target_time)) {
                pairs.push({ resistance_kilohms: resistance, capacitance_microfarads: capacitance });
            }
        }
        return pairs;
    }

    /* isSituationFeasible: a slider-grid (R, C) pair fires at the target */
    function isSituationFeasible(challenge) {
        if (challenge.emf < 6 || challenge.emf > 24
            || !(challenge.threshold > 0.2 * challenge.emf) || challenge.threshold > 0.85 * challenge.emf
            || !(challenge.target_time >= 0.5) || challenge.target_time > 8) {
            return false;
        }
        return winningPairs(challenge).length > 0;
    }

    /* randomChallenge: imposed E and threshold on displayable grids, target
       time built from a reference (R, C) pair — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const emf = 6 + Math.round(rng() * 36) / 2;
            const threshold = Math.round((0.4 + rng() * 0.4) * emf * 10) / 10;
            const resistance = Math.round((1 + rng() * 40) * 10) / 10;
            const capacitance = 10 + Math.round(rng() * 490);
            const candidate = { emf, threshold, target_time: 0 };
            candidate.target_time = Math.round(triggerFor(candidate, resistance, capacitance) * 100) / 100;
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { emf: 9, threshold: 5.7, target_time: 1 };
    }

    globalThis.rc_circuit_game = {
        triggerFor,
        isTimingMet,
        winningPairs,
        isSituationFeasible,
        randomChallenge,
        MILESTONES,
        TOLERANCE,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Le temporisateur", en: "The timer" },
        panel_title: { fr: "Le temporisateur", en: "The timer" },
        hint: {
            fr: "La LED s'allume quand u_C atteint le seuil u_s. Choisissez R ET C pour qu'elle s'allume à l'instant demandé (±5 %) : t = R·C·ln(E/(E − u_s)) — tout le produit R·C marche !",
            en: "The LED fires when u_C reaches the threshold u_s. Pick R AND C so it fires at the requested instant (±5 %): t = R·C·ln(E/(E − u_s)) — the whole R·C product works!",
        },
        new_target: { fr: "Nouveau minuteur", en: "New timer" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Minuteries réglées", en: "Timers set" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "E = {e} V · seuil u_s = {s} V · LED à t = {t} s (±5 %)",
            en: "E = {e} V · threshold u_s = {s} V · LED at t = {t} s (±5 %)",
        },
        product_hint: { fr: "t = R·C·ln(E/(E − u_s)) — réglez R et C puis lancez", en: "t = R·C·ln(E/(E − u_s)) — tune R and C then play" },
        fired: { fr: "PILE À L'HEURE ! LED à t = {t} s", en: "RIGHT ON TIME! LED at t = {t} s" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        too_early: { fr: "Trop tôt… LED à t = {t} s", en: "Too early… LED at t = {t} s" },
        too_late: { fr: "Trop tard… LED à t = {t} s", en: "Too late… LED at t = {t} s" },
        never: { fr: "La LED ne s'est pas allumée dans la fenêtre…", en: "The LED never fired in the window…" },
        threshold_label: { fr: "seuil u_s", en: "threshold u_s" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = ["slider_emf", "number_emf", "toggle_discharge_mode"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let led_time = null;
    let previous_state = null;
    let particles = [];
    let banner_text = null;
    let banner_seconds = 0;
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

    /* formatValue: locale decimal separator with a chosen precision */
    function formatValue(value, decimals = 2) {
        const text = value.toFixed(decimals);
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

    /* setInputValue: push an imposed value into a main.js control pair */
    function setInputValue(input_id, value) {
        const input = document.getElementById(input_id);
        input.value = value;
        input.dispatchEvent(new Event("input"));
    }

    /* applyChallenge: impose E, force charge mode, reset the player's R and C */
    function applyChallenge() {
        setInputValue("number_emf", challenge.emf);
        const toggle = document.getElementById("toggle_discharge_mode");
        if (toggle.checked) {
            toggle.checked = false;
            toggle.dispatchEvent(new Event("input"));
        }
        setInputValue("number_resistance_kilohms", 5);
        setInputValue("number_capacitance_microfarads", 50);
    }

    /* setInputsLocked: only R and C stay editable during a mission */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible timer, run reset, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        applyChallenge();
        attempt_over = true;
        led_time = null;
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
            .replace("{e}", formatValue(challenge.emf, 1))
            .replace("{s}", formatValue(challenge.threshold, 1))
            .replace("{t}", formatValue(challenge.target_time));
        cards.target.sub.textContent = strings.product_hint[language];
    }

    /* setActive: toggle game mode; imposes the mission and locks its inputs */
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
        attempt_over = true;
        led_time = null;
        setInputsLocked(active);
        if (active) {
            applyChallenge();
        }
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
    function showBanner(text, color, seconds) {
        banner_text = text;
        banner_color = color;
        banner_seconds = seconds;
    }

    /* failAttempt: show the reason, schedule a reset */
    function failAttempt(text) {
        attempt_over = true;
        pending_fail = true;
        showBanner(text, "#d32f2f", 1.8);
        updatePanel();
    }

    /* succeedAttempt: count the timer, celebrate, schedule a new mission */
    function succeedAttempt(context, transform, fired_at) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX(6), transform.toScreenY(0));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(strings.fired[currentLanguage()].replace("{t}", formatValue(fired_at)), "#43a047", 2);
        updatePanel();
    }

    /* drawTimer: LED beside the capacitor plus the threshold and chrono text */
    function drawTimer(context, transform, state) {
        const led_x = transform.toScreenX(6);
        const led_y = transform.toScreenY(1.6);
        const lit = led_time !== null;
        context.save();
        if (lit) {
            const gradient = context.createRadialGradient(led_x, led_y, 3, led_x, led_y, 26);
            gradient.addColorStop(0, "rgba(255, 214, 64, 0.95)");
            gradient.addColorStop(1, "rgba(255, 214, 64, 0)");
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(led_x, led_y, 26, 0, 2 * Math.PI);
            context.fill();
        }
        context.fillStyle = lit ? "#fbc02d" : "rgba(120, 130, 145, 0.35)";
        context.strokeStyle = "#b8860b";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(led_x, led_y, 8, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            `${strings.threshold_label[currentLanguage()]} = ${formatValue(challenge.threshold, 1)} V · ⏱ ${formatValue(state.time)} s`,
            context.canvas.width / 2,
            14,
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

        if (banner_seconds > 0) {
            banner_seconds -= delta_seconds;
            context.save();
            context.globalAlpha = Math.min(banner_seconds, 1);
            context.fillStyle = banner_color;
            context.font = "bold 34px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(banner_text, context.canvas.width / 2, 44);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    88,
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
                    led_time = null;
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

        drawTimer(context, transform, state);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                led_time = null;
                updatePanel();
            }
            if (!attempt_over) {
                if (led_time === null && !state.discharge_mode
                    && previous_state.voltage < challenge.threshold && state.voltage >= challenge.threshold) {
                    const ratio = (challenge.threshold - previous_state.voltage)
                        / (state.voltage - previous_state.voltage);
                    led_time = previous_state.time + ratio * (state.time - previous_state.time);
                    if (isTimingMet(led_time, challenge.target_time)) {
                        succeedAttempt(context, transform, led_time);
                    } else if (led_time < challenge.target_time) {
                        failAttempt(strings.too_early[currentLanguage()].replace("{t}", formatValue(led_time)));
                    } else {
                        failAttempt(strings.too_late[currentLanguage()].replace("{t}", formatValue(led_time)));
                    }
                } else if (led_time === null && state.time >= state.total_time - 1e-9) {
                    failAttempt(strings.never[currentLanguage()]);
                }
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

    /* in game mode, any parameter change resets the run — otherwise a half-played
       charge could be probed before committing to R and C */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            led_time = null;
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.rc_circuit_game_overlay = overlay;
})();
