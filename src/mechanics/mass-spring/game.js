/*
 * game.js — EXPERIMENTAL trampoline-safety game mode for the mass-spring
 * exercise. A gymnast of imposed mass m falls from an imposed height h onto
 * the trampoline; the student only tunes the stiffness k so that the bed
 * neither hits the frame D below the surface (needs d ≤ D, i.e.
 * k ≥ 2·m·g·(h+D)/D² — the course formula as a lower bound) nor exposes the
 * gymnast to more than the acceleration limit n·g at the lowest point
 * (a_max = k·d/m − g ≤ n·g ⇔ k ≤ m·g·(n² − 1)/(2h), exact closed form).
 * Too soft → CRAC, the bed bottoms out; too stiff → the landing is brutal.
 * Every generated situation is provably solvable: the [k_min, k_max] window
 * always contains a 10 N/m slider grid point (pure checker used as a
 * rejection-sampling guard, deterministic fallback built on the course's own
 * numbers). Formulas, graphs, the lowest-point/x_eq markers and time
 * scrubbing are hidden while active (they reveal d); the depression row is
 * hidden too; any parameter change resets the run; milestone tiers as in the
 * other exercises. Self-contained: to remove, delete this file, its test
 * file, the GAME MODE blocks in index.html, and the marked "Game mode hook"
 * lines in main.js. Integration surface: the "game-mode" body class (set
 * here) and globalThis.mass_spring_game_overlay (called by main.js each
 * frame). Pure logic is exposed as globalThis.mass_spring_game for tests.
 */
(() => {
    const calc = globalThis.mass_spring_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const STIFFNESS_STEP = 10;
    const STIFFNESS_MIN = 500;
    const STIFFNESS_MAX = 200000;
    const MASS_MIN = 40;
    const MASS_MAX = 100;
    const HEIGHT_MIN = 1;
    const HEIGHT_MAX = 5;
    const FRAME_MIN = 0.3;
    const FRAME_MAX = 0.8;

    /* minimumStiffness: softest legal spring — d ≤ D means k ≥ 2·m·g·(h+D)/D² */
    function minimumStiffness(challenge) {
        return calc.springConstantFromDepression(
            challenge.mass, GRAVITY, challenge.drop_height, challenge.frame_depth,
        );
    }

    /* maximumStiffness: stiffest legal spring — a_max ≤ n·g means
       k ≤ m·g·(n² − 1)/(2h) */
    function maximumStiffness(challenge) {
        const n = challenge.acceleration_limit;
        return challenge.mass * GRAVITY * (n * n - 1) / (2 * challenge.drop_height);
    }

    /* isSituationFeasible: a slider-grid k exists that satisfies both bounds */
    function isSituationFeasible(challenge) {
        if (challenge.mass < MASS_MIN || challenge.mass > MASS_MAX
            || challenge.drop_height < HEIGHT_MIN || challenge.drop_height > HEIGHT_MAX
            || challenge.frame_depth < FRAME_MIN || challenge.frame_depth > FRAME_MAX
            || !(challenge.acceleration_limit > 1)) {
            return false;
        }
        const floor = Math.max(minimumStiffness(challenge), STIFFNESS_MIN);
        const ceiling = Math.min(maximumStiffness(challenge), STIFFNESS_MAX);
        const grid = Math.ceil(floor / STIFFNESS_STEP - 1e-9) * STIFFNESS_STEP;
        if (grid > ceiling) {
            return false;
        }
        return calc.maxDepression(challenge.mass, GRAVITY, challenge.drop_height, grid)
                <= challenge.frame_depth + 1e-9
            && calc.maxAcceleration(challenge.mass, GRAVITY, challenge.drop_height, grid)
                <= challenge.acceleration_limit * GRAVITY + 1e-9;
    }

    /* randomChallenge: imposed gymnast and frame, acceleration limit built just
       above the softest legal spring — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const candidate = {
                mass: MASS_MIN + Math.round(rng() * (MASS_MAX - MASS_MIN)),
                drop_height: HEIGHT_MIN + Math.round(rng() * (HEIGHT_MAX - HEIGHT_MIN) * 2) / 2,
                frame_depth: FRAME_MIN + Math.round(rng() * (FRAME_MAX - FRAME_MIN) * 10) / 10,
                acceleration_limit: 0,
            };
            const floor = minimumStiffness(candidate);
            if (floor < STIFFNESS_MIN || floor > 0.6 * STIFFNESS_MAX) {
                continue;
            }
            const window_factor = 1.2 + rng() * 0.8;
            const exact_limit = Math.sqrt(
                1 + 2 * candidate.drop_height * floor * window_factor / (candidate.mass * GRAVITY),
            );
            candidate.acceleration_limit = Math.ceil(exact_limit * 2) / 2;
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { mass: 68, drop_height: 3, frame_depth: 0.5, acceleration_limit: 16 };
    }

    globalThis.mass_spring_game = {
        minimumStiffness,
        maximumStiffness,
        isSituationFeasible,
        randomChallenge,
        MILESTONES,
        GRAVITY,
        STIFFNESS_STEP,
        STIFFNESS_MAX,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Défi trampoline", en: "Trampoline challenge" },
        panel_title: { fr: "Défi trampoline", en: "Trampoline challenge" },
        hint: {
            fr: "Le gymnaste et le cadre sont imposés. Choisissez la raideur k : la toile ne doit PAS toucher le cadre, et l'accélération au point bas ne doit pas dépasser la limite !",
            en: "The gymnast and the frame are imposed. Pick the stiffness k: the bed must NOT hit the frame, and the acceleration at the lowest point must stay under the limit!",
        },
        new_target: { fr: "Nouveau gymnaste", en: "New gymnast" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Sauts parfaits", en: "Perfect bounces" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "m = {m} kg · h = {h} m · cadre à {d} cm · a ≤ {n} g",
            en: "m = {m} kg · h = {h} m · frame at {d} cm · a ≤ {n} g",
        },
        tune_hint: { fr: "réglez k puis lancez (g = 9,81 m/s²)", en: "tune k then play (g = 9.81 m/s²)" },
        frame_label: { fr: "cadre", en: "frame" },
        gauge_text: { fr: "a = {a} g · limite {n} g", en: "a = {a} g · limit {n} g" },
        success: { fr: "SAUT PARFAIT ! a_max = {a} g", en: "PERFECT BOUNCE! a_max = {a} g" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        bottomed: { fr: "CRAC ! La toile a touché le cadre…", en: "CRACK! The bed hit the frame…" },
        too_stiff: { fr: "Trop raide ! a_max = {a} g > {n} g", en: "Too stiff! a_max = {a} g > {n} g" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_mass", "number_mass",
        "slider_drop_height", "number_drop_height",
        "slider_gravity", "number_gravity",
    ];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let contact_seen = false;
    let peak_acceleration = 0;
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

    /* applyChallenge: impose the gymnast and g, reset the player's stiffness */
    function applyChallenge() {
        setInputValue("number_mass", challenge.mass);
        setInputValue("number_drop_height", challenge.drop_height);
        setInputValue("number_gravity", GRAVITY);
        setInputValue("number_stiffness", 1000);
    }

    /* setInputsLocked: only k stays editable during a mission */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible gymnast, run reset, panel refreshed */
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
            .replace("{h}", formatValue(challenge.drop_height))
            .replace("{d}", formatValue(challenge.frame_depth * 100, 0))
            .replace("{n}", formatValue(challenge.acceleration_limit));
        cards.target.sub.textContent = strings.tune_hint[language];
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

    /* succeedAttempt: count the bounce, celebrate, schedule a new mission */
    function succeedAttempt(context) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(context.canvas.width / 2, context.canvas.height / 2);
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(
            strings.success[currentLanguage()].replace("{a}", formatValue(peak_acceleration / GRAVITY)),
            "#43a047",
            2,
        );
        updatePanel();
    }

    /* drawFrameLine: the trampoline frame D below the surface, plus the a-gauge */
    function drawFrameLine(context, transform, state) {
        const frame_screen = transform.toScreenY(-challenge.frame_depth);
        context.save();
        context.strokeStyle = "#d32f2f";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(0, frame_screen);
        context.lineTo(context.canvas.width, frame_screen);
        context.stroke();
        context.lineWidth = 1;
        context.strokeStyle = "rgba(211, 47, 47, 0.55)";
        context.beginPath();
        for (let x = 0; x < context.canvas.width; x += 14) {
            context.moveTo(x, frame_screen);
            context.lineTo(x - 8, frame_screen + 8);
        }
        context.stroke();
        context.fillStyle = "#d32f2f";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(
            `${strings.frame_label[currentLanguage()]} (−${formatValue(challenge.frame_depth * 100, 0)} cm)`,
            10,
            frame_screen - 4,
        );

        if (state.in_contact) {
            const g_now = Math.max(state.acceleration, 0) / GRAVITY;
            const within = g_now <= challenge.acceleration_limit;
            context.fillStyle = within ? "#43a047" : "#d32f2f";
            context.font = "bold 14px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(
                strings.gauge_text[currentLanguage()]
                    .replace("{a}", formatValue(g_now))
                    .replace("{n}", formatValue(challenge.acceleration_limit)),
                context.canvas.width / 2,
                14,
            );
        }
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

        drawFrameLine(context, transform, state);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                contact_seen = false;
                peak_acceleration = 0;
                updatePanel();
            }
            if (!attempt_over) {
                if (state.in_contact) {
                    contact_seen = true;
                    peak_acceleration = Math.max(peak_acceleration, state.acceleration);
                }
                if (state.compression >= challenge.frame_depth - 1e-9) {
                    failAttempt(strings.bottomed[currentLanguage()]);
                } else if (contact_seen && !state.in_contact) {
                    if (peak_acceleration <= challenge.acceleration_limit * GRAVITY + 1e-9) {
                        succeedAttempt(context);
                    } else {
                        failAttempt(strings.too_stiff[currentLanguage()]
                            .replace("{a}", formatValue(peak_acceleration / GRAVITY))
                            .replace("{n}", formatValue(challenge.acceleration_limit)));
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
       bounce could be probed before committing to a stiffness */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.mass_spring_game_overlay = overlay;
})();
