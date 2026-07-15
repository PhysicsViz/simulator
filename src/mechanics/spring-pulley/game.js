/*
 * game.js — EXPERIMENTAL descent-brake game mode for the spring–incline–
 * pulley exercise. The load (block m₂) must make its FIRST turnaround inside
 * a golden zone: m₁, m₂, θ, k and g = 9.81 are imposed and locked, and the
 * student only chooses the friction coefficient µ (the "brake pad"). The
 * first-swing depth is x_max = 2·(F − f)/k — exactly the course's energy
 * theorem with v = 0 — and decreases monotonically with µ: too much brake and
 * the load turns around above the zone, too little and it dives past it.
 * Every generated situation is provably solvable: the zone is built around
 * the first-swing depth of a reference µ on the 0.01 slider grid, and the
 * pure checker re-evaluates the whole grid (rejection sampling + a
 * deterministic fallback built from the course's own numbers). Formulas,
 * graphs, the drop/rest markers and time scrubbing are hidden while active;
 * any parameter change resets the run; milestone tiers as in the other
 * exercises. Self-contained: to remove, delete this file, its test file, the
 * GAME MODE blocks in index.html, and the marked "Game mode hook" lines in
 * main.js. Integration surface: the "game-mode" body class (set here) and
 * globalThis.spring_pulley_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.spring_pulley_game for tests.
 */
(() => {
    const calc = globalThis.spring_pulley_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const FRICTION_STEP = 0.01;
    const FRICTION_MIN = 0.02;
    const FRICTION_MAX = 0.8;
    const ZONE_HALF_WIDTH = 0.15;

    /* firstDropFor: first-swing depth 2·(F − f)/k for a friction coefficient —
       the course's energy theorem with v = 0 */
    function firstDropFor(challenge, friction_coefficient) {
        return calc.firstSwingMax(
            challenge.mass_1, challenge.mass_2, challenge.stiffness,
            challenge.incline_degrees * Math.PI / 180, friction_coefficient, GRAVITY,
        );
    }

    /* winningFrictions: every slider-grid µ turning the load around in the zone */
    function winningFrictions(challenge) {
        const winners = [];
        const steps = Math.round((FRICTION_MAX - FRICTION_MIN) / FRICTION_STEP);
        for (let i = 0; i <= steps; i++) {
            const friction = Math.round((FRICTION_MIN + i * FRICTION_STEP) * 100) / 100;
            const depth = firstDropFor(challenge, friction);
            if (depth >= challenge.zone_low - 1e-9 && depth <= challenge.zone_high + 1e-9) {
                winners.push(friction);
            }
        }
        return winners;
    }

    /* isSituationFeasible: a slider-grid µ parks the load inside the zone */
    function isSituationFeasible(challenge) {
        if (challenge.mass_1 < 0.5 || challenge.mass_1 > 3
            || challenge.mass_2 < 1.5 || challenge.mass_2 > 8
            || challenge.incline_degrees < 15 || challenge.incline_degrees > 45
            || challenge.stiffness < 8 || challenge.stiffness > 60
            || !(challenge.zone_high > challenge.zone_low) || challenge.zone_low < 0.3) {
            return false;
        }
        return winningFrictions(challenge).length > 0;
    }

    /* randomChallenge: imposed setup on the slider grids, delivery zone built
       around the rest position of a reference grid µ — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const candidate = {
                mass_1: 0.5 + Math.round(rng() * 25) / 10,
                mass_2: 1.5 + Math.round(rng() * 65) / 10,
                incline_degrees: 15 + Math.round(rng() * 30),
                stiffness: 8 + Math.round(rng() * 52),
                zone_low: 0,
                zone_high: 0,
            };
            const reference_friction = Math.round((0.05 + rng() * 0.45) * 100) / 100;
            const depth = firstDropFor(candidate, reference_friction);
            if (depth < 0.5 || depth > 8) {
                continue;
            }
            candidate.zone_low = Math.round((depth - ZONE_HALF_WIDTH) * 100) / 100;
            candidate.zone_high = Math.round((depth + ZONE_HALF_WIDTH) * 100) / 100;
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        const fallback = { mass_1: 1, mass_2: 3, incline_degrees: 25, stiffness: 16, zone_low: 0, zone_high: 0 };
        const depth = firstDropFor(fallback, 0.11);
        fallback.zone_low = Math.round((depth - ZONE_HALF_WIDTH) * 100) / 100;
        fallback.zone_high = Math.round((depth + ZONE_HALF_WIDTH) * 100) / 100;
        return fallback;
    }

    globalThis.spring_pulley_game = {
        firstDropFor,
        winningFrictions,
        isSituationFeasible,
        randomChallenge,
        MILESTONES,
        GRAVITY,
        FRICTION_STEP,
        ZONE_HALF_WIDTH,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Frein de descente", en: "Descent brake" },
        panel_title: { fr: "Frein de descente", en: "Descent brake" },
        hint: {
            fr: "Le montage est imposé ; seul le revêtement du plan (µ) est à vous. La charge doit faire son PREMIER demi-tour dans la zone dorée — v = 0 quand m₂·g·x = ½kx² + (m₁g·sinθ + µm₁g·cosθ)·x !",
            en: "The setup is imposed; only the surface coating (µ) is yours. The load must make its FIRST turnaround inside the golden zone — v = 0 when m₂·g·x = ½kx² + (m₁g·sinθ + µm₁g·cosθ)·x!",
        },
        new_target: { fr: "Nouvelle livraison", en: "New delivery" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Charges garées", en: "Loads parked" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "m₁ = {m1} kg · m₂ = {m2} kg · θ = {t}° · k = {k} N/m",
            en: "m₁ = {m1} kg · m₂ = {m2} kg · θ = {t}° · k = {k} N/m",
        },
        zone_info: { fr: "demi-tour dans x ∈ [{a} ; {b}] m (g = 9,81 m/s²)", en: "turnaround in x ∈ [{a}; {b}] m (g = 9.81 m/s²)" },
        parked: { fr: "DEMI-TOUR PARFAIT ! x_max = {x} m", en: "PERFECT TURNAROUND! x_max = {x} m" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        too_short: { fr: "Demi-tour trop haut… x_max = {x} m (frein trop fort)", en: "Turned too high… x_max = {x} m (brake too strong)" },
        too_far: { fr: "Descente trop profonde… x_max = {x} m (frein trop faible)", en: "Dove too deep… x_max = {x} m (brake too weak)" },
        zone_label: { fr: "zone de demi-tour", en: "turnaround zone" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_mass_1", "number_mass_1",
        "slider_mass_2", "number_mass_2",
        "slider_stiffness", "number_stiffness",
        "slider_incline_degrees", "number_incline_degrees",
        "slider_gravity", "number_gravity",
    ];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let max_depth = 0;
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

    /* applyChallenge: impose the setup and g, reset the player's friction */
    function applyChallenge() {
        setInputValue("number_mass_1", challenge.mass_1);
        setInputValue("number_mass_2", challenge.mass_2);
        setInputValue("number_stiffness", challenge.stiffness);
        setInputValue("number_incline_degrees", challenge.incline_degrees);
        setInputValue("number_gravity", GRAVITY);
        setInputValue("number_friction_coefficient", 0.3);
    }

    /* setInputsLocked: only µ stays editable during a delivery */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible delivery, run reset, panel refreshed */
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
            .replace("{m1}", formatValue(challenge.mass_1, 1))
            .replace("{m2}", formatValue(challenge.mass_2, 1))
            .replace("{t}", String(challenge.incline_degrees))
            .replace("{k}", String(challenge.stiffness));
        cards.target.sub.textContent = strings.zone_info[language]
            .replace("{a}", formatValue(challenge.zone_low))
            .replace("{b}", formatValue(challenge.zone_high));
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

    /* succeedAttempt: count the delivery, celebrate, schedule a new mission */
    function succeedAttempt(context, transform, state) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(
            transform.toScreenX(state.column_x),
            transform.toScreenY(state.start_y - state.position),
        );
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(
            strings.parked[currentLanguage()].replace("{x}", formatValue(state.position)),
            "#43a047",
            2,
        );
        updatePanel();
    }

    /* drawZone: golden parking band on the hanging column */
    function drawZone(context, transform, state) {
        const left = transform.toScreenX(state.column_x - 1.4);
        const right = transform.toScreenX(state.column_x + 2.2);
        const top = transform.toScreenY(state.start_y - challenge.zone_low);
        const bottom = transform.toScreenY(state.start_y - challenge.zone_high);
        context.save();
        context.fillStyle = "rgba(251, 192, 45, 0.18)";
        context.fillRect(left, top, right - left, bottom - top);
        context.strokeStyle = "#b8860b";
        context.lineWidth = 1.5;
        context.setLineDash([7, 6]);
        context.strokeRect(left, top, right - left, bottom - top);
        context.setLineDash([]);
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(strings.zone_label[currentLanguage()], left + 6, top - 4);
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
            context.font = "bold 36px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(banner_text, context.canvas.width / 2, 44);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    90,
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

        drawZone(context, transform, state);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                max_depth = 0;
                updatePanel();
            }
            if (!attempt_over) {
                max_depth = Math.max(max_depth, state.position);
                const turned_around = state.position < max_depth - 1e-6;
                const never_started = state.time >= state.total_time - 1e-9 && !state.moving;
                if (turned_around || never_started) {
                    if (max_depth >= challenge.zone_low && max_depth <= challenge.zone_high) {
                        succeedAttempt(context, transform, { ...state, position: max_depth });
                    } else if (max_depth < challenge.zone_low) {
                        failAttempt(strings.too_short[currentLanguage()].replace("{x}", formatValue(max_depth)));
                    } else {
                        failAttempt(strings.too_far[currentLanguage()].replace("{x}", formatValue(max_depth)));
                    }
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
       oscillation could be probed before committing to a friction */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.spring_pulley_game_overlay = overlay;
})();
