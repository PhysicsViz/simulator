/*
 * game.js — EXPERIMENTAL atomic-generator game mode for the electron-orbit
 * exercise. A target average current is imposed (±2 %) and the student tunes
 * BOTH the orbit radius R and the electron speed v to produce it, then
 * presses "check": since I = e·v/(2πR), infinitely many (R, v) pairs work —
 * the whole line v = 2πR·I/e — and the student learns the proportionality by
 * picking any of them. The gate counter stays visible (reading Q and t to get
 * I = Q/t is a legitimate measurement path); the formula cards are hidden.
 * Every generated target is provably solvable: it is built from a reference
 * (R, v) pair on the slider grids and the pure checker re-scans the R grid
 * (snapping v to its own grid) for a winning pair (rejection sampling +
 * deterministic fallback R = 53 pm, v = 2200 km/s → I ≈ 1.058 mA). Milestone
 * tiers as in the other exercises. Self-contained: to remove, delete this
 * file, its test file, the GAME MODE blocks in index.html, and the marked
 * "Game mode hook" line in main.js. Integration surface: the "game-mode"
 * body class (set here) and globalThis.electron_orbit_game_overlay (called
 * by main.js each frame). Pure logic is exposed as
 * globalThis.electron_orbit_game for tests.
 */
(() => {
    const calc = globalThis.electron_orbit_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const TOLERANCE = 0.02;
    const RADIUS_MIN = 10;
    const RADIUS_MAX = 500;
    const RADIUS_STEP = 1;
    const SPEED_MIN = 100;
    const SPEED_MAX = 10000;
    const SPEED_STEP = 10;
    const TARGET_MIN_AMPS = 5e-5;
    const TARGET_MAX_AMPS = 2e-2;

    /* currentFor: I for slider values (R in pm, v in km/s) */
    function currentFor(radius_picometers, speed_kilometers) {
        return calc.averageCurrent(radius_picometers * 1e-12, speed_kilometers * 1000);
    }

    /* isTargetMet: within the ±2 % tolerance */
    function isTargetMet(current, target) {
        return Math.abs(current - target) <= TOLERANCE * target + 1e-18;
    }

    /* roundSignificant: round to a number of significant digits */
    function roundSignificant(value, digits) {
        if (value === 0) {
            return 0;
        }
        const scale = Math.pow(10, digits - 1 - Math.floor(Math.log10(Math.abs(value))));
        return Math.round(value * scale) / scale;
    }

    /* winningPairs: sample of slider-grid (R, v) pairs producing the target */
    function winningPairs(challenge) {
        const pairs = [];
        for (let radius = RADIUS_MIN; radius <= RADIUS_MAX; radius += RADIUS_STEP) {
            const exact_speed = 2 * Math.PI * (radius * 1e-12) * challenge.target_amps
                / calc.ELEMENTARY_CHARGE / 1000;
            const speed = Math.round(exact_speed / SPEED_STEP) * SPEED_STEP;
            if (speed < SPEED_MIN || speed > SPEED_MAX) {
                continue;
            }
            if (isTargetMet(currentFor(radius, speed), challenge.target_amps)) {
                pairs.push({ radius_picometers: radius, speed_kilometers: speed });
            }
        }
        return pairs;
    }

    /* isSituationFeasible: a slider-grid pair produces the target current */
    function isSituationFeasible(challenge) {
        if (!(challenge.target_amps >= TARGET_MIN_AMPS) || !(challenge.target_amps <= TARGET_MAX_AMPS)) {
            return false;
        }
        return winningPairs(challenge).length > 0;
    }

    /* randomChallenge: target built from a reference grid pair — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const radius = RADIUS_MIN + Math.round(rng() * (RADIUS_MAX - RADIUS_MIN));
            const speed = SPEED_MIN + Math.round(rng() * (SPEED_MAX - SPEED_MIN) / SPEED_STEP) * SPEED_STEP;
            const candidate = { target_amps: roundSignificant(currentFor(radius, speed), 4) };
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { target_amps: roundSignificant(currentFor(53, 2200), 4) };
    }

    globalThis.electron_orbit_game = {
        currentFor,
        isTargetMet,
        roundSignificant,
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
        tab_game: { fr: "Le générateur atomique", en: "The atomic generator" },
        panel_title: { fr: "Le générateur atomique", en: "The atomic generator" },
        hint: {
            fr: "Produisez exactement le courant demandé (±2 %) en réglant R ET v — une infinité de couples marchent, à vous de trouver le vôtre avec I = e·v/(2πR) !",
            en: "Produce exactly the requested current (±2 %) by tuning R AND v — infinitely many pairs work, find yours with I = e·v/(2πR)!",
        },
        new_target: { fr: "Nouvelle cible", en: "New target" },
        check_button: { fr: "Vérifier le courant", en: "Check the current" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Courants produits", en: "Currents produced" },
        attempts_label: { fr: "Essais", en: "Tries" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: { fr: "cible : I = {i} mA (±2 %)", en: "target: I = {i} mA (±2 %)" },
        free_hint: { fr: "R et v sont libres — I = e·v/(2πR)", en: "R and v are free — I = e·v/(2πR)" },
        matched: { fr: "COURANT NOMINAL ! I = {i} mA", en: "NOMINAL CURRENT! I = {i} mA" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        missed: { fr: "Écart de {e} % — réglez encore…", en: "Off by {e} % — keep tuning…" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let particles = [];
    let banner_text = null;
    let banner_seconds = 0;
    let banner_color = "#e8722c";
    let milestone_level = null;
    let pending_success = false;
    let last_overlay_milliseconds = null;
    let panel_elements = null;

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatValue: locale decimal separator with a chosen precision */
    function formatValue(value, decimals = 3) {
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

    /* newChallenge: fresh solvable target, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        updatePanel();
    }

    /* checkCurrent: the attempt — judge the current produced by the sliders */
    function checkCurrent() {
        const produced = currentFor(
            Number(document.getElementById("number_radius_picometers").value),
            Number(document.getElementById("number_speed_kilometers").value),
        );
        attempts += 1;
        if (isTargetMet(produced, challenge.target_amps)) {
            goals += 1;
            pending_success = true;
            const canvas = document.getElementById("simulation_canvas");
            spawnConfetti(canvas.width / 2, canvas.height / 2);
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            showBanner(
                strings.matched[currentLanguage()].replace("{i}", formatValue(produced * 1000)),
                "#43a047",
                2.2,
            );
        } else {
            const error_percent = 100 * Math.abs(produced - challenge.target_amps) / challenge.target_amps;
            showBanner(
                strings.missed[currentLanguage()].replace("{e}", formatValue(Math.min(error_percent, 999), 1)),
                "#d32f2f",
                1.8,
            );
        }
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
        panel_elements.check_button.textContent = strings.check_button[language];
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
            .replace("{i}", formatValue(challenge.target_amps * 1000));
        cards.target.sub.textContent = strings.free_hint[language];
    }

    /* setActive: toggle game mode */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        particles = [];
        banner_seconds = 0;
        milestone_level = null;
        pending_success = false;
        if (active) {
            newChallenge();
        }
        updatePanel();
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

    /* buildUi: mode tabs + stats panel with the check button */
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
        const action_wrap = document.createElement("div");
        action_wrap.className = "action-wrap";
        const check_button = document.createElement("button");
        check_button.type = "button";
        check_button.className = "primary";
        check_button.addEventListener("click", checkCurrent);
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newChallenge);
        action_wrap.append(check_button, new_target_button);
        head.append(title, hint, action_wrap);

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

        panel_elements = { panel, title, hint, new_target_button, check_button, tab_simulation, tab_game, cards };
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
            context.font = "bold 32px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(banner_text, context.canvas.width / 2, 78);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    118,
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

        drawEffects(context, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.electron_orbit_game_overlay = overlay;
})();
