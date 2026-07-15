/*
 * game.js — EXPERIMENTAL shield-grazing game mode for the sphere-approach
 * exercise. A probe must make its turnaround inside a golden ring above the
 * charged shield: Q, q, m and R are imposed and locked (the margin row is
 * hidden), and the student only chooses the launch speed v∞ — the closest
 * approach is r_min = 2·k·Q·q/(m·v∞²), exactly the course's energy argument,
 * monotonically decreasing with v: too slow turns around before the ring
 * (scan missed), too fast dives past it or hits the shield. Every generated
 * situation is provably solvable: the ring is built around the turnaround of
 * a reference speed on the 0.1 m/s grid and the pure checker re-scans the
 * grid (rejection sampling + deterministic fallback built on the course's
 * numbers with the ring at 6–8 cm from the surface, where v ≈ 112 m/s wins).
 * Formulas, graphs, the limit/turning markers and time scrubbing are hidden
 * while active; any parameter change resets the run; milestone tiers as in
 * the other exercises. Self-contained: to remove, delete this file, its test
 * file, the GAME MODE blocks in index.html, and the marked "Game mode hook"
 * lines in main.js. Integration surface: the "game-mode" body class (set
 * here) and globalThis.sphere_approach_game_overlay (called by main.js each
 * frame). Pure logic is exposed as globalThis.sphere_approach_game for tests.
 */
(() => {
    const calc = globalThis.sphere_approach_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const SPEED_STEP = 0.1;
    const SPEED_MIN = 10;
    const SPEED_MAX = 500;
    const BAND_HALF_WIDTH = 0.01;

    /* gapFor: closest-approach distance to the SURFACE for a launch speed
       (negative means the probe would hit the shield) */
    function gapFor(challenge, launch_speed) {
        return calc.turningRadius(
            challenge.sphere_charge, challenge.ball_charge, challenge.mass, launch_speed,
        ) - challenge.sphere_radius;
    }

    /* winningSpeeds: every slider-grid v turning around inside the ring */
    function winningSpeeds(challenge) {
        const winners = [];
        const steps = Math.round((SPEED_MAX - SPEED_MIN) / SPEED_STEP);
        for (let i = 0; i <= steps; i++) {
            const speed = Math.round((SPEED_MIN + i * SPEED_STEP) * 10) / 10;
            const gap = gapFor(challenge, speed);
            if (gap >= challenge.band_low - 1e-12 && gap <= challenge.band_high + 1e-12) {
                winners.push(speed);
            }
        }
        return winners;
    }

    /* isSituationFeasible: a slider-grid v places the turnaround in the ring */
    function isSituationFeasible(challenge) {
        if (challenge.sphere_charge < 1e-6 || challenge.sphere_charge > 20e-6
            || challenge.ball_charge < 0.1e-6 || challenge.ball_charge > 5e-6
            || challenge.mass < 5e-6 || challenge.mass > 500e-6
            || challenge.sphere_radius < 0.02 || challenge.sphere_radius > 0.3
            || !(challenge.band_high > challenge.band_low) || challenge.band_low < 0.005
            || challenge.band_high + challenge.sphere_radius > 1.5) {
            return false;
        }
        return winningSpeeds(challenge).length > 0;
    }

    /* randomChallenge: imposed setup on the slider grids, ring built around a
       reference grid speed's turnaround — always solvable */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const candidate = {
                sphere_charge: (1 + Math.round(rng() * 190) / 10) * 1e-6,
                ball_charge: (0.1 + Math.round(rng() * 49) / 10) * 1e-6,
                mass: (5 + Math.round(rng() * 495)) * 1e-6,
                sphere_radius: (2 + Math.round(rng() * 56) / 2) / 100,
                band_low: 0,
                band_high: 0,
            };
            const reference_speed = Math.round((30 + rng() * 300) * 10) / 10;
            const gap = gapFor(candidate, reference_speed);
            if (gap < 0.02 || gap > 0.4) {
                continue;
            }
            candidate.band_low = Math.round((gap - BAND_HALF_WIDTH) * 1000) / 1000;
            candidate.band_high = Math.round((gap + BAND_HALF_WIDTH) * 1000) / 1000;
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return {
            sphere_charge: 8e-6,
            ball_charge: 1e-6,
            mass: 60e-6,
            sphere_radius: 0.12,
            band_low: 0.06,
            band_high: 0.08,
        };
    }

    globalThis.sphere_approach_game = {
        gapFor,
        winningSpeeds,
        isSituationFeasible,
        randomChallenge,
        MILESTONES,
        SPEED_STEP,
        BAND_HALF_WIDTH,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Frôle le bouclier !", en: "Graze the shield!" },
        panel_title: { fr: "Frôle le bouclier !", en: "Graze the shield!" },
        hint: {
            fr: "La sonde doit faire demi-tour DANS l'anneau doré au-dessus du bouclier chargé. Seule v∞ est à vous : r_min = 2·k·Q·q/(m·v∞²) !",
            en: "The probe must turn around INSIDE the golden ring above the charged shield. Only v∞ is yours: r_min = 2·k·Q·q/(m·v∞²)!",
        },
        new_target: { fr: "Nouvelle sonde", en: "New probe" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Scans réussis", en: "Scans completed" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        target_label: { fr: "Mission", en: "Mission" },
        target_info: {
            fr: "Q = {q} µC · q = {b} µC · m = {m} mg · R = {r} cm",
            en: "Q = {q} µC · q = {b} µC · m = {m} mg · R = {r} cm",
        },
        band_info: { fr: "demi-tour entre {a} et {b} cm de la surface", en: "turnaround between {a} and {b} cm from the surface" },
        scanned: { fr: "SCAN PARFAIT ! demi-tour à {d} cm", en: "PERFECT SCAN! turnaround at {d} cm" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        too_slow: { fr: "Trop loin… demi-tour à {d} cm (trop lent)", en: "Too far… turned at {d} cm (too slow)" },
        too_fast: { fr: "Trop près ! demi-tour à {d} cm (trop rapide)", en: "Too close! turned at {d} cm (too fast)" },
        crashed: { fr: "💥 BOUCLIER TOUCHÉ !", en: "💥 SHIELD HIT!" },
        zone_label: { fr: "anneau de scan", en: "scan ring" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];
    const LOCKED_INPUT_IDS = [
        "slider_sphere_charge_microcoulombs", "number_sphere_charge_microcoulombs",
        "slider_ball_charge_microcoulombs", "number_ball_charge_microcoulombs",
        "slider_ball_mass_milligrams", "number_ball_mass_milligrams",
        "slider_sphere_radius_centimeters", "number_sphere_radius_centimeters",
    ];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let attempt_over = true;
    let min_radius = Infinity;
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

    /* applyChallenge: impose the setup, reset the player's speed */
    function applyChallenge() {
        setInputValue("number_sphere_charge_microcoulombs", challenge.sphere_charge * 1e6);
        setInputValue("number_ball_charge_microcoulombs", challenge.ball_charge * 1e6);
        setInputValue("number_ball_mass_milligrams", challenge.mass * 1e6);
        setInputValue("number_sphere_radius_centimeters", challenge.sphere_radius * 100);
        setInputValue("number_launch_speed", 50);
    }

    /* setInputsLocked: only v∞ stays editable during a mission */
    function setInputsLocked(locked) {
        for (const input_id of LOCKED_INPUT_IDS) {
            document.getElementById(input_id).disabled = locked;
        }
    }

    /* newChallenge: fresh feasible probe, run reset, panel refreshed */
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
            .replace("{q}", formatValue(challenge.sphere_charge * 1e6))
            .replace("{b}", formatValue(challenge.ball_charge * 1e6))
            .replace("{m}", formatValue(challenge.mass * 1e6, 0))
            .replace("{r}", formatValue(challenge.sphere_radius * 100));
        cards.target.sub.textContent = strings.band_info[language]
            .replace("{a}", formatValue(challenge.band_low * 100))
            .replace("{b}", formatValue(challenge.band_high * 100));
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

    /* succeedAttempt: count the scan, celebrate, schedule a new mission */
    function succeedAttempt(context, transform, gap) {
        goals += 1;
        attempt_over = true;
        pending_success = true;
        spawnConfetti(transform.toScreenX((challenge.sphere_radius + gap) * 100), transform.toScreenY(0));
        if (MILESTONES.includes(goals)) {
            milestone_level = MILESTONES.indexOf(goals) + 1;
            spawnConfetti(context.canvas.width / 2, context.canvas.height / 3);
        }
        showBanner(
            strings.scanned[currentLanguage()].replace("{d}", formatValue(gap * 100)),
            "#43a047",
            2,
        );
        updatePanel();
    }

    /* drawRing: golden scan annulus above the shield */
    function drawRing(context, transform) {
        const center_x = transform.toScreenX(0);
        const center_y = transform.toScreenY(0);
        const inner = Math.abs(transform.toScreenX((challenge.sphere_radius + challenge.band_low) * 100) - center_x);
        const outer = Math.abs(transform.toScreenX((challenge.sphere_radius + challenge.band_high) * 100) - center_x);
        context.save();
        context.fillStyle = "rgba(251, 192, 45, 0.16)";
        context.beginPath();
        context.arc(center_x, center_y, outer, 0, 2 * Math.PI);
        context.arc(center_x, center_y, inner, 0, 2 * Math.PI, true);
        context.fill();
        context.strokeStyle = "#b8860b";
        context.lineWidth = 1.5;
        context.setLineDash([7, 6]);
        for (const radius of [inner, outer]) {
            context.beginPath();
            context.arc(center_x, center_y, radius, 0, 2 * Math.PI);
            context.stroke();
        }
        context.setLineDash([]);
        context.fillStyle = "#b8860b";
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(
            strings.zone_label[currentLanguage()],
            center_x + outer * 0.72,
            center_y - outer * 0.72,
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

        drawRing(context, transform);

        if (previous_state !== null && state.time > previous_state.time) {
            if (previous_state.time === 0) {
                attempts += 1;
                attempt_over = false;
                min_radius = Infinity;
                updatePanel();
            }
            if (!attempt_over) {
                min_radius = Math.min(min_radius, state.radius);
                if (state.phase === "impact") {
                    failAttempt(strings.crashed[currentLanguage()]);
                } else {
                    const turned = state.phase === "outbound" || state.radius > min_radius + 1e-9;
                    const blocked = state.phase === "blocked" && state.time >= state.total_time - 1e-12;
                    if (turned || blocked) {
                        const gap = (blocked ? state.radius : min_radius) - challenge.sphere_radius;
                        if (gap >= challenge.band_low && gap <= challenge.band_high) {
                            succeedAttempt(context, transform, gap);
                        } else if (gap > challenge.band_high) {
                            failAttempt(strings.too_slow[currentLanguage()].replace("{d}", formatValue(gap * 100)));
                        } else {
                            failAttempt(strings.too_fast[currentLanguage()].replace("{d}", formatValue(gap * 100)));
                        }
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
       approach could be probed before committing to a speed */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active) {
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.sphere_approach_game_overlay = overlay;
})();
