/*
 * game.js — EXPERIMENTAL "mystery charge" measurement game for the
 * electrostatic-pendulum exercise. The sphere's charge q is hidden (its
 * parameter row is hidden and m, L, g are imposed and locked); the student
 * plays experimenter: set ΔV, read the equilibrium angle φ on the scene, and
 * deduce q = m·g·L·tan φ/ΔV, then type the estimate and validate — correct
 * within ±5 % scores. Every generated situation is provably solvable: the
 * hidden charge is drawn so that the deflection reaches at least 20° within
 * the ΔV slider range (pure feasibility checker used as a rejection-sampling
 * guard, with the course's own numbers as deterministic fallback), and the
 * 0.05 nC estimate grid always contains a value within the tolerance.
 * Formulas, graphs, the force vectors and the free-body diagram are hidden
 * while active (they reveal q); the angle arc stays visible — it is the
 * measurement. Milestone tiers as in the other exercises. Self-contained: to
 * remove, delete this file, its test file, the GAME MODE blocks in index.html,
 * and the marked "Game mode hook" lines in main.js. Integration surface: the
 * "game-mode" body class (set here) and
 * globalThis.charged_pendulum_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.charged_pendulum_game for tests.
 */
(() => {
    const calc = globalThis.charged_pendulum_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const VOLTAGE_MAX = 100e3;
    const TOLERANCE = 0.05;
    const MIN_ANGLE_DEGREES = 20;
    const ESTIMATE_STEP = 0.05;
    const MASS_MIN = 0.5;
    const MASS_MAX = 5;
    const PLATE_MIN = 3;
    const PLATE_MAX = 10;
    const CHARGE_MIN = 1;
    const CHARGE_MAX = 45;

    /* angleAtVoltage: equilibrium deflection (degrees) of the hidden charge */
    function angleAtVoltage(challenge, volts) {
        const field = calc.electricField(volts, challenge.plate_centimeters / 100);
        return calc.equilibriumAngle(
            challenge.hidden_nanocoulombs * 1e-9,
            field,
            challenge.mass_grams / 1000,
            GRAVITY,
        ) * 180 / Math.PI;
    }

    /* isSituationFeasible: the deflection is measurable (≥ 20° somewhere on the
       ΔV slider) and every imposed value sits in its slider range */
    function isSituationFeasible(challenge) {
        if (challenge.mass_grams < MASS_MIN || challenge.mass_grams > MASS_MAX
            || challenge.plate_centimeters < PLATE_MIN || challenge.plate_centimeters > PLATE_MAX
            || challenge.hidden_nanocoulombs < CHARGE_MIN || challenge.hidden_nanocoulombs > CHARGE_MAX) {
            return false;
        }
        return angleAtVoltage(challenge, VOLTAGE_MAX) >= MIN_ANGLE_DEGREES;
    }

    /* randomChallenge: imposed m and L on the slider grids, hidden q drawn above
       the measurability threshold — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const mass_grams = MASS_MIN + Math.round(rng() * (MASS_MAX - MASS_MIN) * 10) / 10;
            const plate_centimeters = PLATE_MIN + Math.round(rng() * (PLATE_MAX - PLATE_MIN) * 2) / 2;
            const measurable_minimum = Math.tan(MIN_ANGLE_DEGREES * Math.PI / 180)
                * (plate_centimeters / 100) * (mass_grams / 1000) * GRAVITY / VOLTAGE_MAX * 1e9;
            const lower = Math.max(CHARGE_MIN, Math.ceil(measurable_minimum * 10) / 10);
            if (lower > CHARGE_MAX) {
                continue;
            }
            const candidate = {
                mass_grams,
                plate_centimeters,
                hidden_nanocoulombs: lower + Math.round(rng() * (CHARGE_MAX - lower) * 10) / 10,
            };
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { mass_grams: 1.5, plate_centimeters: 5, hidden_nanocoulombs: 8.9 };
    }

    /* relativeError: |estimate − hidden|/hidden */
    function relativeError(estimate, hidden) {
        return Math.abs(estimate - hidden) / hidden;
    }

    /* isEstimateCorrect: within the ±5 % tolerance */
    function isEstimateCorrect(estimate, hidden) {
        return relativeError(estimate, hidden) <= TOLERANCE + 1e-12;
    }

    globalThis.charged_pendulum_game = {
        angleAtVoltage,
        isSituationFeasible,
        randomChallenge,
        relativeError,
        isEstimateCorrect,
        MILESTONES,
        TOLERANCE,
        ESTIMATE_STEP,
        VOLTAGE_MAX,
        GRAVITY,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "La charge mystère", en: "The mystery charge" },
        panel_title: { fr: "La charge mystère", en: "The mystery charge" },
        hint: {
            fr: "La charge q de la sphère est cachée ! Faites varier ΔV, lisez l'angle φ, déduisez q = m·g·L·tan φ/ΔV et validez votre mesure (±5 %).",
            en: "The sphere's charge q is hidden! Vary ΔV, read the angle φ, deduce q = m·g·L·tan φ/ΔV and validate your measurement (±5 %).",
        },
        new_target: { fr: "Nouvelle sphère", en: "New sphere" },
        validate: { fr: "Valider la mesure", en: "Validate the measurement" },
        estimate_label: { fr: "q estimé :", en: "estimated q:" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Charges mesurées", en: "Charges measured" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "m = {m} g · L = {l} cm · g = 9,81 m/s² · q = ???",
            en: "m = {m} g · L = {l} cm · g = 9.81 m/s² · q = ???",
        },
        tolerance_info: { fr: "tolérance : ±5 %", en: "tolerance: ±5 %" },
        measured: { fr: "MESURE EXACTE ! q = {q} nC", en: "SPOT ON! q = {q} nC" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        missed: { fr: "Écart de {e} % — mesurez encore…", en: "Off by {e} % — measure again…" },
        mystery_bubble: { fr: "q = ?", en: "q = ?" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_mass_grams", "number_mass_grams",
        "slider_plate_centimeters", "number_plate_centimeters",
        "slider_gravity", "number_gravity",
        "slider_phi_degrees", "number_phi_degrees",
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

    /* applyChallenge: impose m, L and g, load the hidden charge, reset ΔV */
    function applyChallenge() {
        setInputValue("number_mass_grams", challenge.mass_grams);
        setInputValue("number_plate_centimeters", challenge.plate_centimeters);
        setInputValue("number_gravity", GRAVITY);
        setInputValue("number_charge_nanocoulombs", challenge.hidden_nanocoulombs);
        setInputValue("number_delta_kilovolts", 0);
        if (panel_elements !== null) {
            panel_elements.estimate_input.value = "";
        }
    }

    /* setInputsLocked: only ΔV stays editable during a measurement */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh measurable sphere, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        applyChallenge();
        updatePanel();
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
        panel_elements.validate_button.textContent = strings.validate[language];
        panel_elements.estimate_label.textContent = strings.estimate_label[language];
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
            .replace("{m}", formatValue(challenge.mass_grams))
            .replace("{l}", formatValue(challenge.plate_centimeters));
        cards.target.sub.textContent = strings.tolerance_info[language];
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
        milestone_level = null;
        pending_success = false;
        setInputsLocked(active);
        if (active) {
            applyChallenge();
        }
        updatePanel();
        document.getElementById("zoom_fit_button").click();
    }

    /* validateMeasurement: compare the typed estimate against the hidden charge */
    function validateMeasurement() {
        const estimate = Number(panel_elements.estimate_input.value);
        if (!Number.isFinite(estimate) || estimate <= 0) {
            return;
        }
        attempts += 1;
        if (isEstimateCorrect(estimate, challenge.hidden_nanocoulombs)) {
            goals += 1;
            pending_success = true;
            if (last_state !== null) {
                spawnConfetti(last_state.sphere_x, last_state.sphere_y);
            }
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            showBanner(
                strings.measured[currentLanguage()].replace("{q}", formatValue(challenge.hidden_nanocoulombs)),
                "#43a047",
                2.2,
            );
        } else {
            const error_percent = 100 * relativeError(estimate, challenge.hidden_nanocoulombs);
            showBanner(
                strings.missed[currentLanguage()].replace("{e}", formatValue(error_percent)),
                "#d32f2f",
                1.8,
            );
        }
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

    /* buildUi: mode tabs + stats panel with the estimate input and validate button */
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
        const estimate_wrap = document.createElement("div");
        estimate_wrap.className = "estimate-wrap";
        const estimate_label = document.createElement("span");
        estimate_label.className = "unit";
        const estimate_input = document.createElement("input");
        estimate_input.type = "number";
        estimate_input.min = 0.5;
        estimate_input.max = 50;
        estimate_input.step = ESTIMATE_STEP;
        const estimate_unit = document.createElement("span");
        estimate_unit.className = "unit";
        estimate_unit.textContent = "nC";
        const validate_button = document.createElement("button");
        validate_button.type = "button";
        validate_button.className = "primary";
        validate_button.addEventListener("click", validateMeasurement);
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newChallenge);
        estimate_wrap.append(estimate_label, estimate_input, estimate_unit, validate_button, new_target_button);
        head.append(title, hint, estimate_wrap);

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

        panel_elements = {
            panel, title, hint, new_target_button, validate_button,
            estimate_input, estimate_label, tab_simulation, tab_game, cards,
        };
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

    /* drawMysteryBubble: "q = ?" tag on the sphere */
    function drawMysteryBubble(context, state) {
        context.save();
        context.fillStyle = "#b8860b";
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(strings.mystery_bubble[currentLanguage()], state.sphere_x + 16, state.sphere_y - 14);
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
            context.fillText(banner_text, context.canvas.width / 2, 48);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    92,
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
        last_state = state;

        drawMysteryBubble(context, state);
        drawEffects(context, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.charged_pendulum_game_overlay = overlay;
})();
