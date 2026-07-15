/*
 * game.js — EXPERIMENTAL lighthouse-lamp game mode for the simple-circuit
 * exercise. The lamp has a rated power P_nom (±5 %): E and r are imposed and
 * locked, and the student tunes the load R, then presses "light it" — below
 * 95 % the lamp is too dim, above 105 % it burns out 💥. Since
 * P_R = E²·R/(R + r)², every rated power below P_max = E²/(4r) has TWO valid
 * loads (one on each side of R = r): both are accepted. Every generated
 * situation is provably solvable: the rated power is drawn well below P_max
 * and a pure checker scans the 0.1 Ω slider grid for a winning R (rejection
 * sampling + deterministic fallback E = 12 V, r = 2 Ω, P_nom = 8 W).
 * Formulas and graphs are hidden while active (they reveal P(R)); the meters
 * stay visible — reading U and I to get P = U·I is the intended reasoning.
 * Milestone tiers as in the other exercises. Self-contained: to remove,
 * delete this file, its test file, the GAME MODE blocks in index.html, and
 * the marked "Game mode hook" lines in main.js. Integration surface: the
 * "game-mode" body class (set here) and
 * globalThis.simple_circuit_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.simple_circuit_game for tests.
 */
(() => {
    const calc = globalThis.simple_circuit_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const TOLERANCE = 0.05;
    const LOAD_MIN = 0.1;
    const LOAD_MAX = 50;
    const LOAD_STEP = 0.1;
    const EMF_MIN = 6;
    const EMF_MAX = 24;
    const INTERNAL_MIN = 0.5;
    const INTERNAL_MAX = 6;

    /* lampVerdict: rated ±5 % lights, above burns, below stays dim */
    function lampVerdict(power, rated_power) {
        if (power > (1 + TOLERANCE) * rated_power + 1e-12) {
            return "burned";
        }
        if (power >= (1 - TOLERANCE) * rated_power - 1e-12) {
            return "lit";
        }
        return "dim";
    }

    /* winningLoads: every slider-grid R that lights the lamp */
    function winningLoads(challenge) {
        const loads = [];
        const steps = Math.round((LOAD_MAX - LOAD_MIN) / LOAD_STEP);
        for (let i = 0; i <= steps; i++) {
            const load = Math.round((LOAD_MIN + i * LOAD_STEP) * 10) / 10;
            const circuit_current = calc.current(challenge.emf, challenge.internal_resistance, load);
            if (lampVerdict(calc.loadPower(load, circuit_current), challenge.rated_power) === "lit") {
                loads.push(load);
            }
        }
        return loads;
    }

    /* isSituationFeasible: a slider-grid R lights the lamp, with margin to P_max */
    function isSituationFeasible(challenge) {
        if (challenge.emf < EMF_MIN || challenge.emf > EMF_MAX
            || challenge.internal_resistance < INTERNAL_MIN || challenge.internal_resistance > INTERNAL_MAX
            || !(challenge.rated_power >= 1)) {
            return false;
        }
        if (challenge.rated_power > 0.88 * calc.maxLoadPower(challenge.emf, challenge.internal_resistance)) {
            return false;
        }
        return winningLoads(challenge).length > 0;
    }

    /* randomChallenge: imposed battery on the slider grids, rated power well
       below E²/(4r) — always solvable, usually with two R windows */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const candidate = {
                emf: EMF_MIN + Math.round(rng() * (EMF_MAX - EMF_MIN) * 2) / 2,
                internal_resistance: INTERNAL_MIN + Math.round(rng() * (INTERNAL_MAX - INTERNAL_MIN) * 2) / 2,
                rated_power: 0,
            };
            const max_power = calc.maxLoadPower(candidate.emf, candidate.internal_resistance);
            candidate.rated_power = Math.round((0.3 + rng() * 0.55) * max_power * 10) / 10;
            if (candidate.rated_power >= 1 && isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { emf: 12, internal_resistance: 2, rated_power: 8 };
    }

    globalThis.simple_circuit_game = {
        lampVerdict,
        winningLoads,
        isSituationFeasible,
        randomChallenge,
        MILESTONES,
        TOLERANCE,
        LOAD_STEP,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "La lampe du phare", en: "The lighthouse lamp" },
        panel_title: { fr: "La lampe du phare", en: "The lighthouse lamp" },
        hint: {
            fr: "E et r sont imposés. Réglez R pour alimenter la lampe à sa puissance nominale (±5 %) puis allumez : trop faible elle éclaire mal, trop fort elle grille ! Astuce : P = U·I sur les cadrans.",
            en: "E and r are imposed. Tune R to feed the lamp at its rated power (±5 %) then switch it on: too little and it is dim, too much and it burns out! Hint: P = U·I on the dials.",
        },
        new_target: { fr: "Nouvelle lampe", en: "New lamp" },
        light_button: { fr: "Allumer la lampe", en: "Light the lamp" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Lampes allumées", en: "Lamps lit" },
        attempts_label: { fr: "Essais", en: "Tries" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "lampe nominale {p} W (±5 %) · E = {e} V · r = {r} Ω",
            en: "rated lamp {p} W (±5 %) · E = {e} V · r = {r} Ω",
        },
        two_solutions: { fr: "il existe deux R gagnants — un de chaque côté de R = r !", en: "two winning R exist — one on each side of R = r!" },
        lit: { fr: "PLEINS FEUX ! P = {p} W", en: "FULL BEAM! P = {p} W" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        burned: { fr: "💥 GRILLÉE ! P = {p} W > 105 % de {n} W", en: "💥 BURNED OUT! P = {p} W > 105 % of {n} W" },
        dim: { fr: "Trop faible… P = {p} W < 95 % de {n} W", en: "Too dim… P = {p} W < 95 % of {n} W" },
        open_warning: { fr: "Fermez d'abord l'interrupteur !", en: "Close the switch first!" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_emf", "number_emf",
        "slider_internal_resistance", "number_internal_resistance",
    ];

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
    let burn_seconds = 0;
    let last_overlay_milliseconds = null;
    let last_state = null;
    let panel_elements = null;

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatValue: locale decimal separator with a chosen precision */
    function formatValue(value, decimals = 1) {
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

    /* applyChallenge: impose the battery, reset the player's load and the switch */
    function applyChallenge() {
        setInputValue("number_emf", challenge.emf);
        setInputValue("number_internal_resistance", challenge.internal_resistance);
        setInputValue("number_load_resistance", 25);
        const toggle = document.getElementById("toggle_switch_closed");
        if (!toggle.checked) {
            toggle.checked = true;
            toggle.dispatchEvent(new Event("input"));
        }
    }

    /* setInputsLocked: only R and the switch stay editable during a mission */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible lamp, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        applyChallenge();
        updatePanel();
        document.getElementById("zoom_fit_button").click();
    }

    /* testLamp: the attempt — judge the current load power against the rating */
    function testLamp() {
        if (last_state === null) {
            return;
        }
        if (!last_state.switch_closed) {
            showBanner(strings.open_warning[currentLanguage()], "#e8722c", 1.4);
            return;
        }
        attempts += 1;
        const verdict = lampVerdict(last_state.load_power, challenge.rated_power);
        if (verdict === "lit") {
            goals += 1;
            pending_success = true;
            const canvas = document.getElementById("simulation_canvas");
            spawnConfetti(canvas.width * 0.65, canvas.height / 2);
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            showBanner(
                strings.lit[currentLanguage()].replace("{p}", formatValue(last_state.load_power)),
                "#43a047",
                2.2,
            );
        } else {
            if (verdict === "burned") {
                burn_seconds = 1.8;
            }
            showBanner(
                strings[verdict][currentLanguage()]
                    .replace("{p}", formatValue(last_state.load_power))
                    .replace("{n}", formatValue(challenge.rated_power)),
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
        panel_elements.light_button.textContent = strings.light_button[language];
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
            .replace("{p}", formatValue(challenge.rated_power))
            .replace("{e}", formatValue(challenge.emf))
            .replace("{r}", formatValue(challenge.internal_resistance));
        cards.target.sub.textContent = strings.two_solutions[language];
    }

    /* setActive: toggle game mode; imposes the mission and locks its inputs */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        particles = [];
        banner_seconds = 0;
        burn_seconds = 0;
        milestone_level = null;
        pending_success = false;
        setInputsLocked(active);
        if (active) {
            applyChallenge();
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

    /* buildUi: mode tabs + stats panel with the light button */
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
        const light_button = document.createElement("button");
        light_button.type = "button";
        light_button.className = "primary";
        light_button.addEventListener("click", testLamp);
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newChallenge);
        action_wrap.append(light_button, new_target_button);
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

        panel_elements = { panel, title, hint, new_target_button, light_button, tab_simulation, tab_game, cards };
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

    /* drawEffects: burn flash, confetti particles and banners, advanced by dt */
    function drawEffects(context, transform, delta_seconds) {
        if (burn_seconds > 0) {
            burn_seconds -= delta_seconds;
            context.save();
            context.font = "44px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.globalAlpha = Math.min(burn_seconds, 1);
            context.fillText("💥", transform.toScreenX(6), transform.toScreenY(0));
            context.restore();
        }

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
            context.fillText(banner_text, context.canvas.width / 2, 24);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    64,
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
            last_state = state;
            return;
        }
        const now_milliseconds = performance.now();
        const delta_seconds = last_overlay_milliseconds === null
            ? 0
            : Math.min((now_milliseconds - last_overlay_milliseconds) / 1000, 0.05);
        last_overlay_milliseconds = now_milliseconds;
        last_state = state;

        drawEffects(context, transform, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.simple_circuit_game_overlay = overlay;
})();
