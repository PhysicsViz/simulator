/*
 * game.js — EXPERIMENTAL "save the egg" game mode for the blocks-in-contact
 * exercise. A (massless, rigid) egg is wedged between the two blocks; the
 * masses are imposed and locked, and the student picks the applied force F and
 * the block order (swap toggle) to cross the finish line within the time limit
 * WITHOUT crushing the egg: the contact force m_front·F/(mA+mB) must stay at
 * or below the egg's limit — pushing with the light block in FRONT lowers the
 * contact force at equal acceleration, which is exactly the course's
 * swapped-blocks question. Every generated situation is provably solvable:
 * the speed requirement gives F_min = (mA+mB)·2D/t_max², the egg limit is
 * built as a multiple of the light-front contact force at F_min, and the pure
 * checker verifies a slider-grid F exists for at least one block order
 * (rejection sampling + deterministic fallback where only the light-front
 * order works). Formulas, graphs, the contact vectors / free-body diagram and
 * time scrubbing are hidden while active; any parameter change resets the run;
 * milestone tiers as in the other exercises. Self-contained: to remove, delete
 * this file, its test file, the GAME MODE blocks in index.html, and the marked
 * "Game mode hook" lines in main.js. Integration surface: the "game-mode"
 * body class (set here) and globalThis.blocks_contact_game_overlay (called by
 * main.js each frame). Pure logic is exposed as globalThis.blocks_contact_game
 * for tests.
 */
(() => {
    const calc = globalThis.blocks_contact_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const FORCE_STEP = 0.5;
    const FORCE_MAX = 100;
    const MASS_MIN = 0.5;
    const MASS_MAX = 8;
    const DISTANCE_MIN = 6;
    const DISTANCE_MAX = 12;
    const TIME_LIMIT_MIN = 2;
    const TIME_LIMIT_MAX = 5;

    /* minimumForce: F needed to cover the distance from rest within the limit */
    function minimumForce(challenge) {
        return (challenge.mass_a + challenge.mass_b)
            * 2 * challenge.distance / (challenge.time_limit * challenge.time_limit);
    }

    /* contactAt: contact force for a given applied force and front mass */
    function contactAt(challenge, force, front_mass) {
        return calc.contactForceModule(force, front_mass, challenge.mass_a, challenge.mass_b);
    }

    /* orderIsWinnable: a slider-grid F exists for this front mass — fast enough
       to beat the clock, gentle enough for the egg */
    function orderIsWinnable(challenge, front_mass) {
        const grid_force = Math.ceil(minimumForce(challenge) / FORCE_STEP - 1e-9) * FORCE_STEP;
        if (grid_force > FORCE_MAX) {
            return false;
        }
        return contactAt(challenge, grid_force, front_mass) <= challenge.egg_limit + 1e-9;
    }

    /* isSituationFeasible: some (F, block order) wins */
    function isSituationFeasible(challenge) {
        if (challenge.mass_a < MASS_MIN || challenge.mass_a > MASS_MAX
            || challenge.mass_b < MASS_MIN || challenge.mass_b > MASS_MAX
            || challenge.distance < DISTANCE_MIN || challenge.distance > DISTANCE_MAX
            || challenge.time_limit < TIME_LIMIT_MIN || challenge.time_limit > TIME_LIMIT_MAX
            || !(challenge.egg_limit > 0)) {
            return false;
        }
        return orderIsWinnable(challenge, challenge.mass_a) || orderIsWinnable(challenge, challenge.mass_b);
    }

    /* randomChallenge: imposed masses, distance and time limit on the slider
       grids, egg limit built from the light-front contact force at the minimum
       winning force — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const mass_a = MASS_MIN + Math.round(rng() * (MASS_MAX - MASS_MIN) * 2) / 2;
            const mass_b = MASS_MIN + Math.round(rng() * (MASS_MAX - MASS_MIN) * 2) / 2;
            if (mass_a === mass_b) {
                continue;
            }
            const candidate = {
                mass_a,
                mass_b,
                distance: DISTANCE_MIN + Math.round(rng() * (DISTANCE_MAX - DISTANCE_MIN)),
                time_limit: TIME_LIMIT_MIN + Math.round(rng() * (TIME_LIMIT_MAX - TIME_LIMIT_MIN) * 2) / 2,
                egg_limit: 0,
            };
            const force_minimum = minimumForce(candidate);
            if (force_minimum < 5 || force_minimum > 60) {
                continue;
            }
            const light_mass = Math.min(mass_a, mass_b);
            candidate.egg_limit = Math.round(
                (1.15 + rng() * 0.6) * contactAt(candidate, force_minimum, light_mass) * 10,
            ) / 10;
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { mass_a: 2, mass_b: 3, distance: 10, time_limit: 3, egg_limit: 6.5 };
    }

    /* crossingTime: interpolated instant the displacement reaches the finish
       distance on the segment previous→current, or null if not crossed */
    function crossingTime(previous_state, state, distance) {
        if (previous_state.displacement >= distance || state.displacement < distance
            || state.time === previous_state.time) {
            return null;
        }
        const ratio = (distance - previous_state.displacement)
            / (state.displacement - previous_state.displacement);
        return previous_state.time + ratio * (state.time - previous_state.time);
    }

    /* eggBreaks: the contact force crushes the egg */
    function eggBreaks(contact_force, egg_limit) {
        return contact_force > egg_limit + 1e-9;
    }

    globalThis.blocks_contact_game = {
        minimumForce,
        contactAt,
        orderIsWinnable,
        isSituationFeasible,
        randomChallenge,
        crossingTime,
        eggBreaks,
        MILESTONES,
        FORCE_STEP,
        FORCE_MAX,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Protège l'œuf !", en: "Save the egg!" },
        panel_title: { fr: "Protège l'œuf !", en: "Save the egg!" },
        hint: {
            fr: "Un œuf (sans masse, promis) est coincé entre les blocs. Choisissez F et l'ordre des blocs pour franchir la ligne à temps SANS l'écraser — l'ordre des blocs change tout !",
            en: "An egg (massless, promise) is wedged between the blocks. Pick F and the block order to cross the line in time WITHOUT crushing it — the block order changes everything!",
        },
        new_target: { fr: "Nouvelle course", en: "New run" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Œufs livrés", en: "Eggs delivered" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "m_A = {ma} kg · m_B = {mb} kg · D = {d} m en ≤ {t} s",
            en: "m_A = {ma} kg · m_B = {mb} kg · D = {d} m in ≤ {t} s",
        },
        egg_info: { fr: "l'œuf casse au-delà de {f} N de contact", en: "the egg breaks above {f} N of contact" },
        delivered: { fr: "ŒUF LIVRÉ !", en: "EGG DELIVERED!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        cracked: { fr: "SPLASH ! L'œuf est cassé…", en: "SPLASH! The egg broke…" },
        too_slow: { fr: "Trop lent… la ligne n'est pas franchie à temps", en: "Too slow… the line was not crossed in time" },
        timer: { fr: "⏱ {t} s restantes", en: "⏱ {t} s left" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = ["slider_mass_a", "number_mass_a", "slider_mass_b", "number_mass_b"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let egg_cracked = false;
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

    /* applyChallenge: impose the masses, reset the player's force and order */
    function applyChallenge() {
        setInputValue("number_mass_a", challenge.mass_a);
        setInputValue("number_mass_b", challenge.mass_b);
        setInputValue("number_force", 0);
        const toggle = document.getElementById("toggle_swapped");
        if (toggle.checked) {
            toggle.checked = false;
            toggle.dispatchEvent(new Event("input"));
        }
    }

    /* setInputsLocked: only F and the swap toggle stay editable during a run */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible delivery run, reset, panel refreshed */
    function newChallenge() {
        challenge = randomChallenge();
        applyChallenge();
        attempt_over = true;
        egg_cracked = false;
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
            .replace("{ma}", formatValue(challenge.mass_a))
            .replace("{mb}", formatValue(challenge.mass_b))
            .replace("{d}", formatValue(challenge.distance, 0))
            .replace("{t}", formatValue(challenge.time_limit));
        cards.target.sub.textContent = strings.egg_info[language]
            .replace("{f}", formatValue(challenge.egg_limit));
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
        egg_cracked = false;
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

    /* succeedAttempt: count the delivery, celebrate, schedule a new run */
    function succeedAttempt(context, transform, world_x) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX(world_x), transform.toScreenY(1));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(strings.delivered[currentLanguage()], "#43a047", 2);
        updatePanel();
    }

    /* drawMission: finish line with a flag, the egg at the interface, the timer */
    function drawMission(context, transform, state) {
        const finish_world_x = challenge.distance + 2 * state.block_width;
        const finish_x = transform.toScreenX(finish_world_x);
        context.save();
        context.strokeStyle = "#fbc02d";
        context.lineWidth = 3;
        context.setLineDash([10, 6]);
        context.beginPath();
        context.moveTo(finish_x, transform.toScreenY(0));
        context.lineTo(finish_x, transform.toScreenY(2.6));
        context.stroke();
        context.setLineDash([]);
        context.font = "22px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText("🏁", finish_x, transform.toScreenY(2.6));

        const interface_x = transform.toScreenX(state.displacement + state.block_width);
        const egg_y = transform.toScreenY(state.block_height / 2);
        context.font = "20px system-ui, sans-serif";
        context.textBaseline = "middle";
        if (egg_cracked) {
            context.fillText("🍳", interface_x, transform.toScreenY(0) - 8);
        } else {
            context.fillText("🥚", interface_x, egg_y);
        }

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
            context.font = "bold 38px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(banner_text, context.canvas.width / 2, 48);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    94,
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
                    egg_cracked = false;
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
                egg_cracked = false;
                updatePanel();
            }
            if (!attempt_over) {
                if (eggBreaks(state.contact_force, challenge.egg_limit)) {
                    egg_cracked = true;
                    failAttempt(strings.cracked[currentLanguage()]);
                } else {
                    const crossing = crossingTime(previous_state, state, challenge.distance);
                    if (crossing !== null && crossing <= challenge.time_limit) {
                        succeedAttempt(context, transform, challenge.distance + 2 * state.block_width);
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
    globalThis.blocks_contact_game_overlay = overlay;
})();
