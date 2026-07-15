/*
 * game.js — EXPERIMENTAL "design the cable" game mode for the coaxial capacitor.
 * The challenge imposes a target capacitance C* (±5 %), a working voltage V_ab
 * that the finished cable must hold, and the insulator's dielectric strength
 * E_max. The student tunes the geometry a, b, L (lambda is irrelevant to C and
 * the outer tube is forced charged) so that:
 *   - C = 2πε₀L/ln(b/a) lands within ±5 % of C*, AND
 *   - the field at the inner conductor E(a) = V_ab/(a·ln(b/a)) stays below E_max
 *     (otherwise the insulator breaks down — ⚡).
 * Because C fixes ln(b/a)/L but not a, the breakdown constraint is loosened by
 * larger a and L: a valid window always exists inside the ranges (constructive
 * generation + pure checker + Monte-Carlo tests). Press "Tester le câble !" to
 * validate; on breakdown a lightning bolt flashes and the attempt fails.
 * Milestone tiers as in the other exercises. Self-contained: to remove, delete
 * this file, its test file, the GAME MODE blocks in index.html, and the marked
 * "Game mode hook" line in main.js. Integration surface: the "game-mode" body
 * class (set here) and globalThis.coaxial_game_overlay (called each frame).
 * Pure logic is exposed as globalThis.coaxial_game for tests.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const VACUUM_PERMITTIVITY = 8.854e-12;
    const TWO_PI_EPSILON = 2 * Math.PI * VACUUM_PERMITTIVITY;
    const TOLERANCE = 0.05;
    const RANGE = { a_min: 0.5, a_max: 4, b_min: 2, b_max: 15, length_min: 0.1, length_max: 10 };

    /* capacitance: C = 2πε₀L/ln(b/a), radii in cm, length in m */
    function capacitance(a_cm, b_cm, length) {
        return TWO_PI_EPSILON * length / Math.log(b_cm / a_cm);
    }

    /* innerField: E(a) = V_ab / (a·ln(b/a)) for an applied voltage V_ab (a in cm → m) */
    function innerField(voltage, a_cm, b_cm) {
        return voltage / ((a_cm / 100) * Math.log(b_cm / a_cm));
    }

    /* isValid: geometry hits the target capacitance and survives the working voltage */
    function isValid(a_cm, b_cm, length, challenge) {
        if (b_cm <= a_cm + 0.4) {
            return false;
        }
        const c = capacitance(a_cm, b_cm, length);
        const within = Math.abs(c - challenge.target_capacitance) <= TOLERANCE * challenge.target_capacitance;
        const survives = innerField(challenge.voltage, a_cm, b_cm) <= challenge.breakdown_field;
        return within && survives;
    }

    /* isChallengeFeasible: some geometry in the ranges is valid */
    function isChallengeFeasible(challenge) {
        for (let a_cm = RANGE.a_min; a_cm <= RANGE.a_max; a_cm += 0.1) {
            for (let length = RANGE.length_min; length <= RANGE.length_max; length += 0.2) {
                // the capacitance fixes ln(b/a); solve for the matching b
                const ratio = Math.exp(TWO_PI_EPSILON * length / challenge.target_capacitance);
                const b_cm = a_cm * ratio;
                if (b_cm >= RANGE.b_min && b_cm <= RANGE.b_max && isValid(a_cm, b_cm, length, challenge)) {
                    return true;
                }
            }
        }
        return false;
    }

    /* randomChallenge: built from a reference cable, with a breakdown limit that
       leaves headroom at the reference but bites cramped geometries. rng injectable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const a_cm = 1 + rng() * 2;
            const b_cm = a_cm + 2 + rng() * 6;
            const length = 0.5 + rng() * 4;
            const voltage = 2000 + rng() * 8000;
            const reference_field = innerField(voltage, a_cm, b_cm);
            const candidate = {
                target_capacitance: capacitance(a_cm, b_cm, length),
                voltage,
                breakdown_field: Math.round(reference_field * (1.15 + rng() * 0.5)),
            };
            if (isChallengeFeasible(candidate)) {
                return candidate;
            }
        }
        const fallback_voltage = 5000;
        return {
            target_capacitance: capacitance(2, 8, 1),
            voltage: fallback_voltage,
            breakdown_field: Math.round(innerField(fallback_voltage, 2, 8) * 1.4),
        };
    }

    globalThis.coaxial_game = {
        capacitance,
        innerField,
        isValid,
        isChallengeFeasible,
        randomChallenge,
        MILESTONES,
        TOLERANCE,
        RANGE,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Exploration", en: "Exploration" },
        tab_game: { fr: "Conçois le câble", en: "Design the cable" },
        panel_title: { fr: "Conçois le câble !", en: "Design the cable!" },
        hint: {
            fr: "Réglez a, b et L pour atteindre la capacité cible C* (±5 %) tout en gardant le champ à l'armature interne E(a) sous le champ disruptif de l'isolant — sinon c'est le claquage ⚡ !",
            en: "Tune a, b and L to reach the target capacitance C* (±5%) while keeping the field at the inner conductor E(a) below the insulator's breakdown field — otherwise it arcs over ⚡!",
        },
        new_target: { fr: "Nouveau câble", en: "New cable" },
        validate: { fr: "⚡ Tester le câble !", en: "⚡ Test the cable!" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Câbles conçus", en: "Cables designed" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Cahier des charges", en: "Specification" },
        target_info: {
            fr: "C* = {c} pF (±5 %) · tension V_ab = {v} kV · champ disruptif E_max = {e} kV/m",
            en: "C* = {c} pF (±5%) · voltage V_ab = {v} kV · breakdown field E_max = {e} kV/m",
        },
        current_label: { fr: "Câble actuel", en: "Current cable" },
        scored: { fr: "CÂBLE VALIDÉ !", en: "CABLE APPROVED!" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        wrong_capacitance: { fr: "Mauvaise capacité !", en: "Wrong capacitance!" },
        breakdown: { fr: "CLAQUAGE ! E(a) trop élevé", en: "BREAKDOWN! E(a) too high" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let particles = [];
    let banner_seconds = 0;
    let banner_key = null;
    let banner_color = "#e8722c";
    let milestone_level = null;
    let pending_success = false;
    let breakdown_flash = 0;
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

    /* live geometry reads */
    function currentGeometry() {
        return {
            a_cm: Number(document.getElementById("number_radius_a_cm").value) || 2,
            b_cm: Number(document.getElementById("number_radius_b_cm").value) || 8,
            length: Number(document.getElementById("number_cable_length").value) || 1,
        };
    }

    /* forceOuterCharged: the game assumes the −λ tube (checkbox forced on, disabled) */
    function forceOuterCharged() {
        const checkbox = document.getElementById("toggle_outer_charged");
        checkbox.checked = true;
        checkbox.disabled = game_active;
        checkbox.dispatchEvent(new Event("input"));
    }

    /* newChallenge: fresh feasible specification */
    function newChallenge() {
        challenge = randomChallenge();
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
            .replace("{c}", formatValue(challenge.target_capacitance * 1e12))
            .replace("{v}", formatValue(challenge.voltage / 1000))
            .replace("{e}", formatValue(challenge.breakdown_field / 1000));

        cards.current.name.textContent = strings.current_label[language];
        const geometry = currentGeometry();
        cards.current.value.textContent =
            `C = ${formatValue(capacitance(geometry.a_cm, geometry.b_cm, geometry.length) * 1e12)} pF · E(a) = ${formatValue(innerField(challenge.voltage, geometry.a_cm, geometry.b_cm) / 1000)} kV/m`;
    }

    /* setActive: toggle game mode */
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
        breakdown_flash = 0;
        forceOuterCharged();
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

    /* buildUi: mode tabs + stats panel with the test button */
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
        validate_button.addEventListener("click", validateAttempt);
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newChallenge);
        head.append(title, hint, validate_button, new_target_button);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            current: createCard("game-target-value game-current"),
            target: createCard("game-target-value game-target"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = { panel, title, hint, new_target_button, validate_button, tab_simulation, tab_game, cards };
    }

    /* validateAttempt: check the target capacitance and breakdown constraint */
    function validateAttempt() {
        if (!game_active || pending_success) {
            return;
        }
        attempts += 1;
        const geometry = currentGeometry();
        const field = innerField(challenge.voltage, geometry.a_cm, geometry.b_cm);
        if (field > challenge.breakdown_field) {
            breakdown_flash = 1.2;
            showBanner("breakdown", "#d32f2f", 2);
        } else if (isValid(geometry.a_cm, geometry.b_cm, geometry.length, challenge)) {
            goals += 1;
            pending_success = true;
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            showBanner("scored", "#e8722c", 2.4);
        } else {
            showBanner("wrong_capacitance", "#d32f2f", 1.8);
        }
        updatePanel();
    }

    /* showBanner: display a canvas banner for a duration */
    function showBanner(key, color, seconds) {
        banner_key = key;
        banner_color = color;
        banner_seconds = seconds;
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

    /* drawBreakdown: a jagged lightning bolt from the inner conductor to the tube */
    function drawBreakdown(context, transform, state) {
        if (breakdown_flash <= 0) {
            return;
        }
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(0);
        const inner_pixels = Math.abs(transform.toScreenX(state.radius_a_cm) - center_x);
        const outer_pixels = Math.abs(transform.toScreenX(state.radius_b_cm) - center_x);
        const angle = 0.4;
        context.save();
        context.globalAlpha = Math.min(breakdown_flash, 1);
        context.strokeStyle = "#fbc02d";
        context.lineWidth = 3;
        context.beginPath();
        let radius = inner_pixels;
        context.moveTo(center_x + Math.cos(angle) * radius, center_y + Math.sin(angle) * radius);
        for (let i = 1; i <= 6; i++) {
            radius = inner_pixels + ((outer_pixels - inner_pixels) * i) / 6;
            const jitter = (Math.random() - 0.5) * 0.3;
            context.lineTo(
                center_x + Math.cos(angle + jitter) * radius,
                center_y + Math.sin(angle + jitter) * radius,
            );
        }
        context.stroke();
        context.restore();
    }

    /* drawEffects: confetti, breakdown flash and banners, advanced by dt */
    function drawEffects(context, transform, state, delta_seconds) {
        if (breakdown_flash > 0) {
            breakdown_flash -= delta_seconds;
            drawBreakdown(context, transform, state);
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

        const language = currentLanguage();
        if (banner_seconds > 0) {
            banner_seconds -= delta_seconds;
            context.save();
            context.globalAlpha = Math.min(banner_seconds, 1);
            context.fillStyle = banner_color;
            context.font = "bold 36px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(strings[banner_key][language], context.canvas.width / 2, 30);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[language].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    74,
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

        if (pending_success && particles.length === 0 && banner_seconds > 2.3) {
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 2);
        }
        updatePanel();
        drawEffects(context, transform, state, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.coaxial_game_overlay = overlay;
})();
