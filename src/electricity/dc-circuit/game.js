/*
 * game.js — EXPERIMENTAL "target current" game mode for the DC circuit exercise.
 * The classic series/parallel puzzle: the source is locked at 9 V and every
 * resistor placed is locked at 10 Ω; the student must WIRE the circuit (series
 * and parallel combinations, switches allowed, capacitors disabled) so the
 * ammeter reads a random target current within ±2 %. The target is generated
 * from a random series/parallel tree of at most four 10 Ω resistors, so it is
 * always buildable — the pure generator and checker are exported and
 * Monte-Carlo tested. Holding the reading in tolerance for half a second
 * scores; milestone tiers as in the other exercises. Self-contained: to remove,
 * delete this file, its test file, the GAME MODE blocks in index.html, and the
 * marked "Game mode hook" lines in main.js (the gameLocked() helper is inert
 * without this file). Integration surface: the "game-mode" body class (set
 * here, read by main.js to lock values and disable the capacitor tool) and
 * globalThis.circuit_game_overlay (called by main.js each frame). Pure logic is
 * exposed as globalThis.circuit_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const SOURCE_VOLTAGE = 9;
    const UNIT_RESISTANCE = 10;
    const TOLERANCE = 0.02;
    const HOLD_SECONDS = 0.5;

    /* randomResistanceTree: random series/parallel combination of unit resistors,
       at most 4 of them (depth-limited binary tree); returns {resistance, count} */
    function randomResistanceTree(rng, depth = 0) {
        if (depth >= 2 || rng() < 0.4) {
            return { resistance: UNIT_RESISTANCE, count: 1 };
        }
        const left = randomResistanceTree(rng, depth + 1);
        const right = randomResistanceTree(rng, depth + 1);
        if (rng() < 0.5) {
            return { resistance: left.resistance + right.resistance, count: left.count + right.count };
        }
        return {
            resistance: (left.resistance * right.resistance) / (left.resistance + right.resistance),
            count: left.count + right.count,
        };
    }

    /* randomTarget: buildable target — never the trivial single resistor */
    function randomTarget(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const tree = randomResistanceTree(rng);
            if (tree.count >= 2) {
                return {
                    target_current: SOURCE_VOLTAGE / tree.resistance,
                    reference_resistance: tree.resistance,
                    resistor_count: tree.count,
                };
            }
        }
        return { target_current: SOURCE_VOLTAGE / (2 * UNIT_RESISTANCE), reference_resistance: 2 * UNIT_RESISTANCE, resistor_count: 2 };
    }

    /* isSolved: the measured current matches the target within the tolerance */
    function isSolved(measured_current, target_current, tolerance = TOLERANCE) {
        return measured_current !== null
            && Math.abs(measured_current - target_current) <= tolerance * target_current;
    }

    globalThis.circuit_game = {
        randomResistanceTree,
        randomTarget,
        isSolved,
        MILESTONES,
        SOURCE_VOLTAGE,
        UNIT_RESISTANCE,
        TOLERANCE,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Objectif courant", en: "Target current" },
        panel_title: { fr: "Objectif courant", en: "Target current" },
        hint: {
            fr: "Source bloquée à 9 V, résistances bloquées à 10 Ω : câblez-les en série/parallèle pour que l'ampèremètre affiche le courant cible (±2 %) !",
            en: "Source locked at 9 V, resistors locked at 10 Ω: wire them in series/parallel so the ammeter reads the target current (±2%)!",
        },
        new_target: { fr: "Nouvelle cible", en: "New target" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Cibles atteintes", en: "Targets hit" },
        target_label: { fr: "Courant cible", en: "Target current" },
        target_info: { fr: "I* = {i} A (±2 %) · réalisable avec {n} × 10 Ω", en: "I* = {i} A (±2%) · buildable with {n} × 10 Ω" },
        measured_label: { fr: "Courant mesuré", en: "Measured current" },
        no_ammeter: { fr: "pas d'ampèremètre !", en: "no ammeter!" },
        scored: { fr: "COURANT ATTEINT !", en: "TARGET REACHED!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let target = randomTarget();
    let goals = 0;
    let hold_seconds = 0;
    let celebrating = false;
    let particles = [];
    let banner_seconds = 0;
    let milestone_level = null;
    let last_overlay_milliseconds = null;
    let panel_elements = null;

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatCurrent: three-decimal current matching the page locale */
    function formatCurrent(value) {
        const text = value.toFixed(3);
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

    /* newTarget: fresh buildable target current */
    function newTarget() {
        target = randomTarget();
        hold_seconds = 0;
        celebrating = false;
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

        cards.target.name.textContent = strings.target_label[language];
        cards.target.value.textContent = strings.target_info[language]
            .replace("{i}", formatCurrent(target.target_current))
            .replace("{n}", target.resistor_count);

        cards.measured.name.textContent = strings.measured_label[language];
    }

    /* setActive: toggle game mode — the body class also makes main.js lock values */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        hold_seconds = 0;
        celebrating = false;
        particles = [];
        banner_seconds = 0;
        milestone_level = null;
        if (active && typeof globalThis.circuit_apply_game_constraints === "function") {
            globalThis.circuit_apply_game_constraints();
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
        new_target_button.addEventListener("click", newTarget);
        head.append(title, hint, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            measured: createCard("game-value game-measured"),
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

    /* succeed: count the goal, celebrate, then generate a new target */
    function succeed(context) {
        goals += 1;
        celebrating = true;
        banner_seconds = 2;
        spawnConfetti(context.canvas.width / 2, context.canvas.height / 2);
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        updatePanel();
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
            context.fillStyle = "#e8722c";
            context.font = "bold 40px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings.scored[language], context.canvas.width / 2, 30);
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
                if (celebrating) {
                    newTarget();
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

        const language = currentLanguage();
        /* the sign of the reading depends on the edge's arbitrary node order — the
           target is a magnitude */
        const measured = state.ammeter_current === null ? null : Math.abs(state.ammeter_current);
        panel_elements.cards.measured.value.textContent = measured === null
            ? strings.no_ammeter[language]
            : `${formatCurrent(measured)} / ${formatCurrent(target.target_current)} A`;

        if (!celebrating) {
            if (isSolved(measured, target.target_current)) {
                hold_seconds += delta_seconds;
                if (hold_seconds >= HOLD_SECONDS) {
                    succeed(context);
                }
            } else {
                hold_seconds = 0;
            }
        }

        drawEffects(context, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.circuit_game_overlay = overlay;
})();
