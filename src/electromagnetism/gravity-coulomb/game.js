/*
 * game.js — EXPERIMENTAL space-docking game mode for the gravity–Coulomb
 * exercise. Two spacecraft of imposed mass m start at an imposed separation d₀
 * with same-sign charges; the student only tunes |q| so that gravity wins by
 * just enough: the craft must touch (d = 1 m) with a closing speed below the
 * displayed limit, before the mission window (6× the gravity-only collapse
 * time) runs out. Too little charge → crash; too much → they drift apart or
 * the window expires. Every generated situation is provably solvable
 * (chargeWindow gives a non-empty [q_min, q_max] interval containing a slider
 * grid point; constructive generation + pure feasibility checker used as a
 * rejection-sampling guard with a deterministic fallback). Formulas, graphs,
 * the force vectors / free-body diagram and time scrubbing are hidden while
 * active; any parameter change resets the run; milestone tiers as in the other
 * exercises. Self-contained: to remove, delete this file, its test file, the
 * GAME MODE blocks in index.html, and the marked "Game mode hook" lines in
 * main.js. Integration surface: the "game-mode" body class (set here) and
 * globalThis.gravity_coulomb_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.gravity_coulomb_game for tests.
 */
(() => {
    const calc = globalThis.gravity_coulomb_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const CONTACT_DISTANCE = 1;
    const WINDOW_FACTOR = 6;
    const CHARGE_STEP = 1e-11;
    const CHARGE_MAX = 1e-6;
    const MASS_MIN = 200;
    const MASS_MAX = 5000;
    const DISTANCE_MIN = 6;
    const DISTANCE_MAX = 30;

    /* dockingSpeed: relative contact speed when falling from rest at d₀ with
       same-sign charges q on both craft */
    function dockingSpeed(mass, charge, initial_distance) {
        const mu = calc.relativeMu(mass, charge, true);
        return calc.relativeSpeed(initial_distance, mu, CONTACT_DISTANCE);
    }

    /* missionWindow: allowed mission duration — WINDOW_FACTOR times the
       gravity-only collapse time (matches main.js's observation window) */
    function missionWindow(mass, initial_distance) {
        return WINDOW_FACTOR * calc.contactTime(initial_distance, calc.relativeMu(mass, 0, true), CONTACT_DISTANCE);
    }

    /* chargeWindow: [min_charge, max_charge] of |q| values that dock softly.
       Below min_charge the contact speed exceeds the limit; above max_charge
       the collapse is slower than the mission window (t_contact ∝ 1/√C, so
       C ≥ G·m²/W² ⇔ q ≤ q_éq·√(1 − 1/W²)). */
    function chargeWindow(challenge) {
        const { mass, initial_distance, max_docking_speed } = challenge;
        const gravity_coefficient = calc.GRAVITATIONAL_CONSTANT * mass * mass;
        const inverse_gap = 1 / CONTACT_DISTANCE - 1 / initial_distance;
        const allowed_coefficient = max_docking_speed * max_docking_speed * mass / (4 * inverse_gap);
        const min_charge = Math.sqrt(Math.max(gravity_coefficient - allowed_coefficient, 0) / calc.COULOMB_CONSTANT);
        const max_charge = calc.equilibriumCharge(mass) * Math.sqrt(1 - 1 / (WINDOW_FACTOR * WINDOW_FACTOR));
        return { min_charge, max_charge };
    }

    /* isSituationFeasible: a slider-grid charge exists that docks below the
       speed limit and within the mission window */
    function isSituationFeasible(challenge) {
        const { mass, initial_distance, max_docking_speed } = challenge;
        if (mass < MASS_MIN || mass > MASS_MAX
            || initial_distance < DISTANCE_MIN || initial_distance > DISTANCE_MAX
            || initial_distance <= CONTACT_DISTANCE
            || !(max_docking_speed > 0)) {
            return false;
        }
        const window = chargeWindow(challenge);
        const grid_charge = Math.ceil(window.min_charge / CHARGE_STEP - 1e-9) * CHARGE_STEP;
        if (grid_charge > window.max_charge || grid_charge > CHARGE_MAX) {
            return false;
        }
        const mu = calc.relativeMu(mass, grid_charge, true);
        return dockingSpeed(mass, grid_charge, initial_distance) <= max_docking_speed
            && calc.contactTime(initial_distance, mu, CONTACT_DISTANCE) <= missionWindow(mass, initial_distance) + 1e-9;
    }

    /* randomChallenge: imposed mass and separation, speed limit between 30 %
       and 60 % of the free-fall (q = 0) contact speed — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const mass = Math.round(MASS_MIN + rng() * (MASS_MAX - MASS_MIN));
            const initial_distance = Math.round((DISTANCE_MIN + rng() * (DISTANCE_MAX - DISTANCE_MIN)) * 2) / 2;
            const candidate = {
                mass,
                initial_distance,
                max_docking_speed: (0.3 + rng() * 0.3) * dockingSpeed(mass, 0, initial_distance),
            };
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { mass: 1000, initial_distance: 10, max_docking_speed: 0.45 * dockingSpeed(1000, 0, 10) };
    }

    /* dockingOutcome: contact classification against the speed limit */
    function dockingOutcome(contact_speed, max_docking_speed) {
        return contact_speed <= max_docking_speed ? "docked" : "crashed";
    }

    globalThis.gravity_coulomb_game = {
        dockingSpeed,
        missionWindow,
        chargeWindow,
        isSituationFeasible,
        randomChallenge,
        dockingOutcome,
        MILESTONES,
        CONTACT_DISTANCE,
        WINDOW_FACTOR,
        CHARGE_STEP,
        CHARGE_MAX,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Amarrage spatial", en: "Space docking" },
        panel_title: { fr: "Amarrage spatial", en: "Space docking" },
        hint: {
            fr: "m et d₀ sont imposés. Réglez |q| pour que les vaisseaux se touchent en douceur, sous la vitesse limite et avant la fin de la fenêtre de mission !",
            en: "m and d₀ are imposed. Tune |q| so the craft touch gently, under the speed limit and before the mission window runs out!",
        },
        new_target: { fr: "Nouvelle mission", en: "New mission" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Amarrages réussis", en: "Dockings" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "m = {m} kg · d₀ = {d} m · v contact ≤ {v} µm/s",
            en: "m = {m} kg · d₀ = {d} m · contact v ≤ {v} µm/s",
        },
        window_info: { fr: "fenêtre de mission : {w}", en: "mission window: {w}" },
        approach_label: { fr: "Approche", en: "Approach" },
        approach_info: { fr: "d = {d} m · v = {v} µm/s", en: "d = {d} m · v = {v} µm/s" },
        approach_limit: { fr: "limite : {v} µm/s", en: "limit: {v} µm/s" },
        docked: { fr: "AMARRAGE RÉUSSI !", en: "DOCKED!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        crashed: { fr: "COLLISION ! Trop rapide…", en: "CRASH! Too fast…" },
        drifted: { fr: "Les vaisseaux s'éloignent… (répulsion)", en: "The craft drift apart… (repulsion)" },
        window_out: { fr: "Fenêtre de mission dépassée…", en: "Mission window expired…" },
        unit_hours: { fr: "h", en: "h" },
        unit_days: { fr: "j", en: "d" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_mass", "number_mass",
        "slider_initial_distance", "number_initial_distance",
        "toggle_same_signs",
    ];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
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

    /* formatWindow: mission window in hours or days */
    function formatWindow(seconds) {
        if (seconds >= 2 * 86400) {
            return `${formatValue(seconds / 86400)} ${strings.unit_days[currentLanguage()]}`;
        }
        return `${formatValue(seconds / 3600)} ${strings.unit_hours[currentLanguage()]}`;
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

    /* applyChallenge: impose m, d₀ and same-sign charges, clear the player's q */
    function applyChallenge() {
        setInputValue("number_mass", challenge.mass);
        setInputValue("number_initial_distance", challenge.initial_distance);
        const toggle = document.getElementById("toggle_same_signs");
        if (!toggle.checked) {
            toggle.checked = true;
            toggle.dispatchEvent(new Event("input"));
        }
        setInputValue("number_charge_nanocoulombs", 0);
    }

    /* setInputsLocked: only |q| stays editable during a mission */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible mission, run reset, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        applyChallenge();
        attempt_over = true;
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
            .replace("{m}", String(challenge.mass))
            .replace("{d}", formatValue(challenge.initial_distance))
            .replace("{v}", formatValue(challenge.max_docking_speed * 1e6));
        cards.target.sub.textContent = strings.window_info[language]
            .replace("{w}", formatWindow(missionWindow(challenge.mass, challenge.initial_distance)));

        cards.approach.name.textContent = strings.approach_label[language];
        cards.approach.sub.textContent = strings.approach_limit[language]
            .replace("{v}", formatValue(challenge.max_docking_speed * 1e6));
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
            approach: createCard("game-target-value"),
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

    /* succeedAttempt: count the docking, celebrate, schedule a new mission */
    function succeedAttempt(context, transform) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX(0), transform.toScreenY(0));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner("docked", "#43a047", 2);
        updatePanel();
    }

    /* drawSpeedGauge: approach-speed bar against the docking limit */
    function drawSpeedGauge(context, relative_speed) {
        const gauge_width = 230;
        const gauge_height = 13;
        const gauge_x = (context.canvas.width - gauge_width) / 2;
        const gauge_y = 16;
        const ratio = Math.min(relative_speed / challenge.max_docking_speed, 1.5);
        const within_limit = relative_speed <= challenge.max_docking_speed;
        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.25)";
        context.beginPath();
        context.roundRect(gauge_x, gauge_y, gauge_width, gauge_height, 6);
        context.fill();
        context.fillStyle = within_limit ? "#43a047" : "#d32f2f";
        context.beginPath();
        context.roundRect(gauge_x, gauge_y, gauge_width * Math.min(ratio / 1.5, 1), gauge_height, 6);
        context.fill();
        const limit_x = gauge_x + gauge_width / 1.5;
        context.strokeStyle = "#fbc02d";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(limit_x, gauge_y - 3);
        context.lineTo(limit_x, gauge_y + gauge_height + 3);
        context.stroke();
        context.fillStyle = within_limit ? "#43a047" : "#d32f2f";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            `v = ${formatValue(relative_speed * 1e6)} µm/s · ≤ ${formatValue(challenge.max_docking_speed * 1e6)} µm/s`,
            context.canvas.width / 2,
            gauge_y + gauge_height + 6,
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
            context.font = "bold 40px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings[banner_key][language], context.canvas.width / 2, 48);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    96,
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

        drawSpeedGauge(context, state.relative_speed);
        if (panel_elements !== null) {
            panel_elements.cards.approach.value.textContent = strings.approach_info[currentLanguage()]
                .replace("{d}", formatValue(state.separation))
                .replace("{v}", formatValue(state.relative_speed * 1e6));
        }

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                updatePanel();
            }
            if (!attempt_over) {
                if (state.separation <= state.contact_distance + 1e-9) {
                    if (dockingOutcome(state.relative_speed, challenge.max_docking_speed) === "docked") {
                        succeedAttempt(context, transform);
                    } else {
                        failAttempt("crashed");
                    }
                } else if (state.time >= state.total_time - 1e-9) {
                    failAttempt(state.attracting ? "window_out" : "drifted");
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
       approach could be inspected before committing to a charge */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.gravity_coulomb_game_overlay = overlay;
})();
