/*
 * game.js — EXPERIMENTAL "brightest bulb" prediction game for the
 * series-parallel exercise. A mystery circuit (9 V battery + three bulbs A, B,
 * C drawn OFF) is one of three layouts: all in series with distinct
 * resistances (brightest = largest R, P = R·I²), all in parallel with
 * distinct resistances (brightest = smallest R, P = V²/R), or one bulb in
 * series with the other two in parallel, all identical (the lone bulb carries
 * twice the current of each pair bulb, so it is 4× brighter). The student
 * predicts which bulb glows brightest, then the bulbs light up with halos
 * proportional to their power — the classic predict-observe sequence. Every
 * generated question has a unique answer with at least a 1.3× power margin
 * (pure feasibility checker used as a rejection-sampling guard with a
 * deterministic fallback). The comparison scene, formulas, graphs and
 * parameters are hidden while active (the game draws its own circuit with
 * neutral wire colors — potential coloring would give the answer away).
 * Milestone tiers as in the other exercises. Self-contained: to remove,
 * delete this file, its test file, the GAME MODE blocks in index.html, and
 * the marked "Game mode hook" lines in main.js. Integration surface: the
 * "game-mode" body class (set here) and
 * globalThis.series_parallel_game_overlay (called by main.js each frame).
 * Pure logic is exposed as globalThis.series_parallel_game for tests.
 */
(() => {
    const calc = globalThis.series_parallel_calcul;

    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const VOLTAGE = 9;
    const IDENTICAL_RESISTANCE = 10;
    const RESISTOR_CHOICES = [5, 10, 22, 47];
    const POWER_MARGIN = 1.3;
    const TOPOLOGIES = ["series", "parallel", "mixed"];

    /* bulbPowers: per-position powers of the challenge circuit */
    function bulbPowers(challenge) {
        if (challenge.topology === "series") {
            return calc.chainPowers(VOLTAGE, challenge.resistances);
        }
        if (challenge.topology === "parallel") {
            return calc.parallelPowers(VOLTAGE, challenge.resistances);
        }
        return calc.mixedPowers(VOLTAGE, challenge.resistances);
    }

    /* brightestPosition: index of the unique maximum power */
    function brightestPosition(challenge) {
        const powers = bulbPowers(challenge);
        let best = 0;
        for (let i = 1; i < powers.length; i++) {
            if (powers[i] > powers[best]) {
                best = i;
            }
        }
        return best;
    }

    /* isSituationFeasible: a unique brightest bulb exists with a clear margin */
    function isSituationFeasible(challenge) {
        if (!TOPOLOGIES.includes(challenge.topology)
            || challenge.resistances.length !== 3
            || [...challenge.labels].sort().join("") !== "ABC") {
            return false;
        }
        const powers = bulbPowers(challenge);
        if (powers.some((value) => !(value > 0) || !Number.isFinite(value))) {
            return false;
        }
        const sorted = [...powers].sort((a, b) => b - a);
        return sorted[0] >= POWER_MARGIN * sorted[1];
    }

    /* shuffled: Fisher-Yates copy driven by the injected rng */
    function shuffled(list, rng) {
        const copy = [...list];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    /* randomChallenge: one of the three layouts — distinct resistances for the
       pure series/parallel questions, identical ones for the mixed layout */
    function randomChallenge(rng = Math.random) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const topology = TOPOLOGIES[Math.floor(rng() * TOPOLOGIES.length)];
            const resistances = topology === "mixed"
                ? [IDENTICAL_RESISTANCE, IDENTICAL_RESISTANCE, IDENTICAL_RESISTANCE]
                : shuffled(RESISTOR_CHOICES, rng).slice(0, 3);
            const candidate = { topology, resistances, labels: shuffled(["A", "B", "C"], rng) };
            if (isSituationFeasible(candidate)) {
                return candidate;
            }
        }
        return {
            topology: "mixed",
            resistances: [IDENTICAL_RESISTANCE, IDENTICAL_RESISTANCE, IDENTICAL_RESISTANCE],
            labels: ["A", "B", "C"],
        };
    }

    globalThis.series_parallel_game = {
        bulbPowers,
        brightestPosition,
        isSituationFeasible,
        randomChallenge,
        MILESTONES,
        VOLTAGE,
        POWER_MARGIN,
        RESISTOR_CHOICES,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Quelle ampoule brille le plus ?", en: "Which bulb glows brightest?" },
        panel_title: { fr: "Quelle ampoule brille le plus ?", en: "Which bulb glows brightest?" },
        hint: {
            fr: "Pile de 9 V, ampoules = résistances. Prédisez la plus brillante (P = R·I² = U²/R), puis regardez-les s'allumer !",
            en: "9 V battery, bulbs = resistors. Predict the brightest one (P = R·I² = U²/R), then watch them light up!",
        },
        new_target: { fr: "Nouveau circuit", en: "New circuit" },
        answer_prompt: { fr: "Votre prédiction :", en: "Your prediction:" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Bonnes prédictions", en: "Correct predictions" },
        attempts_label: { fr: "Questions", en: "Questions" },
        success_label: { fr: "Réussite", en: "Success rate" },
        circuit_label: { fr: "Circuit", en: "Circuit" },
        circuit_series: { fr: "3 ampoules en série", en: "3 bulbs in series" },
        circuit_parallel: { fr: "3 ampoules en parallèle", en: "3 bulbs in parallel" },
        circuit_mixed: { fr: "1 ampoule en série avec 2 en parallèle", en: "1 bulb in series with 2 in parallel" },
        identical_note: { fr: "ampoules identiques (10 Ω chacune)", en: "identical bulbs (10 Ω each)" },
        correct: { fr: "CORRECT ! La plus brillante est {b}", en: "CORRECT! The brightest is {b}" },
        milestone_banner: { fr: "Palier {n} atteint !", en: "Tier {n} reached!" },
        wrong: { fr: "Raté… c'était l'ampoule {b}", en: "Missed… it was bulb {b}" },
    };
    const CONFETTI_COLORS = ["#fbc02d", "#1976d2", "#d32f2f", "#43a047", "#e8722c", "#8e24aa"];

    let game_active = false;
    let challenge = randomChallenge();
    let goals = 0;
    let attempts = 0;
    let revealed = false;
    let particles = [];
    let banner_text = null;
    let banner_seconds = 0;
    let banner_color = "#e8722c";
    let milestone_level = null;
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

    /* newChallenge: fresh prediction question, bulbs off again */
    function newChallenge() {
        challenge = randomChallenge();
        revealed = false;
        setAnswerButtonsEnabled(true);
        updatePanel();
    }

    /* setAnswerButtonsEnabled: lock the buttons while the reveal plays */
    function setAnswerButtonsEnabled(enabled) {
        for (const button of panel_elements.answer_buttons) {
            button.disabled = !enabled;
        }
    }

    /* answer: the prediction — reveal the powers and judge */
    function answer(label) {
        if (revealed) {
            return;
        }
        revealed = true;
        setAnswerButtonsEnabled(false);
        attempts += 1;
        const winning_label = challenge.labels[brightestPosition(challenge)];
        if (label === winning_label) {
            goals += 1;
            if (MILESTONES.includes(goals)) {
                milestone_level = MILESTONES.indexOf(goals) + 1;
            }
            const canvas = document.getElementById("simulation_canvas");
            spawnConfetti(canvas.width / 2, canvas.height / 2);
            showBanner(strings.correct[currentLanguage()].replace("{b}", winning_label), "#43a047", 2.2);
        } else {
            showBanner(strings.wrong[currentLanguage()].replace("{b}", winning_label), "#d32f2f", 2.2);
        }
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
        panel_elements.answer_prompt.textContent = strings.answer_prompt[language];
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

        cards.circuit.name.textContent = strings.circuit_label[language];
        cards.circuit.value.textContent = strings[`circuit_${challenge.topology}`][language];
        cards.circuit.sub.textContent = challenge.topology === "mixed"
            ? strings.identical_note[language]
            : challenge.labels.map((label, i) => `R(${label}) = ${challenge.resistances[i]} Ω`).join(" · ");
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
        if (active) {
            newChallenge();
        }
        updatePanel();
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

    /* buildUi: mode tabs + stats panel with the three answer buttons */
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
        const answer_wrap = document.createElement("div");
        answer_wrap.className = "answer-wrap";
        const answer_prompt = document.createElement("span");
        answer_prompt.className = "game-hint";
        answer_wrap.append(answer_prompt);
        const answer_buttons = [];
        for (const label of ["A", "B", "C"]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "bulb-answer primary";
            button.textContent = `💡 ${label}`;
            button.addEventListener("click", () => answer(label));
            answer_wrap.append(button);
            answer_buttons.push(button);
        }
        const new_target_button = document.createElement("button");
        new_target_button.type = "button";
        new_target_button.addEventListener("click", newChallenge);
        answer_wrap.append(new_target_button);
        head.append(title, hint, answer_wrap);

        const grid = document.createElement("div");
        grid.className = "formula-grid";
        const cards = {
            objective: createCard("game-value"),
            score: createCard("game-value game-score"),
            attempts: createCard("game-value"),
            success: createCard("game-value"),
            circuit: createCard("game-target-value game-target"),
        };
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }

        panel.append(head, grid);
        document.querySelector(".layout").after(panel);

        panel_elements = {
            panel, title, hint, new_target_button, answer_prompt,
            answer_buttons, tab_simulation, tab_game, cards,
        };
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

    /* drawBulb: bulb symbol at screen (x, y); when revealed, a halo ∝ power */
    function drawBulb(context, x, y, label, resistance, power, max_power, ink) {
        const radius = 20;
        if (revealed && power > 0) {
            const halo = 14 + 42 * Math.sqrt(power / max_power);
            const gradient = context.createRadialGradient(x, y, radius * 0.3, x, y, radius + halo);
            gradient.addColorStop(0, "rgba(255, 214, 64, 0.95)");
            gradient.addColorStop(1, "rgba(255, 214, 64, 0)");
            context.save();
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(x, y, radius + halo, 0, 2 * Math.PI);
            context.fill();
            context.restore();
        }
        context.save();
        context.fillStyle = revealed ? "rgba(255, 230, 140, 0.9)" : "rgba(120, 130, 145, 0.15)";
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        const cross = radius * 0.7071;
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(x - cross, y - cross);
        context.lineTo(x + cross, y + cross);
        context.moveTo(x - cross, y + cross);
        context.lineTo(x + cross, y - cross);
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 15px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(label, x, y - radius - 6);
        context.font = "11px system-ui, sans-serif";
        context.textBaseline = "top";
        context.fillText(`${resistance} Ω`, x, y + radius + 6);
        if (revealed) {
            context.fillStyle = "#b8860b";
            context.fillText(`${formatValue(power)} W`, x, y + radius + 21);
        }
        context.restore();
    }

    /* drawGameBattery: vertical battery symbol on the left wire */
    function drawGameBattery(context, x, y, ink) {
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x - 16, y - 7);
        context.lineTo(x + 16, y - 7);
        context.stroke();
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x - 8, y + 7);
        context.lineTo(x + 8, y + 7);
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText("+", x - 20, y - 7);
        context.fillText("−", x - 12, y + 7);
        context.textAlign = "left";
        context.fillText(`${VOLTAGE} V`, x + 20, y);
        context.restore();
    }

    /* drawWirePath: neutral-colored polyline in screen coordinates */
    function drawWirePath(context, points, ink) {
        context.save();
        context.strokeStyle = ink;
        context.lineWidth = 2.5;
        context.lineJoin = "round";
        context.beginPath();
        points.forEach(([x, y], index) => {
            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });
        context.stroke();
        context.restore();
    }

    /* drawChallengeCircuit: the mystery circuit centered on the canvas */
    function drawChallengeCircuit(context, ink) {
        const cx = context.canvas.width / 2;
        const cy = context.canvas.height / 2 + 16;
        const powers = bulbPowers(challenge);
        const max_power = Math.max(...powers);
        const left = cx - 320;
        const right = cx + 320;
        const top = cy - 110;
        const bottom = cy + 110;

        if (challenge.topology === "series") {
            drawWirePath(context, [[left, cy - 7], [left, top], [right, top], [right, bottom], [left, bottom], [left, cy + 7]], ink);
            const xs = [cx - 180, cx, cx + 180];
            xs.forEach((x, i) => drawBulb(context, x, top, challenge.labels[i], challenge.resistances[i], powers[i], max_power, ink));
        } else if (challenge.topology === "parallel") {
            drawWirePath(context, [[left, cy - 7], [left, top], [right, top]], ink);
            drawWirePath(context, [[right, bottom], [left, bottom], [left, cy + 7]], ink);
            const xs = [cx - 100, cx + 100, cx + 300];
            xs.forEach((x, i) => {
                drawWirePath(context, [[x, top], [x, bottom]], ink);
                drawBulb(context, x, cy, challenge.labels[i], challenge.resistances[i], powers[i], max_power, ink);
            });
        } else {
            const split_x = cx + 40;
            const join_x = cx + 300;
            drawWirePath(context, [[left, cy - 7], [left, top], [split_x, top]], ink);
            drawWirePath(context, [[split_x, top], [join_x, top]], ink);
            drawWirePath(context, [[split_x, top], [split_x, cy + 30], [join_x, cy + 30], [join_x, top]], ink);
            drawWirePath(context, [[join_x, top], [right, top], [right, bottom], [left, bottom], [left, cy + 7]], ink);
            drawBulb(context, cx - 150, top, challenge.labels[0], challenge.resistances[0], powers[0], max_power, ink);
            drawBulb(context, (split_x + join_x) / 2, top, challenge.labels[1], challenge.resistances[1], powers[1], max_power, ink);
            drawBulb(context, (split_x + join_x) / 2, cy + 30, challenge.labels[2], challenge.resistances[2], powers[2], max_power, ink);
        }
        drawGameBattery(context, left, cy, ink);
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
            context.font = "bold 34px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(banner_text, context.canvas.width / 2, 24);
            if (milestone_level !== null) {
                context.fillStyle = "#1976d2";
                context.font = "bold 26px system-ui, sans-serif";
                context.fillText(
                    strings.milestone_banner[currentLanguage()].replace("{n}", milestone_level),
                    context.canvas.width / 2,
                    66,
                );
            }
            context.restore();
            if (banner_seconds <= 0) {
                milestone_level = null;
                newChallenge();
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

        drawChallengeCircuit(
            context,
            matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026",
        );
        drawEffects(context, delta_seconds);
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    buildUi();
    updatePanel();
    globalThis.series_parallel_game_overlay = overlay;
})();
