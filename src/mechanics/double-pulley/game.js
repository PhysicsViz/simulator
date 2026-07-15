/*
 * game.js — EXPERIMENTAL "perfect snapshot" game mode for the two-radius
 * pulley exercise. A camera flashes at an imposed instant t_photo; the pulley
 * geometry (R1, R2), the gap h, the mass m2 and g = 9.81 are imposed and
 * locked, and the student tunes m1 and I so that both blocks are at the SAME
 * height (|y1 − y2| ≤ 0.2 m) at the flash — i.e. the meeting-time question
 * solved in reverse. Every generated situation is provably solvable: the
 * challenge is built around a reference (m1, I) on the slider grids whose
 * exact meeting time becomes t_photo, and the pure checker (requiredInertia
 * closed form + grid scan) is used as a rejection-sampling guard with the
 * course's own numbers as deterministic fallback. Formulas, graphs, the
 * meeting-height marker and time scrubbing are hidden while active; any
 * parameter change resets the run; milestone tiers as in the other exercises.
 * Self-contained: to remove, delete this file, its test file, the GAME MODE
 * blocks in index.html, and the marked "Game mode hook" lines in main.js.
 * Integration surface: the "game-mode" body class (set here) and
 * globalThis.double_pulley_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.double_pulley_game for tests.
 */
(() => {
    const calc = globalThis.double_pulley_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const TOLERANCE = 0.2;
    const MASS_STEP = 0.05;
    const MASS_MIN = 0.1;
    const MASS_MAX = 10;
    const INERTIA_STEP = 0.01;
    const INERTIA_MIN = 0.01;
    const INERTIA_MAX = 2;
    const FLASH_MIN = 0.8;
    const FLASH_MAX = 6;

    /* heightGapAtTime: y2 − y1 at a given time, blocks released at rest */
    function heightGapAtTime(challenge, mass_1, inertia, time) {
        const alpha = calc.angularAcceleration(
            mass_1, challenge.mass_2, challenge.radius_1, challenge.radius_2, inertia, GRAVITY,
        );
        const closing = calc.accelerationBlock1(alpha, challenge.radius_1)
            + calc.accelerationBlock2(alpha, challenge.radius_2);
        return challenge.height_gap - closing * time * time / 2;
    }

    /* requiredInertia: exact I making the blocks level at the flash, from
       t² = 2h/(α·(R1+R2)) solved for the denominator of α */
    function requiredInertia(challenge, mass_1) {
        const drive = challenge.mass_2 * challenge.radius_2 - mass_1 * challenge.radius_1;
        const denominator = GRAVITY * drive * (challenge.radius_1 + challenge.radius_2)
            * challenge.flash_time * challenge.flash_time / (2 * challenge.height_gap);
        return denominator
            - mass_1 * challenge.radius_1 * challenge.radius_1
            - challenge.mass_2 * challenge.radius_2 * challenge.radius_2;
    }

    /* isSituationFeasible: some slider-grid pair (m1, I) puts the blocks level
       within tolerance at the flash */
    function isSituationFeasible(challenge) {
        if (!(challenge.flash_time > 0) || !(challenge.height_gap > 0)
            || challenge.radius_1 <= 0 || challenge.radius_2 <= challenge.radius_1) {
            return false;
        }
        const mass_steps = Math.round((MASS_MAX - MASS_MIN) / MASS_STEP);
        for (let i = 0; i <= mass_steps; i++) {
            const mass_1 = MASS_MIN + i * MASS_STEP;
            if (mass_1 * challenge.radius_1 >= challenge.mass_2 * challenge.radius_2) {
                break;
            }
            const exact_inertia = requiredInertia(challenge, mass_1);
            if (exact_inertia < INERTIA_MIN || exact_inertia > INERTIA_MAX) {
                continue;
            }
            const grid_inertia = Math.round(exact_inertia / INERTIA_STEP) * INERTIA_STEP;
            if (Math.abs(heightGapAtTime(challenge, mass_1, grid_inertia, challenge.flash_time)) <= 0.9 * TOLERANCE) {
                return true;
            }
        }
        return false;
    }

    /* randomChallenge: imposed geometry, gap and m2 on the slider grids, with
       t_photo taken from a reference (m1, I) grid solution — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const radius_1 = (2 + Math.round(rng() * 16) / 2) / 100;
            const radius_2 = radius_1 + (3 + Math.round(rng() * 2 * (22 - radius_1 * 100)) / 2) / 100;
            const height_gap = 1 + Math.round(rng() * 8) / 2;
            const mass_2 = 0.5 + Math.round(rng() * 19) * 0.5;
            const mass_1_limit = Math.min(MASS_MAX, 0.9 * mass_2 * radius_2 / radius_1);
            if (mass_1_limit < MASS_MIN + MASS_STEP) {
                continue;
            }
            const mass_1 = MASS_MIN
                + Math.round(rng() * (mass_1_limit - MASS_MIN) / MASS_STEP) * MASS_STEP;
            const inertia = INERTIA_MIN
                + Math.round(rng() * (INERTIA_MAX - INERTIA_MIN) / INERTIA_STEP) * INERTIA_STEP;
            const alpha = calc.angularAcceleration(mass_1, mass_2, radius_1, radius_2, inertia, GRAVITY);
            const flash_time = calc.meetingTime(
                height_gap,
                calc.accelerationBlock1(alpha, radius_1),
                calc.accelerationBlock2(alpha, radius_2),
            );
            const candidate = { radius_1, radius_2, height_gap, mass_2, flash_time };
            if (flash_time >= FLASH_MIN && flash_time <= FLASH_MAX && isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        const course_alpha = calc.angularAcceleration(1, 3, 0.05, 0.10, 0.2, GRAVITY);
        return {
            radius_1: 0.05,
            radius_2: 0.10,
            height_gap: 2,
            mass_2: 3,
            flash_time: calc.meetingTime(
                2,
                calc.accelerationBlock1(course_alpha, 0.05),
                calc.accelerationBlock2(course_alpha, 0.10),
            ),
        };
    }

    /* flashGap: |y1 − y2| linearly interpolated at the flash instant, or null
       while the segment previous→current does not straddle it */
    function flashGap(previous_state, state, flash_time) {
        if (previous_state.time >= flash_time || state.time < flash_time
            || state.time === previous_state.time) {
            return null;
        }
        const ratio = (flash_time - previous_state.time) / (state.time - previous_state.time);
        const height_1 = previous_state.height_1 + ratio * (state.height_1 - previous_state.height_1);
        const height_2 = previous_state.height_2 + ratio * (state.height_2 - previous_state.height_2);
        return Math.abs(height_2 - height_1);
    }

    /* isAligned: flash verdict against the tolerance */
    function isAligned(gap) {
        return gap <= TOLERANCE;
    }

    globalThis.double_pulley_game = {
        heightGapAtTime,
        requiredInertia,
        isSituationFeasible,
        randomChallenge,
        flashGap,
        isAligned,
        MILESTONES,
        TOLERANCE,
        GRAVITY,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "La photo parfaite", en: "The perfect snapshot" },
        panel_title: { fr: "La photo parfaite", en: "The perfect snapshot" },
        hint: {
            fr: "La géométrie, h et m₂ sont imposés. Réglez m₁ et I pour que les deux blocs soient à la même hauteur (±0,2 m) au déclenchement du flash !",
            en: "The geometry, h and m₂ are imposed. Tune m₁ and I so both blocks are level (±0.2 m) when the flash fires!",
        },
        new_target: { fr: "Nouvelle photo", en: "New photo" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Clichés réussis", en: "Perfect shots" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "R₁ = {r1} cm · R₂ = {r2} cm · h = {h} m · m₂ = {m2} kg",
            en: "R₁ = {r1} cm · R₂ = {r2} cm · h = {h} m · m₂ = {m2} kg",
        },
        flash_info: { fr: "flash à t = {t} s (g = 9,81 m/s²)", en: "flash at t = {t} s (g = 9.81 m/s²)" },
        aligned: { fr: "CLICHÉ PARFAIT !", en: "PERFECT SHOT!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        missed: { fr: "Cliché raté… Δy = {dy} m", en: "Missed shot… Δy = {dy} m" },
        landed: { fr: "Un bloc a touché le sol avant la photo !", en: "A block landed before the photo!" },
        flash_countdown: { fr: "📸 flash à t = {t} s", en: "📸 flash at t = {t} s" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_mass_2", "number_mass_2",
        "slider_radius_1_centimeters", "number_radius_1_centimeters",
        "slider_radius_2_centimeters", "number_radius_2_centimeters",
        "slider_height_gap", "number_height_gap",
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
    let flash_alpha = 0;
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

    /* applyChallenge: impose the geometry, gap, m2 and g; reset the tuned inputs */
    function applyChallenge() {
        setInputValue("number_radius_1_centimeters", challenge.radius_1 * 100);
        setInputValue("number_radius_2_centimeters", challenge.radius_2 * 100);
        setInputValue("number_height_gap", challenge.height_gap);
        setInputValue("number_mass_2", challenge.mass_2);
        setInputValue("number_gravity", GRAVITY);
        setInputValue("number_mass_1", 1);
        setInputValue("number_inertia", 1);
    }

    /* setInputsLocked: only m1 and I stay editable during a mission */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible photo mission, run reset, panel refreshed */
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
            .replace("{r1}", formatValue(challenge.radius_1 * 100))
            .replace("{r2}", formatValue(challenge.radius_2 * 100))
            .replace("{h}", formatValue(challenge.height_gap))
            .replace("{m2}", formatValue(challenge.mass_2));
        cards.target.sub.textContent = strings.flash_info[language]
            .replace("{t}", formatValue(challenge.flash_time, 2));
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
        flash_alpha = 0;
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

    /* succeedAttempt: count the shot, celebrate, schedule a new mission */
    function succeedAttempt(context, transform, meeting_height) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX(0), transform.toScreenY(meeting_height));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(strings.aligned[currentLanguage()], "#43a047", 2);
        updatePanel();
    }

    /* drawFlashCountdown: reminder of the imposed flash instant */
    function drawFlashCountdown(context) {
        context.save();
        context.fillStyle = "#b8860b";
        context.font = "bold 14px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            strings.flash_countdown[currentLanguage()].replace("{t}", formatValue(challenge.flash_time, 2)),
            context.canvas.width / 2,
            14,
        );
        context.restore();
    }

    /* drawEffects: camera flash, confetti particles and banners, advanced by dt */
    function drawEffects(context, delta_seconds) {
        if (flash_alpha > 0) {
            context.save();
            context.globalAlpha = Math.min(flash_alpha, 1);
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, context.canvas.width, context.canvas.height);
            context.restore();
            flash_alpha -= 3 * delta_seconds;
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

        drawFlashCountdown(context);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                updatePanel();
            }
            if (!attempt_over) {
                const gap = flashGap(previous_state, state, challenge.flash_time);
                if (gap !== null) {
                    flash_alpha = 0.8;
                    if (isAligned(gap)) {
                        succeedAttempt(context, transform, (state.height_1 + state.height_2) / 2);
                    } else {
                        failAttempt(strings.missed[currentLanguage()].replace("{dy}", formatValue(gap, 2)));
                    }
                } else if (state.time >= state.total_time - 1e-9 && state.time < challenge.flash_time) {
                    failAttempt(strings.landed[currentLanguage()]);
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
       run could be watched to time the crossing before committing */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.double_pulley_game_overlay = overlay;
})();
