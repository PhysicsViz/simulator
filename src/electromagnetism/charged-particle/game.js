/*
 * game.js — EXPERIMENTAL ring-flight game mode for the charged-particle exercise.
 * A golden ring floats between the plates at a random position and radius; the
 * student tunes the fields, the charge, y0 and u0 so the particle flies through
 * the ring opening. Hitting a plate first, crossing the ring plane outside the
 * opening, or running out of range fails the attempt. Every generated situation
 * is provably solvable (pure checker + constructive generation: the ring always
 * sits inside the reachable start-height range, so a straight flight with q = 0
 * always exists). Formulas, graphs, the predicted path and time scrubbing are
 * hidden while active (the traveled trace stays visible); any parameter change
 * resets the flight; milestone tiers as in the other exercises. Self-contained:
 * to remove, delete this file, its test file, the GAME MODE blocks in
 * index.html, and the marked "Game mode hook" lines in main.js. Integration
 * surface: the "game-mode" body class (set here),
 * globalThis.charged_particle_game_overlay (called by main.js each frame) and
 * globalThis.charged_particle_game_view_extent (read by main.js fitView).
 * Pure logic is exposed as globalThis.charged_particle_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const HEIGHT_MIN = 0.2;
    const HEIGHT_MAX = 3.8;

    /* randomRing: golden ring at random position and radius between the plates */
    function randomRing(rng = Math.random) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = {
                x: 3 + rng() * 5,
                y: 0.6 + rng() * 2.8,
                radius: 0.15 + rng() * 0.3,
            };
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return { x: 5, y: 2, radius: 0.3 };
    }

    /* isSituationFeasible: a straight flight with q = 0 goes through the ring iff
       its center is reachable as a start height; the ring must also leave a
       margin to the plates and sit at a reachable horizontal distance */
    function isSituationFeasible(ring) {
        const center_reachable = ring.y >= HEIGHT_MIN && ring.y <= HEIGHT_MAX;
        const clears_plates = ring.y - ring.radius > 0.05 && ring.y + ring.radius < 4 - 0.05;
        const distance_ok = ring.x >= 1 && ring.x <= 12;
        return center_reachable && clears_plates && distance_ok && ring.radius >= 0.1;
    }

    /* isRingCrossing: the segment previous→current crosses the ring plane; returns
       "through" (inside the opening), "missed" (outside) or null (no crossing) */
    function isRingCrossing(previous_position, current_position, ring) {
        if ((previous_position.x - ring.x) * (current_position.x - ring.x) > 0
            || previous_position.x === current_position.x) {
            return null;
        }
        const ratio = (ring.x - previous_position.x) / (current_position.x - previous_position.x);
        const crossing_y = previous_position.y + ratio * (current_position.y - previous_position.y);
        return Math.abs(crossing_y - ring.y) < ring.radius ? "through" : "missed";
    }

    globalThis.charged_particle_game = {
        randomRing,
        isSituationFeasible,
        isRingCrossing,
        MILESTONES,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Défi anneau", en: "Ring challenge" },
        panel_title: { fr: "Défi anneau", en: "Ring challenge" },
        hint: {
            fr: "Réglez les champs, la charge, y₀ et u₀ pour faire passer la particule dans l'anneau !",
            en: "Tune the fields, the charge, y₀ and u₀ to fly the particle through the ring!",
        },
        new_target: { fr: "Nouvel anneau", en: "New ring" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Anneaux réussis", en: "Rings cleared" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Anneau", en: "Ring" },
        target_info: {
            fr: "x = {x} m · y = {y} m · rayon {r} m",
            en: "x = {x} m · y = {y} m · radius {r} m",
        },
        scored: { fr: "DANS L'ANNEAU !", en: "THROUGH THE RING!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        missed: { fr: "À côté…", en: "Missed…" },
        plate_hit: { fr: "La particule a percuté une plaque !", en: "The particle hit a plate!" },
        out_of_range: { fr: "L'anneau n'a pas été atteint…", en: "The ring was never reached…" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let ring = randomRing();
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

    /* nextMilestone: first tier strictly above the score, null once all are reached */
    function nextMilestone(score) {
        for (const milestone of MILESTONES) {
            if (score < milestone) {
                return milestone;
            }
        }
        return null;
    }

    /* newRing: fresh feasible ring, flight reset, panel refreshed */
    function newRing() {
        ring = randomRing();
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
            .replace("{x}", formatValue(ring.x))
            .replace("{y}", formatValue(ring.y))
            .replace("{r}", formatValue(ring.radius));
    }

    /* setActive: toggle game mode; resets the flight so no trajectory hint leaks */
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
        new_target_button.addEventListener("click", newRing);
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
    function showBanner(key, color, seconds) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
    }

    /* failAttempt: show the reason, schedule a reset */
    function failAttempt(reason_key) {
        attempt_over = true;
        pending_fail = true;
        showBanner(reason_key, "#d32f2f", 1.4);
        updatePanel();
    }

    /* succeedAttempt: count the ring, celebrate, schedule a new one */
    function succeedAttempt(context, transform) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX(ring.x), transform.toScreenY(ring.y));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner("scored", "#e8722c", 2);
        updatePanel();
    }

    /* drawRing: golden ring (narrow ellipse) with its coordinates annotated */
    function drawRing(context, transform) {
        const center_x = transform.toScreenX(ring.x);
        const center_y = transform.toScreenY(ring.y);
        const radius_pixels = Math.abs(transform.toScreenY(ring.y + ring.radius) - center_y);
        context.save();
        context.strokeStyle = "#b8860b";
        context.lineWidth = 6;
        context.beginPath();
        context.ellipse(center_x, center_y, Math.max(radius_pixels * 0.22, 4), radius_pixels, 0, 0, 2 * Math.PI);
        context.stroke();
        context.strokeStyle = "#fbc02d";
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
            `(${formatValue(ring.x)} ; ${formatValue(ring.y)}) · r = ${formatValue(ring.radius)} m`,
            center_x,
            center_y + radius_pixels + 8,
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
            context.fillText(strings[banner_key][language], context.canvas.width / 2, 30);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    78,
                );
            }
            context.restore();
            if (banner_seconds <= 0) {
                milestone_level = null;
                if (pending_success) {
                    pending_success = false;
                    newRing();
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

        drawRing(context, transform);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                updatePanel();
            }
            if (!attempt_over) {
                const crossing = isRingCrossing(previous_state, state, ring);
                if (crossing === "through") {
                    succeedAttempt(context, transform);
                } else if (crossing === "missed") {
                    failAttempt("missed");
                } else if (state.time >= state.total_time - 1e-9) {
                    failAttempt(state.x < ring.x ? (state.y <= 0.01 || state.y >= 3.99 ? "plate_hit" : "out_of_range") : "missed");
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

    /* in game mode, any parameter change resets the flight — otherwise a half-drawn
       trace could be used to aim */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.charged_particle_game_overlay = overlay;
    /* fit-view extent for main.js: keep the ring (plus headroom) in frame */
    globalThis.charged_particle_game_view_extent = () => (game_active
        ? { right: ring.x + 2 }
        : null);
})();
