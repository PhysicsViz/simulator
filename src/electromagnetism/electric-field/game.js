/*
 * game.js — EXPERIMENTAL "find the hidden charge" game mode for the electric
 * field exercise. A point charge of random position and value hides in the
 * marked search area; the field-arrow map is hidden, but the golden PROBE still
 * measures the total field — its arrow points along the line to the charge
 * (away for q > 0, toward it for q < 0) and its magnitude follows k·q/r², so a
 * couple of measurements triangulate the source. Click anywhere to drop the 🎯
 * guess marker, then press "Valider": within the tolerance the charge is
 * revealed and scored; otherwise the distance to the real charge is shown and
 * the attempt counts. Every challenge is trivially solvable (generation bounds
 * + checker + Monte-Carlo tests). Milestone tiers as in the other exercises.
 * Self-contained: to remove, delete this file, its test file, the GAME MODE
 * blocks in index.html, and the marked "Game mode hook" lines in main.js
 * (gameLocked() and the constraints function are inert without this file).
 * Integration surface: the "game-mode" body class (set here),
 * globalThis.electric_field_game_overlay (called each frame),
 * globalThis.electric_field_game_extra_field (the hidden charge's field, added
 * by main.js to every probe/field evaluation) and
 * globalThis.electric_field_apply_game_constraints (clears the user's sources).
 * Pure logic is exposed as globalThis.electric_field_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const SEARCH_AREA = { left: -4, right: 4, bottom: -2.5, top: 2.5 };
    const TOLERANCE = 0.4;

    /* randomHiddenCharge: random position in the search area, |q| 2–8 µC, random sign */
    function randomHiddenCharge(rng = Math.random) {
        return {
            x: Math.round((SEARCH_AREA.left + rng() * (SEARCH_AREA.right - SEARCH_AREA.left)) * 10) / 10,
            y: Math.round((SEARCH_AREA.bottom + rng() * (SEARCH_AREA.top - SEARCH_AREA.bottom)) * 10) / 10,
            value: (rng() < 0.5 ? -1 : 1) * (2 + rng() * 6) * 1e-6,
        };
    }

    /* isChallengeFeasible: the charge is inside the search area and measurable */
    function isChallengeFeasible(hidden) {
        return hidden.x >= SEARCH_AREA.left && hidden.x <= SEARCH_AREA.right
            && hidden.y >= SEARCH_AREA.bottom && hidden.y <= SEARCH_AREA.top
            && Math.abs(hidden.value) >= 2e-6 && Math.abs(hidden.value) <= 8e-6;
    }

    /* isFound: the guess lies within the tolerance of the hidden charge */
    function isFound(guess_x, guess_y, hidden, tolerance = TOLERANCE) {
        return Math.hypot(guess_x - hidden.x, guess_y - hidden.y) <= tolerance;
    }

    globalThis.electric_field_game = {
        randomHiddenCharge,
        isChallengeFeasible,
        isFound,
        MILESTONES,
        SEARCH_AREA,
        TOLERANCE,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Exploration", en: "Exploration" },
        tab_game: { fr: "Charge cachée", en: "Hidden charge" },
        panel_title: { fr: "Trouve la charge cachée !", en: "Find the hidden charge!" },
        hint: {
            fr: "Une charge ponctuelle se cache dans la zone en pointillés. Déplacez la sonde : son vecteur E⃗ pointe le long de la droite vers la charge (fuyant si q > 0, vers elle si q < 0) et sa norme suit k·q/r². Cliquez pour poser le repère 🎯 puis validez !",
            en: "A point charge hides in the dashed area. Move the probe: its E⃗ vector points along the line to the charge (away if q > 0, toward it if q < 0) and its magnitude follows k·q/r². Click to drop the 🎯 marker, then validate!",
        },
        new_target: { fr: "Nouvelle charge", en: "New charge" },
        validate: { fr: "✓ Valider ma réponse", en: "✓ Validate my answer" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Charges trouvées", en: "Charges found" },
        attempts_label: { fr: "Validations", en: "Validations" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Défi", en: "Challenge" },
        target_info: {
            fr: "|q| entre 2 et 8 µC, signe inconnu · zone 8 × 5 m · tolérance {tol} m",
            en: "|q| between 2 and 8 µC, unknown sign · 8 × 5 m area · tolerance {tol} m",
        },
        measured_label: { fr: "Mesure de la sonde", en: "Probe reading" },
        no_guess: { fr: "Placez d'abord le repère 🎯 !", en: "Drop the 🎯 marker first!" },
        scored: { fr: "CHARGE TROUVÉE !", en: "CHARGE FOUND!" },
        revealed: { fr: "q = {q} µC", en: "q = {q} µC" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        missed: { fr: "Raté — à {d} m de la charge…", en: "Missed — {d} m from the charge…" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let hidden = randomHiddenCharge();
    let guess = null;
    let goals = 0;
    let attempts = 0;
    let revealed = false;
    let particles = [];
    let banner_seconds = 0;
    let banner_key = null;
    let banner_extra = "";
    let banner_color = "#e8722c";
    let milestone_level = null;
    let pending_success = false;
    let last_overlay_milliseconds = null;
    let last_transform = null;
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

    /* newHiddenCharge: fresh hidden charge, guess cleared */
    function newHiddenCharge() {
        hidden = randomHiddenCharge();
        guess = null;
        revealed = false;
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
        panel_elements.validate_button.textContent = strings.validate[language];
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
            .replace("{tol}", formatValue(TOLERANCE));

        cards.measured.name.textContent = strings.measured_label[language];
    }

    /* setActive: toggle game mode — clears the user's sources via the main hook */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        guess = null;
        revealed = false;
        particles = [];
        banner_seconds = 0;
        milestone_level = null;
        pending_success = false;
        if (active && typeof globalThis.electric_field_apply_game_constraints === "function") {
            globalThis.electric_field_apply_game_constraints();
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

    /* buildUi: mode tabs + stats panel with the validate button */
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
        const validate_button = document.createElement("button");
        validate_button.type = "button";
        validate_button.className = "primary";
        validate_button.addEventListener("click", validateGuess);
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newHiddenCharge);
        head.append(title, hint, validate_button, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            measured: createCard("game-value game-measured"),
            target: createCard("game-target-value game-target"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = { panel, title, hint, new_target_button, validate_button, tab_simulation, tab_game, cards };
    }

    /* validateGuess: compare the marker with the hidden charge */
    function validateGuess() {
        if (!game_active || revealed) {
            return;
        }
        if (guess === null) {
            showBanner("no_guess", "#d32f2f", 1.4, "");
            return;
        }
        attempts += 1;
        if (isFound(guess.x, guess.y, hidden)) {
            goals += 1;
            revealed = true;
            pending_success = true;
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            showBanner("scored", "#e8722c", 2.4, "");
        } else {
            const distance = Math.hypot(guess.x - hidden.x, guess.y - hidden.y);
            showBanner("missed", "#d32f2f", 1.8, formatValue(distance));
        }
        updatePanel();
    }

    /* showBanner: display a canvas banner for a duration */
    function showBanner(key, color, seconds, extra) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
        banner_extra = extra;
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

    /* drawGame: search area, guess marker and (when revealed) the hidden charge */
    function drawGame(context, transform) {
        context.save();
        context.strokeStyle = "rgba(120, 130, 145, 0.7)";
        context.setLineDash([8, 6]);
        context.lineWidth = 1.5;
        context.strokeRect(
            transform.toScreenX(SEARCH_AREA.left),
            transform.toScreenY(SEARCH_AREA.top),
            transform.toScreenX(SEARCH_AREA.right) - transform.toScreenX(SEARCH_AREA.left),
            transform.toScreenY(SEARCH_AREA.bottom) - transform.toScreenY(SEARCH_AREA.top),
        );
        context.setLineDash([]);

        if (guess !== null) {
            context.font = "26px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("🎯", transform.toScreenX(guess.x), transform.toScreenY(guess.y));
            context.strokeStyle = "rgba(211, 47, 47, 0.6)";
            context.beginPath();
            context.arc(
                transform.toScreenX(guess.x),
                transform.toScreenY(guess.y),
                Math.abs(transform.toScreenY(guess.y + TOLERANCE) - transform.toScreenY(guess.y)),
                0,
                2 * Math.PI,
            );
            context.stroke();
        }

        if (revealed) {
            const screen_x = transform.toScreenX(hidden.x);
            const screen_y = transform.toScreenY(hidden.y);
            context.fillStyle = hidden.value >= 0 ? "#d32f2f" : "#1976d2";
            context.strokeStyle = "#fbc02d";
            context.lineWidth = 3;
            context.beginPath();
            context.arc(screen_x, screen_y, 12, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
            context.fillStyle = "#ffffff";
            context.font = "bold 15px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(hidden.value >= 0 ? "+" : "−", screen_x, screen_y);
            context.fillStyle = hidden.value >= 0 ? "#d32f2f" : "#1976d2";
            context.font = "bold 12px system-ui, sans-serif";
            context.textBaseline = "top";
            context.fillText(
                strings.revealed[currentLanguage()].replace("{q}", formatValue(hidden.value * 1e6)),
                screen_x,
                screen_y + 16,
            );
        }
        context.restore();
    }

    /* drawEffects: confetti and banners, advanced by dt */
    function drawEffects(context, transform, delta_seconds) {
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
            context.font = "bold 38px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(
                strings[banner_key][language].replace("{d}", banner_extra),
                context.canvas.width / 2,
                30,
            );
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    76,
                );
            }
            context.restore();
            if (banner_seconds <= 0) {
                milestone_level = null;
                if (pending_success) {
                    pending_success = false;
                    newHiddenCharge();
                }
            }
        }
    }

    /* overlay: called by main.js at the end of every frame */
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
        last_transform = transform;

        if (pending_success && particles.length === 0 && banner_seconds > 2.3) {
            spawnConfetti(transform.toScreenX(hidden.x), transform.toScreenY(hidden.y));
        }
        drawGame(context, transform);
        const magnitude = Math.hypot(state.field.x, state.field.y);
        panel_elements.cards.measured.value.textContent = magnitude >= 1000
            ? `|E| = ${formatValue(magnitude / 1000)} kV/m`
            : `|E| = ${formatValue(magnitude)} V/m`;

        drawEffects(context, transform, delta_seconds);
    }

    /* the hidden charge's field, added by main.js to every field evaluation */
    function extraField(x, y) {
        if (!game_active) {
            return null;
        }
        return globalThis.electric_field_calcul.pointChargeField(hidden.value, hidden.x, hidden.y, x, y);
    }

    /* guess placement: clicks on the canvas while the game runs drop the marker
       (element placement is blocked by main.js in game mode, so no conflict) */
    function bindGuessClicks() {
        const canvas = document.getElementById("simulation_canvas");
        let down = null;
        canvas.addEventListener("pointerdown", (event) => {
            down = { x: event.clientX, y: event.clientY };
        });
        canvas.addEventListener("click", (event) => {
            if (!game_active || revealed) {
                return;
            }
            if (down !== null && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) {
                return;
            }
            if (last_transform === null) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const pixel_x = (event.clientX - rect.left) * canvas.width / rect.width;
            const pixel_y = (event.clientY - rect.top) * canvas.height / rect.height;
            const bounds = last_transform.bounds;
            const world_x = bounds.left + (pixel_x / canvas.width) * (bounds.right - bounds.left);
            const world_y = bounds.top - (pixel_y / canvas.height) * (bounds.top - bounds.bottom);
            guess = { x: Math.round(world_x * 10) / 10, y: Math.round(world_y * 10) / 10 };
        });
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    bindGuessClicks();
    globalThis.electric_field_game_overlay = overlay;
    globalThis.electric_field_game_extra_field = extraField;
})();
