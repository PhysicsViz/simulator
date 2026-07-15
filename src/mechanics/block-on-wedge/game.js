/*
 * game.js — EXPERIMENTAL express-delivery game mode for the block-on-wedge
 * exercise. A fragile crate (the block) sits on the wedge; m, M, α, µs and
 * g = 9.81 are imposed and locked, and the student picks the push force F to
 * bring the wedge across the finish line D within the time limit WITHOUT the
 * crate sliding: fast enough needs F ≥ (m+M)·2D/t², staying inside the
 * friction cone needs F_min ≤ F ≤ F_max = (m+M)·g·tan(α ± φ) — exactly the
 * course question used as the game's safety window. Too strong and the crate
 * slides up the incline, too weak and either it slides down or the clock runs
 * out. Every generated situation is provably solvable: the time limit is
 * built so the required force lands strictly inside the no-slip window and a
 * 0.1 N slider grid point exists (pure feasibility checker used as a
 * rejection-sampling guard, deterministic fallback on the course's numbers).
 * Formulas, graphs and time scrubbing are hidden while active; any parameter
 * change resets the run; milestone tiers as in the other exercises.
 * Self-contained: to remove, delete this file, its test file, the GAME MODE
 * blocks in index.html, and the marked "Game mode hook" line in main.js.
 * Integration surface: the "game-mode" body class (set here) and
 * globalThis.block_wedge_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.block_wedge_game for tests.
 */
(() => {
    const calc = globalThis.block_wedge_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const FORCE_STEP = 0.1;
    const FORCE_MAX = 120;
    const BLOCK_MIN = 0.2;
    const BLOCK_MAX = 2;
    const WEDGE_MIN = 1;
    const WEDGE_MAX = 8;
    const ANGLE_MIN = 15;
    const ANGLE_MAX = 50;
    const FRICTION_MIN = 0.3;
    const FRICTION_MAX = 1;
    const DISTANCE_MIN = 6;
    const DISTANCE_MAX = 12;

    /* minimumForceForTime: F reaching the line from rest within the limit */
    function minimumForceForTime(challenge) {
        return (challenge.block_mass + challenge.wedge_mass)
            * 2 * challenge.distance / (challenge.time_limit * challenge.time_limit);
    }

    /* forceWindow: the course's no-slip window [F_min, F_max] */
    function forceWindow(challenge) {
        const alpha = challenge.incline_degrees * Math.PI / 180;
        return {
            min: calc.minForce(challenge.block_mass, challenge.wedge_mass, alpha, challenge.friction_coefficient, GRAVITY),
            max: calc.maxForce(challenge.block_mass, challenge.wedge_mass, alpha, challenge.friction_coefficient, GRAVITY),
        };
    }

    /* isSituationFeasible: a slider-grid F is fast enough AND inside the cone */
    function isSituationFeasible(challenge) {
        if (challenge.block_mass < BLOCK_MIN || challenge.block_mass > BLOCK_MAX
            || challenge.wedge_mass < WEDGE_MIN || challenge.wedge_mass > WEDGE_MAX
            || challenge.incline_degrees < ANGLE_MIN || challenge.incline_degrees > ANGLE_MAX
            || challenge.friction_coefficient < FRICTION_MIN || challenge.friction_coefficient > FRICTION_MAX
            || challenge.distance < DISTANCE_MIN || challenge.distance > DISTANCE_MAX
            || !(challenge.time_limit > 0)) {
            return false;
        }
        const window = forceWindow(challenge);
        const floor = Math.max(minimumForceForTime(challenge), window.min);
        const ceiling = Math.min(window.max, FORCE_MAX);
        const grid = Math.ceil(floor / FORCE_STEP - 1e-9) * FORCE_STEP;
        if (grid > ceiling) {
            return false;
        }
        const alpha = challenge.incline_degrees * Math.PI / 180;
        return calc.isStuck(grid, challenge.block_mass, challenge.wedge_mass, alpha, challenge.friction_coefficient, GRAVITY);
    }

    /* randomChallenge: imposed setup on the slider grids, time limit built so
       the required force lands strictly inside the no-slip window */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 60; attempt++) {
            const candidate = {
                block_mass: BLOCK_MIN + Math.round(rng() * (BLOCK_MAX - BLOCK_MIN) * 10) / 10,
                wedge_mass: WEDGE_MIN + Math.round(rng() * (WEDGE_MAX - WEDGE_MIN) * 2) / 2,
                incline_degrees: ANGLE_MIN + Math.round(rng() * (ANGLE_MAX - ANGLE_MIN)),
                friction_coefficient: FRICTION_MIN + Math.round(rng() * (FRICTION_MAX - FRICTION_MIN) * 20) / 20,
                distance: DISTANCE_MIN + Math.round(rng() * (DISTANCE_MAX - DISTANCE_MIN)),
                time_limit: 0,
            };
            const window = forceWindow(candidate);
            if (!Number.isFinite(window.max) || window.max > 0.95 * FORCE_MAX || window.max < 10) {
                continue;
            }
            const target_force = (0.35 + rng() * 0.35) * window.max;
            const total_mass = candidate.block_mass + candidate.wedge_mass;
            candidate.time_limit = Math.ceil(
                Math.sqrt(2 * candidate.distance * total_mass / target_force) * 10,
            ) / 10;
            if (candidate.time_limit >= 0.8 && candidate.time_limit <= 6 && isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return {
            block_mass: 0.5,
            wedge_mass: 2,
            incline_degrees: 40,
            friction_coefficient: 0.6,
            distance: 10,
            time_limit: 1.5,
        };
    }

    /* crossingTime: interpolated instant the wedge reaches the finish distance */
    function crossingTime(previous_state, state, distance) {
        if (previous_state.displacement >= distance || state.displacement < distance
            || state.time === previous_state.time) {
            return null;
        }
        const ratio = (distance - previous_state.displacement)
            / (state.displacement - previous_state.displacement);
        return previous_state.time + ratio * (state.time - previous_state.time);
    }

    globalThis.block_wedge_game = {
        minimumForceForTime,
        forceWindow,
        isSituationFeasible,
        randomChallenge,
        crossingTime,
        MILESTONES,
        GRAVITY,
        FORCE_STEP,
        FORCE_MAX,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Déménagement express", en: "Express delivery" },
        panel_title: { fr: "Déménagement express", en: "Express delivery" },
        hint: {
            fr: "La caisse fragile est posée sur le coin. Choisissez F : franchissez la ligne à temps SANS que la caisse ne glisse — ni trop fort, ni trop faible !",
            en: "The fragile crate sits on the wedge. Pick F: cross the line in time WITHOUT the crate sliding — not too strong, not too weak!",
        },
        new_target: { fr: "Nouvelle livraison", en: "New delivery" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Livraisons réussies", en: "Deliveries" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "m = {m} kg · M = {mm} kg · α = {a}° · µs = {mu}",
            en: "m = {m} kg · M = {mm} kg · α = {a}° · µs = {mu}",
        },
        run_info: { fr: "D = {d} m en ≤ {t} s (g = 9,81 m/s²)", en: "D = {d} m in ≤ {t} s (g = 9.81 m/s²)" },
        delivered: { fr: "LIVRAISON PARFAITE !", en: "PERFECT DELIVERY!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        slid_down: { fr: "La caisse a glissé vers le bas… (F trop faible)", en: "The crate slid down… (F too weak)" },
        slid_up: { fr: "La caisse a glissé vers le haut ! (F trop forte)", en: "The crate slid up! (F too strong)" },
        too_slow: { fr: "Trop lent… la ligne n'est pas franchie à temps", en: "Too slow… the line was not crossed in time" },
        timer: { fr: "⏱ {t} s restantes", en: "⏱ {t} s left" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_block_mass", "number_block_mass",
        "slider_wedge_mass", "number_wedge_mass",
        "slider_incline_degrees", "number_incline_degrees",
        "slider_friction_coefficient", "number_friction_coefficient",
        "slider_gravity", "number_gravity",
    ];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
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

    /* applyChallenge: impose the setup and g, reset the player's force */
    function applyChallenge() {
        setInputValue("number_block_mass", challenge.block_mass);
        setInputValue("number_wedge_mass", challenge.wedge_mass);
        setInputValue("number_incline_degrees", challenge.incline_degrees);
        setInputValue("number_friction_coefficient", challenge.friction_coefficient);
        setInputValue("number_gravity", GRAVITY);
        setInputValue("number_force", 0);
    }

    /* setInputsLocked: only F stays editable during a delivery */
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
            .replace("{m}", formatValue(challenge.block_mass))
            .replace("{mm}", formatValue(challenge.wedge_mass))
            .replace("{a}", String(challenge.incline_degrees))
            .replace("{mu}", formatValue(challenge.friction_coefficient, 2));
        cards.target.sub.textContent = strings.run_info[language]
            .replace("{d}", formatValue(challenge.distance, 0))
            .replace("{t}", formatValue(challenge.time_limit));
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
    function succeedAttempt(context, transform) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX(challenge.distance), transform.toScreenY(1.5));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(strings.delivered[currentLanguage()], "#43a047", 2);
        updatePanel();
    }

    /* drawMission: finish line with a flag and the countdown timer */
    function drawMission(context, transform, state) {
        const finish_x = transform.toScreenX(challenge.distance + state.wedge_width);
        context.save();
        context.strokeStyle = "#fbc02d";
        context.lineWidth = 3;
        context.setLineDash([10, 6]);
        context.beginPath();
        context.moveTo(finish_x, transform.toScreenY(0));
        context.lineTo(finish_x, transform.toScreenY(3));
        context.stroke();
        context.setLineDash([]);
        context.font = "22px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText("🏁", finish_x, transform.toScreenY(3));

        const remaining = Math.max(challenge.time_limit - state.time, 0);
        context.fillStyle = remaining < challenge.time_limit / 4 ? "#d32f2f" : "#b8860b";
        context.font = "bold 15px system-ui, sans-serif";
        context.textBaseline = "top";
        context.fillText(
            strings.timer[currentLanguage()].replace("{t}", formatValue(remaining)),
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

        drawMission(context, transform, state);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                updatePanel();
            }
            if (!attempt_over) {
                if (state.sliding) {
                    failAttempt(strings[state.slide_acceleration > 0 ? "slid_up" : "slid_down"][currentLanguage()]);
                } else {
                    const crossing = crossingTime(previous_state, state, challenge.distance);
                    if (crossing !== null && crossing <= challenge.time_limit) {
                        succeedAttempt(context, transform);
                    } else if (crossing !== null || state.time > challenge.time_limit
                        || state.time >= state.total_time - 1e-9) {
                        failAttempt(strings.too_slow[currentLanguage()]);
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
       run could be probed before committing to a force */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.block_wedge_game_overlay = overlay;
})();
