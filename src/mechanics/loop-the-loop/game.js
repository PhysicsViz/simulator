/*
 * game.js — EXPERIMENTAL "water bucket" game mode for the loop-the-loop
 * exercise. The teacher swings a bucket of water in a vertical circle around
 * their right shoulder: radius R = arm (0.6 m, rotating with the rope) + rope.
 * After a scripted back-and-forth wind-up driven by the arm, the bucket passes
 * the horizontal position (moving up) with speed v₀, and then
 * only its weight and the tension act: θ'' = −(g/R) sin(θ) (θ from the lowest
 * point, RK4), v² = v₀² + 2 g R cos(θ) and T = m (v₀²/R + 3 g cos(θ)), the same
 * N = m (v²/r + g cos(φ)) as the loop exercise. The water, held only by the
 * bottom of the open bucket, stays in iff T ≥ 0 (top: v₀ ≥ √(3 g R)); the rope
 * snaps iff T > T_max (on the way down: v₀ ≤ √((T_max/m − 3 g) R)). When the
 * water leaves, the teacher keeps the bucket on its circle and the water follows
 * its exact free-fall parabola out of the opening — the slower the bucket, the
 * earlier and closer to the centre it falls, onto the teacher. When the rope
 * snaps, the bucket leaves along the tangent spinning at its own ω, hits the
 * ground and makes an unlucky bounce whose parabola ends on the teacher's head.
 * Between attempts the teacher dries off. Each challenge draws the ONE free
 * variable — v₀, R (arm + rope) or m (fill the bucket: at least 90 % of the
 * largest mass the rope holds) — a place (Europa, Moon, Mars, Venus, Earth: g
 * from 1.31 to 9.81 m/s²) and the other quantities, with narrow windows; the
 * value used on the previous attempt never wins the next challenge with the
 * same variable (anti-repeat).
 * Every challenge is provably solvable: the pure checker isChallengeFeasible
 * requires a v₀ window ≥ 0.1 m/s and ≥ 3 % inside the input (rejection
 * sampling, deterministic fallbacks, Monte-Carlo tests). Milestone tiers as
 * elsewhere.
 * Self-contained: to remove, delete this file, its test file, the GAME MODE
 * blocks in index.html, and the lines marked "Game mode hook" in main.js.
 * Integration surface: the "game-mode" body class (set here),
 * globalThis.loop_game_overlay (called by main.js each frame; repaints the whole
 * scene, main.js only provides the clock) and globalThis.loop_game_view_extent
 * (read by main.js fitView). Pure logic is exposed as globalThis.loop_game.
 */
(() => {
    const MILESTONES = [1, 5, 10, 20, 40, 70, 100];
    const GRAVITY = 9.81;
    const PLACES = [
        { key: "europa", gravity: 1.31 },
        { key: "moon", gravity: 1.62 },
        { key: "mars", gravity: 3.71 },
        { key: "venus", gravity: 8.87 },
        { key: "earth", gravity: 9.81 },
    ];
    const VARIABLES = {
        launch_speed: { weight: 4.33, min: 0, max: 15, step: 0.01, default_value: 3, minimum_width: 0.1, repeat_margin: 0.05 },
        radius: { weight: 3.33, min: 0.65, max: 1.3, step: 0.01, default_value: 1, minimum_width: 0.03, repeat_margin: 0.01 },
        mass: { weight: 2.33, min: 0.2, max: 5, step: 0.01, default_value: 1, minimum_width: 0.05, repeat_margin: 0.02 },
    };
    const VARIABLE_KEYS = Object.keys(VARIABLES);
    const MASS_FILL_RATIO = 0.9;
    const FALLBACK_CHALLENGES = [
        { variable: "launch_speed", place: "earth", gravity: 9.81, launch_speed: null, radius: 1.1, mass: 2, tension_max: 147 },
        { variable: "launch_speed", place: "moon", gravity: 1.62, launch_speed: null, radius: 1, mass: 2, tension_max: 23 },
    ];
    const ARM_LENGTH = 0.6;
    const SHOULDER_HEIGHT = 1.4;
    const MINIMUM_RELATIVE_WINDOW = 0.03;
    const SWING_RATE = 240;
    const SWING_SUBSTEPS = 8;
    const SWING_DURATION = 20;
    const WINDUP_BACK_ANGLE = -70 * Math.PI / 180;
    const WINDUP_MAX_SECONDS = 1.4;
    const WINDUP_BACK_SHARE = 0.4;

    /* tensionPerMass: T/m = v²/R + g cos(θ) = v₀²/R + 3 g cos(θ), θ from the lowest
       point, v₀ the speed at the horizontal position (θ = π/2) */
    function tensionPerMass(radius, launch_speed, theta, gravity = GRAVITY) {
        return launch_speed * launch_speed / radius + 3 * gravity * Math.cos(theta);
    }

    /* resolveParameters: v₀, R and m of a challenge with the free variable set to value */
    function resolveParameters(challenge, value) {
        return {
            launch_speed: challenge.variable === "launch_speed" ? value : challenge.launch_speed,
            radius: challenge.variable === "radius" ? value : challenge.radius,
            mass: challenge.variable === "mass" ? value : challenge.mass,
        };
    }

    /* winningWindow: values of the free variable that win, from 0 ≤ T ≤ T_max with
       T = m (v₀²/R + 3 g cos(θ)):
       v₀: √(3 g R) ≤ v₀ ≤ √((T_max/m − 3 g) R)
       R:  v₀²/(T_max/m − 3 g) ≤ R ≤ v₀²/(3 g)  (too long: water; too short: rope)
       m:  0.9 m_max ≤ m ≤ m_max = T_max/(v₀²/R + 3 g)  (fill the bucket; requires
           v₀² ≥ 3 g R, otherwise no mass keeps the water in) */
    function winningWindow(challenge) {
        const gravity = challenge.gravity;
        const empty = { minimum: Infinity, maximum: -Infinity };
        if (challenge.variable === "launch_speed") {
            const limit = challenge.tension_max / challenge.mass;
            return {
                minimum: Math.sqrt(3 * gravity * challenge.radius),
                maximum: Math.sqrt(Math.max(limit - 3 * gravity, 0) * challenge.radius),
            };
        }
        const speed_squared = challenge.launch_speed * challenge.launch_speed;
        if (challenge.variable === "radius") {
            const limit = challenge.tension_max / challenge.mass;
            if (limit <= 3 * gravity) {
                return empty;
            }
            return { minimum: speed_squared / (limit - 3 * gravity), maximum: speed_squared / (3 * gravity) };
        }
        if (speed_squared < 3 * gravity * challenge.radius) {
            return empty;
        }
        const mass_max = challenge.tension_max / (speed_squared / challenge.radius + 3 * gravity);
        return { minimum: MASS_FILL_RATIO * mass_max, maximum: mass_max };
    }

    /* isChallengeFeasible: the winning window lies inside the variable's input range
       and is wide enough (absolute minimum per variable, and ≥ 3 %) */
    function isChallengeFeasible(challenge) {
        const window = winningWindow(challenge);
        const spec = VARIABLES[challenge.variable];
        const width = window.maximum - window.minimum;
        return window.minimum >= spec.min
            && window.maximum <= spec.max
            && width >= spec.minimum_width
            && width >= MINIMUM_RELATIVE_WINDOW * window.minimum;
    }

    /* winsWith: value lies in the challenge window, with the variable's margin */
    function winsWith(challenge, value) {
        const window = winningWindow(challenge);
        const margin = VARIABLES[challenge.variable].repeat_margin;
        return value >= window.minimum - margin && value <= window.maximum + margin;
    }

    /* drawVariable: free variable drawn with the weights 4.33 (v₀) : 3.33 (R) : 2.33 (m) */
    function drawVariable(rng) {
        const total = VARIABLE_KEYS.reduce((sum, key) => sum + VARIABLES[key].weight, 0);
        let remaining = rng() * total;
        for (const key of VARIABLE_KEYS) {
            remaining -= VARIABLES[key].weight;
            if (remaining < 0) {
                return key;
            }
        }
        return VARIABLE_KEYS[VARIABLE_KEYS.length - 1];
    }

    /* drawCandidate: one candidate challenge for a given free variable, built around
       a reference solution */
    function drawCandidate(rng, variable) {
        const place = PLACES[Math.min(Math.floor(rng() * PLACES.length), PLACES.length - 1)];
        const gravity = place.gravity;
        const candidate = { variable, place: place.key, gravity, launch_speed: null, radius: null, mass: null, tension_max: 0 };
        if (variable === "launch_speed") {
            candidate.radius = Math.round((0.7 + rng() * 0.6) * 10) / 10;
            candidate.mass = Math.round((1 + rng() * 2) * 10) / 10;
            candidate.tension_max = Math.round(6 * candidate.mass * gravity * (1.06 + rng() * 0.29));
        } else if (variable === "radius") {
            const radius_max = 0.8 + rng() * 0.5;
            const ratio = 1.08 + rng() * 0.32;
            candidate.launch_speed = Math.round(Math.sqrt(3 * gravity * radius_max) * 100) / 100;
            candidate.mass = Math.round((1 + rng() * 2) * 10) / 10;
            candidate.tension_max = Math.round(candidate.mass * 3 * gravity * (1 + ratio));
        } else {
            candidate.radius = Math.round((0.7 + rng() * 0.6) * 10) / 10;
            candidate.launch_speed = Math.round(Math.sqrt(3 * gravity * candidate.radius * (1.1 + rng() * 0.7)) * 100) / 100;
            const mass_max = 1 + rng() * 3.5;
            candidate.tension_max = Math.round(mass_max * (candidate.launch_speed ** 2 / candidate.radius + 3 * gravity));
        }
        return candidate;
    }

    /* randomChallenge: weighted free variable (v₀, R or m) drawn first — rejection
       sampling then stays within that variable, so the weights are the final
       frequencies — then a place and the other quantities; a candidate is rejected
       if infeasible or if excluded = { variable, value } (the last attempt) would
       still win; deterministic fallbacks. rng injectable */
    function randomChallenge(rng = Math.random, excluded = null) {
        const acceptable = (candidate) => isChallengeFeasible(candidate)
            && (excluded === null || excluded.variable !== candidate.variable || !winsWith(candidate, excluded.value));
        const variable = drawVariable(rng);
        for (let attempt = 0; attempt < 60; attempt++) {
            const candidate = drawCandidate(rng, variable);
            if (acceptable(candidate)) {
                return candidate;
            }
        }
        return { ...FALLBACK_CHALLENGES.find(acceptable) };
    }

    /* evaluateSwing: first event after the launch for the free variable set to value,
       from the closed form of T(θ): "too_slow" (v₀ = 0), "rope_broke" (T > T_max, at
       once or on the way down), "water_fell" (T < 0 before the top), "underfilled"
       (mass challenge below 90 % of the limit) or "success" (bottom reached) */
    function evaluateSwing(challenge, value) {
        const { launch_speed, radius, mass } = resolveParameters(challenge, value);
        const gravity = challenge.gravity;
        const limit = challenge.tension_max / mass;
        const centripetal = launch_speed * launch_speed / radius;
        if (launch_speed <= 1e-9) {
            return { outcome: "too_slow", theta: Math.PI / 2 };
        }
        if (centripetal > limit) {
            return { outcome: "rope_broke", theta: Math.PI / 2 };
        }
        if (centripetal < 3 * gravity) {
            return { outcome: "water_fell", theta: Math.acos(-centripetal / (3 * gravity)) };
        }
        if (centripetal + 3 * gravity > limit) {
            return { outcome: "rope_broke", theta: 2 * Math.PI - Math.acos((limit - centripetal) / (3 * gravity)) };
        }
        if (challenge.variable === "mass" && mass < winningWindow(challenge).minimum) {
            return { outcome: "underfilled", theta: 2 * Math.PI };
        }
        return { outcome: "success", theta: 2 * Math.PI };
    }

    /* simulateSwing: RK4 of θ'' = −(g/R) sin(θ) from θ = π/2, ω = v₀/R (the bucket
       kept on its circle), sampled at SWING_RATE */
    function simulateSwing(radius, launch_speed, gravity = GRAVITY) {
        const dt = 1 / (SWING_RATE * SWING_SUBSTEPS);
        const acceleration = (theta) => -(gravity / radius) * Math.sin(theta);
        let theta = Math.PI / 2;
        let omega = launch_speed / radius;
        const samples = [{ time: 0, theta, omega }];
        for (let i = 1; i <= SWING_DURATION * SWING_RATE; i++) {
            for (let k = 0; k < SWING_SUBSTEPS; k++) {
                const k1_theta = omega;
                const k1_omega = acceleration(theta);
                const k2_theta = omega + k1_omega * dt / 2;
                const k2_omega = acceleration(theta + k1_theta * dt / 2);
                const k3_theta = omega + k2_omega * dt / 2;
                const k3_omega = acceleration(theta + k2_theta * dt / 2);
                const k4_theta = omega + k3_omega * dt;
                const k4_omega = acceleration(theta + k3_theta * dt);
                theta += dt / 6 * (k1_theta + 2 * k2_theta + 2 * k3_theta + k4_theta);
                omega += dt / 6 * (k1_omega + 2 * k2_omega + 2 * k3_omega + k4_omega);
            }
            samples.push({ time: i / SWING_RATE, theta, omega });
        }
        return { radius, launch_speed, gravity, samples };
    }

    /* swingAt: θ and ω at time t after the launch (linear interpolation) */
    function swingAt(swing, time) {
        const samples = swing.samples;
        const position = Math.min(Math.max(time * SWING_RATE, 0), samples.length - 1);
        const index = Math.min(Math.floor(position), samples.length - 2);
        const fraction = position - index;
        return {
            theta: samples[index].theta + (samples[index + 1].theta - samples[index].theta) * fraction,
            omega: samples[index].omega + (samples[index + 1].omega - samples[index].omega) * fraction,
        };
    }

    /* swingTimeAtAngle: first time θ reaches a given angle (θ increases until then) */
    function swingTimeAtAngle(swing, theta) {
        const samples = swing.samples;
        for (let i = 1; i < samples.length; i++) {
            if (samples[i].theta >= theta) {
                const ratio = (theta - samples[i - 1].theta) / (samples[i].theta - samples[i - 1].theta);
                return samples[i - 1].time + ratio * (samples[i].time - samples[i - 1].time);
            }
        }
        return samples[samples.length - 1].time;
    }

    /* windupDuration: length of the arm-driven wind-up, short enough for the
       forward Hermite stroke to stay monotone (end slope ≤ 3 × angle covered) */
    function windupDuration(radius, launch_speed) {
        if (launch_speed <= 1e-9) {
            return WINDUP_MAX_SECONDS;
        }
        const span = Math.PI / 2 - WINDUP_BACK_ANGLE;
        const monotone_limit = 3 * span / ((1 - WINDUP_BACK_SHARE) * launch_speed / radius);
        return Math.min(WINDUP_MAX_SECONDS, 0.9 * monotone_limit);
    }

    /* windupAt: scripted wind-up, θ from hanging (0, at rest) back to −70°, then a
       Hermite stroke forward to π/2 arriving with ω = v₀/R */
    function windupAt(radius, launch_speed, time) {
        const duration = windupDuration(radius, launch_speed);
        const back_duration = WINDUP_BACK_SHARE * duration;
        if (time <= back_duration) {
            const u = Math.max(time, 0) / back_duration;
            return {
                theta: WINDUP_BACK_ANGLE * (1 - Math.cos(Math.PI * u)) / 2,
                omega: WINDUP_BACK_ANGLE * Math.PI * Math.sin(Math.PI * u) / (2 * back_duration),
            };
        }
        const forward_duration = duration - back_duration;
        const s = Math.min((time - back_duration) / forward_duration, 1);
        const end_slope = (launch_speed / radius) * forward_duration;
        const theta = (2 * s ** 3 - 3 * s * s + 1) * WINDUP_BACK_ANGLE
            + (-2 * s ** 3 + 3 * s * s) * (Math.PI / 2)
            + (s ** 3 - s * s) * end_slope;
        const slope = (6 * s * s - 6 * s) * WINDUP_BACK_ANGLE
            + (-6 * s * s + 6 * s) * (Math.PI / 2)
            + (3 * s * s - 2 * s) * end_slope;
        return { theta, omega: slope / forward_duration };
    }

    /* bounceToward: unlucky bounce — vertical speed after impact at least
       restitution × |vy| and enough to rise above the target, horizontal speed
       chosen so that the descending parabola ends exactly on the target */
    function bounceToward(contact_x, contact_y, impact_vy, target_x, target_y, gravity = GRAVITY, restitution = 0.55) {
        const rise = target_y - contact_y;
        const vertical = Math.max(restitution * Math.abs(impact_vy), 1.12 * Math.sqrt(2 * gravity * Math.max(rise, 0)));
        const flight_time = (vertical + Math.sqrt(vertical * vertical - 2 * gravity * rise)) / gravity;
        return { velocity_x: (target_x - contact_x) / flight_time, velocity_y: vertical, flight_time };
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

    globalThis.loop_game = {
        MILESTONES,
        GRAVITY,
        PLACES,
        FALLBACK_CHALLENGES,
        ARM_LENGTH,
        VARIABLES,
        MASS_FILL_RATIO,
        resolveParameters,
        winningWindow,
        tensionPerMass,
        isChallengeFeasible,
        randomChallenge,
        drawVariable,
        winsWith,
        evaluateSwing,
        simulateSwing,
        swingAt,
        swingTimeAtAngle,
        windupDuration,
        windupAt,
        bounceToward,
        nextMilestone,
    };

    if (typeof document === "undefined") {
        return;
    }

    const strings = {
        tab_simulation: { fr: "Simulation", en: "Simulation" },
        tab_game: { fr: "Le seau d'eau", en: "The water bucket" },
        panel_title: { fr: "Ne mouille pas le prof !", en: "Don't soak the teacher!" },
        hint: {
            fr: "Le prof fait tourner un seau d'eau (bras + corde = R). Après un aller-retour d'élan, le seau passe la position horizontale vers le haut avec la vitesse v₀, puis seuls le poids et la tension agissent. L'eau, retenue seulement par le fond, reste dedans tant que T ≥ 0 ; la corde casse si T > T_max. À chaque défi, une seule grandeur est à régler.",
            en: "The teacher swings a bucket of water (arm + rope = R). After a back-and-forth wind-up, the bucket passes the horizontal position upward with speed v₀, then only the weight and the tension act. The water, held only by the bottom, stays in as long as T ≥ 0; the rope snaps if T > T_max. Each challenge has one single quantity to set.",
        },
        input_launch_speed: { fr: "Vitesse v₀ (bras horizontal)", en: "Speed v₀ (arm horizontal)" },
        input_radius: { fr: "Longueur bras + corde R", en: "Arm + rope length R" },
        input_mass: { fr: "Masse du seau rempli m", en: "Mass of the filled bucket m" },
        variable_label: { fr: "À régler", en: "To set" },
        variable_launch_speed: { fr: "la vitesse v₀", en: "the speed v₀" },
        variable_radius: { fr: "la longueur R", en: "the length R" },
        variable_mass: { fr: "la masse m", en: "the mass m" },
        variable_mass_goal: { fr: "remplis le seau : au moins 90 % de la masse que la corde supporte", en: "fill the bucket: at least 90 % of the mass the rope holds" },
        new_target: { fr: "Nouveau défi", en: "New challenge" },
        objective_label: { fr: "Objectif", en: "Goal" },
        tier_label: { fr: "Palier", en: "Tier" },
        max_tier: { fr: "Palier maximum atteint !", en: "Max tier reached!" },
        score_label: { fr: "Profs restés secs", en: "Teachers kept dry" },
        attempts_label: { fr: "Tentatives", en: "Attempts" },
        success_label: { fr: "Réussite", en: "Success rate" },
        load_label: { fr: "Tension dans la corde", en: "Rope tension" },
        target_label: { fr: "Défi", en: "Challenge" },
        target_info: {
            fr: "{place} (g = {g} m/s²) · v₀ = {v} · R = {r} · m = {m} · la corde casse si T > {t} N",
            en: "{place} (g = {g} m/s²) · v₀ = {v} · R = {r} · m = {m} · the rope snaps if T > {t} N",
        },
        place_europa: { fr: "Europe (lune de Jupiter)", en: "Europa (moon of Jupiter)" },
        place_moon: { fr: "Lune", en: "Moon" },
        place_mars: { fr: "Mars", en: "Mars" },
        place_venus: { fr: "Vénus", en: "Venus" },
        place_earth: { fr: "Terre", en: "Earth" },
        windup: { fr: "élan…", en: "wind-up…" },
        success_title: { fr: "LE PROF EST SEC !", en: "THE TEACHER IS DRY!" },
        success_sub: { fr: "T est resté entre 0 et T_max sur tout le tour", en: "T stayed between 0 and T_max all the way round" },
        milestone_banner: { fr: "PALIER {n} ATTEINT !", en: "TIER {n} REACHED!" },
        water_title: { fr: "PLOUF !", en: "SPLASH!" },
        water_sub: { fr: "T < 0 : le fond ne retient plus l'eau — {cause}", en: "T < 0: the bottom no longer holds the water — {cause}" },
        broke_title: { fr: "CRAC !", en: "CRACK!" },
        broke_sub: { fr: "T > T_max : la corde casse ({cause})… et le rebond est mal tombé", en: "T > T_max: the rope snaps ({cause})… and the bounce is unlucky" },
        cause_water_launch_speed: { fr: "v₀ trop petit", en: "v₀ too low" },
        cause_water_radius: { fr: "R trop long", en: "R too long" },
        cause_water_mass: { fr: "v₀ trop petit", en: "v₀ too low" },
        cause_rope_launch_speed: { fr: "v₀ trop grand", en: "v₀ too high" },
        cause_rope_radius: { fr: "R trop court", en: "R too short" },
        cause_rope_mass: { fr: "m trop grande", en: "m too large" },
        underfilled_title: { fr: "PAS ASSEZ D'EAU…", en: "NOT ENOUGH WATER…" },
        underfilled_sub: { fr: "La corde a tenu, mais il fallait au moins 90 % de la masse maximale", en: "The rope held, but at least 90 % of the maximum mass was required" },
        slow_title: { fr: "PAS D'ÉLAN…", en: "NO SPEED…" },
        slow_sub: { fr: "v₀ = 0 : le seau retombe simplement", en: "v₀ = 0: the bucket just falls back" },
        rope_label: { fr: "T_max = {t} N", en: "T_max = {t} N" },
        fbd_title: { fr: "Bilan des forces", en: "Free-body diagram" },
    };

    const CONFETTI_COLORS = ["#e53935", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#fb8c00", "#00acc1"];
    const WEIGHT_COLOR = "#d32f2f";
    const TENSION_COLOR = "#8e24aa";
    const HOODIE = "#f08a24";
    const HOODIE_SHADE = "#c9661a";
    const HOODIE_LINE = "#9c4c10";
    const SKIN_LINE = "#c99572";
    const SKIN = "#f1c7a3";
    const HAIR = "#a8916f";
    const HAIR_LIGHT = "#cbb592";
    const JEANS = "#8a9bb3";
    const BUCKET_WIDTH = 0.26;
    const PLACE_STYLES = {
        europa: { icon: "🧊", ground: "176, 210, 230" },
        moon: { icon: "🌙", ground: "158, 158, 158" },
        mars: { icon: "🔴", ground: "193, 102, 59" },
        venus: { icon: "🟡", ground: "214, 176, 90" },
        earth: { icon: "🌍", ground: "120, 130, 145" },
    };
    const SLOW_MOTION = 0.7;
    const WATER_EMISSION_SECONDS = 0.3;
    const FAIL_SEQUENCE_SECONDS = 3.2;
    const SUCCESS_SEQUENCE_SECONDS = 3.4;
    const DRYING_SECONDS = 2;
    const HAT_FADE_SECONDS = 0.45;

    let game_active = false;
    let challenge = randomChallenge();
    let game_value = VARIABLES[challenge.variable].default_value;
    let swing = null;
    let goals = 0;
    let attempts = 0;
    let panel_elements = null;
    let game_row = null;
    let previous_time = 0;
    let run = null;
    let teacher_pose = "idle";
    let teacher_wetness = 0;
    let bucket_water = 1;
    let bucket_on_rope = true;
    let hat = null;
    let drying = 0;
    let flyer = null;
    let sequence = null;
    let water_drops = [];
    let particles = [];
    let rockets = [];
    let banner = null;
    let flash = null;
    let clock = 0;
    let last_overlay_milliseconds = null;

    /* currentLanguage: follow the language set by main.js on the <html> element */
    function currentLanguage() {
        return document.documentElement.lang === "en" ? "en" : "fr";
    }

    /* formatValue: number with a fixed number of decimals matching the page locale */
    function formatValue(value, decimals = 1) {
        const formatted = value.toFixed(decimals);
        return currentLanguage() === "fr" ? formatted.replace(".", ",") : formatted;
    }

    /* text: translated string with {placeholders} filled */
    function text(key, values = {}) {
        let result = strings[key][currentLanguage()];
        for (const [name, value] of Object.entries(values)) {
            result = result.replace(`{${name}}`, value);
        }
        return result;
    }

    /* isDark: current color scheme */
    function isDark() {
        return matchMedia("(prefers-color-scheme: dark)").matches;
    }

    /* randomBetween: uniform draw in [low, high) */
    function randomBetween(low, high) {
        return low + Math.random() * (high - low);
    }

    /* params: v₀, R and m with the free variable set to the input value */
    function params() {
        return resolveParameters(challenge, game_value);
    }

    /* currentSwing: RK4 swing for the current parameters, cached */
    function currentSwing() {
        const { launch_speed, radius } = params();
        if (swing === null || swing.radius !== radius || swing.launch_speed !== launch_speed || swing.gravity !== challenge.gravity) {
            swing = simulateSwing(radius, launch_speed, challenge.gravity);
        }
        return swing;
    }

    /* setInput: write a value into a main.js parameter (number field, input event) */
    function setInput(key, value) {
        const number = document.getElementById(`number_${key}`);
        number.value = String(value);
        number.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /* mirrorParameters: show the current R and m in main.js's (locked) inputs */
    function mirrorParameters() {
        const { radius, mass } = params();
        for (const [key, value] of [["loop_radius", radius], ["mass", mass]]) {
            const number = document.getElementById(`number_${key}`);
            const disabled = number.disabled;
            number.disabled = false;
            setInput(key, Number(value.toFixed(2)));
            number.disabled = disabled;
        }
    }

    /* configureGameRow: range, step, unit and value of the free-variable input */
    function configureGameRow() {
        const spec = VARIABLES[challenge.variable];
        for (const input of game_row.querySelectorAll("input")) {
            input.min = spec.min;
            input.max = spec.max;
            input.step = spec.step;
            input.value = game_value;
        }
        game_row.querySelector(".unit").textContent = { launch_speed: "m/s", radius: "m", mass: "kg" }[challenge.variable];
    }

    /* lockChallengeInputs: impose the circle, R, m and g; main.js keeps h = 0 so it
       runs as a plain 20 s clock; v₀ replaces h (everything restored on exit) */
    function lockChallengeInputs() {
        const locked = [
            ...["loop_radius", "mass", "gravity"].flatMap((key) => [`slider_${key}`, `number_${key}`]),
            "shape_circle",
            "shape_clothoid",
        ].map((id) => document.getElementById(id));
        for (const element of locked) {
            element.disabled = false;
        }
        if (game_active) {
            document.getElementById("shape_circle").click();
            mirrorParameters();
            setInput("gravity", challenge.gravity.toFixed(2));
            setInput("start_height", "0");
            configureGameRow();
        }
        for (const element of locked) {
            element.disabled = game_active;
        }
        document.getElementById("slider_start_height").closest(".parameter-row").style.display = game_active ? "none" : "";
        game_row.style.display = game_active ? "" : "none";
    }

    /* resetRun: forget the current attempt, put the bucket back, start drying */
    function resetRun() {
        run = null;
        sequence = null;
        flyer = null;
        water_drops = [];
        bucket_water = 1;
        bucket_on_rope = true;
        teacher_pose = "idle";
        previous_time = 0;
        if (hat !== null) {
            hat.fading = 0;
        }
        if (teacher_wetness > 0) {
            drying = DRYING_SECONDS;
        }
        document.getElementById("reset_button").click();
    }

    /* newChallenge: fresh feasible challenge, inputs imposed, view refitted */
    function newChallenge() {
        const previous_variable = challenge.variable;
        challenge = randomChallenge(Math.random, { variable: previous_variable, value: game_value });
        if (challenge.variable !== previous_variable) {
            game_value = VARIABLES[challenge.variable].default_value;
        }
        lockChallengeInputs();
        resetRun();
        updatePanel();
        document.getElementById("zoom_fit_button").click();
    }

    /* updatePanel: refresh tabs, header, v₀ row and every stat card */
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
        game_row.querySelector("label").textContent = text(`input_${challenge.variable}`);
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
        cards.load.name.textContent = strings.load_label[language];
        cards.variable.name.textContent = strings.variable_label[language];
        cards.variable.value.textContent = text(`variable_${challenge.variable}`);
        cards.variable.sub.textContent = challenge.variable === "mass" ? text("variable_mass_goal") : "";
        cards.target.name.textContent = strings.target_label[language];
        const known = (key, value, decimals, unit) => (challenge.variable === key ? "?" : `${formatValue(value, decimals)} ${unit}`);
        cards.target.value.textContent = text("target_info", {
            place: text(`place_${challenge.place}`),
            g: formatValue(challenge.gravity, 2),
            v: known("launch_speed", challenge.launch_speed, 2, "m/s"),
            r: known("radius", challenge.radius, 1, "m"),
            m: known("mass", challenge.mass, 1, "kg"),
            t: String(challenge.tension_max),
        });
    }

    /* setActive: toggle game mode; every entry starts a clean, dry attempt */
    function setActive(active) {
        game_active = active;
        document.body.classList.toggle("game-mode", active);
        panel_elements.panel.style.display = active ? "" : "none";
        panel_elements.tab_simulation.classList.toggle("active", !active);
        panel_elements.tab_game.classList.toggle("active", active);
        particles = [];
        rockets = [];
        banner = null;
        flash = null;
        hat = null;
        teacher_wetness = 0;
        drying = 0;
        lockChallengeInputs();
        resetRun();
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

    /* buildGameRow: slider + number pair for the free variable, same markup as main.js rows */
    function buildGameRow() {
        const row = document.createElement("div");
        row.className = "parameter-row";
        row.style.display = "none";
        const label = document.createElement("label");
        label.htmlFor = "slider_game_value";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.id = "slider_game_value";
        const number = document.createElement("input");
        number.type = "number";
        number.id = "number_game_value";
        const unit = document.createElement("span");
        unit.className = "unit";
        const value_wrap = document.createElement("div");
        value_wrap.className = "value-wrap";
        value_wrap.append(number, unit);
        row.append(label, slider, value_wrap);

        const onInput = (source, mirror) => {
            const spec = VARIABLES[challenge.variable];
            const value = Number(source.value);
            if (source.value === "" || !Number.isFinite(value) || value < spec.min || value > spec.max) {
                return;
            }
            mirror.value = source.value;
            game_value = value;
            if (challenge.variable !== "launch_speed") {
                mirrorParameters();
            }
        };
        slider.addEventListener("input", () => onInput(slider, number));
        number.addEventListener("input", () => onInput(number, slider));
        document.getElementById("parameter_rows").append(row);
        return row;
    }

    /* buildUi: mode tabs, v₀ row, and the full-width stats panel below the scene */
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
        game_row = buildGameRow();

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
            load: createCard("game-value game-load"),
            variable: createCard("game-value game-variable"),
            target: createCard("game-target-value game-target"),
        };
        const gauge = document.createElement("div");
        gauge.className = "game-gauge";
        const gauge_fill = document.createElement("span");
        gauge.append(gauge_fill);
        cards.load.card.append(gauge);
        for (const card of Object.values(cards)) {
            grid.append(card.card);
        }
        panel.append(head, grid);
        document.querySelector(".layout").after(panel);
        panel_elements = { panel, title, hint, new_target_button, tab_simulation, tab_game, cards, gauge_fill };
    }

    /* easeOutBack: overshooting ease for the banner pop */
    function easeOutBack(progress) {
        const overshoot = 1.70158;
        const shifted = progress - 1;
        return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
    }

    /* shakeCanvas: restart the CSS shake animation of the scene canvas */
    function shakeCanvas() {
        const canvas = document.getElementById("simulation_canvas");
        canvas.classList.remove("game-shake");
        void canvas.offsetWidth;
        canvas.classList.add("game-shake");
    }

    /* layout: world geometry (m) — right shoulder = pivot (0, R), ground R − 1.4 m */
    function layout() {
        const radius = params().radius;
        const ground_y = radius - SHOULDER_HEIGHT;
        const bounce = teacher_pose === "cheer" ? Math.abs(Math.sin(clock * 9)) * 0.06 : 0;
        const body_x = 0.2;
        const shoulder_y = radius + bounce;
        return {
            radius,
            ground_y,
            body_x,
            pivot: { x: 0, y: radius },
            left_shoulder: { x: body_x + 0.2, y: shoulder_y },
            hip_y: ground_y + 0.88 + bounce,
            shoulder_y,
            head: { x: body_x, y: shoulder_y + 0.25 },
            head_radius: 0.12,
        };
    }

    /* bucketState: kinematics of the bucket on its circle for (θ, ω) */
    function bucketState(radius, theta, omega) {
        const speed = radius * omega;
        return {
            theta,
            omega,
            x: radius * Math.sin(theta),
            y: radius - radius * Math.cos(theta),
            velocity_x: speed * Math.cos(theta),
            velocity_y: speed * Math.sin(theta),
            tension_per_mass: radius * omega * omega + challenge.gravity * Math.cos(theta),
            a_theta: -challenge.gravity * Math.sin(theta),
            a_r: radius * omega * omega,
        };
    }

    /* limb: round-capped stroke through world points, width in meters */
    function limb(context, transform, points, width, color) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        context.save();
        context.strokeStyle = color;
        context.lineWidth = Math.max(width * pixels_per_meter, 2);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        points.forEach((point, index) => {
            const screen_x = transform.toScreenX(point.x);
            const screen_y = transform.toScreenY(point.y);
            if (index === 0) {
                context.moveTo(screen_x, screen_y);
            } else {
                context.lineTo(screen_x, screen_y);
            }
        });
        context.stroke();
        context.restore();
    }

    /* lerpPoint: point at fraction u from a to b */
    function lerpPoint(a, b, u) {
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }

    /* taperedSegment: limb segment from a (width_a) to b (width_b), round ends,
       with a thin opaque outline (widths in meters) */
    function taperedSegment(context, transform, a, b, width_a, width_b, color, outline_color) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const start_x = transform.toScreenX(a.x);
        const start_y = transform.toScreenY(a.y);
        const end_x = transform.toScreenX(b.x);
        const end_y = transform.toScreenY(b.y);
        const length = Math.hypot(end_x - start_x, end_y - start_y) || 1;
        const normal_x = -(end_y - start_y) / length;
        const normal_y = (end_x - start_x) / length;
        const outline = Math.max(0.007 * pixels_per_meter, 0.8);
        for (const [extra, fill] of [[outline, outline_color], [0, color]]) {
            const half_a = Math.max(width_a * pixels_per_meter / 2, 1.5) + extra;
            const half_b = Math.max(width_b * pixels_per_meter / 2, 1.5) + extra;
            context.fillStyle = fill;
            context.beginPath();
            context.moveTo(start_x + normal_x * half_a, start_y + normal_y * half_a);
            context.lineTo(end_x + normal_x * half_b, end_y + normal_y * half_b);
            context.arc(end_x, end_y, half_b, Math.atan2(normal_y, normal_x), Math.atan2(normal_y, normal_x) + Math.PI, true);
            context.lineTo(start_x - normal_x * half_a, start_y - normal_y * half_a);
            context.arc(start_x, start_y, half_a, Math.atan2(-normal_y, -normal_x), Math.atan2(-normal_y, -normal_x) + Math.PI, true);
            context.closePath();
            context.fill();
        }
    }

    /* drawSleevedArm: tapered orange sleeve past the elbow, ribbed rolled-up cuff,
       bare forearm, mitten hand with thumb, and a brown watch on the free arm */
    function drawSleevedArm(context, transform, shoulder, elbow, hand, with_watch) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const cuff_start = lerpPoint(elbow, hand, 0.12);
        const cuff_end = lerpPoint(elbow, hand, 0.3);
        const wrist = lerpPoint(elbow, hand, 0.86);
        taperedSegment(context, transform, cuff_end, wrist, 0.062, 0.048, SKIN, SKIN_LINE);
        taperedSegment(context, transform, shoulder, elbow, 0.1, 0.082, HOODIE, HOODIE_LINE);
        taperedSegment(context, transform, elbow, cuff_start, 0.082, 0.078, HOODIE, HOODIE_LINE);
        taperedSegment(context, transform, cuff_start, cuff_end, 0.094, 0.09, HOODIE_SHADE, HOODIE_LINE);
        const along_x = transform.toScreenX(hand.x) - transform.toScreenX(elbow.x);
        const along_y = transform.toScreenY(hand.y) - transform.toScreenY(elbow.y);
        const angle = Math.atan2(along_y, along_x);
        context.save();
        context.strokeStyle = "rgba(120, 55, 10, 0.55)";
        context.lineWidth = Math.max(0.006 * pixels_per_meter, 1);
        for (const fraction of [0.18, 0.24]) {
            const rib = lerpPoint(elbow, hand, fraction);
            const rib_x = transform.toScreenX(rib.x);
            const rib_y = transform.toScreenY(rib.y);
            const half = 0.04 * pixels_per_meter;
            context.beginPath();
            context.moveTo(rib_x - Math.sin(angle) * half, rib_y + Math.cos(angle) * half);
            context.lineTo(rib_x + Math.sin(angle) * half, rib_y - Math.cos(angle) * half);
            context.stroke();
        }
        if (with_watch) {
            const watch = lerpPoint(elbow, hand, 0.8);
            taperedSegment(context, transform, lerpPoint(watch, hand, -0.06), lerpPoint(watch, hand, 0.06), 0.056, 0.054, "#5d4037", "#3e2723");
            context.fillStyle = "#d7ccc8";
            context.beginPath();
            context.arc(transform.toScreenX(watch.x), transform.toScreenY(watch.y), Math.max(0.016 * pixels_per_meter, 1.5), 0, 2 * Math.PI);
            context.fill();
        }
        const hand_x = transform.toScreenX(hand.x);
        const hand_y = transform.toScreenY(hand.y);
        context.translate(hand_x, hand_y);
        context.rotate(angle);
        context.fillStyle = SKIN_LINE;
        context.beginPath();
        context.ellipse(0, 0, 0.058 * pixels_per_meter + 1, 0.04 * pixels_per_meter + 1, 0, 0, 2 * Math.PI);
        context.fill();
        context.fillStyle = SKIN;
        context.beginPath();
        context.ellipse(0, 0, 0.058 * pixels_per_meter, 0.04 * pixels_per_meter, 0, 0, 2 * Math.PI);
        context.fill();
        context.beginPath();
        context.ellipse(-0.01 * pixels_per_meter, -0.035 * pixels_per_meter, 0.028 * pixels_per_meter, 0.014 * pixels_per_meter, -0.6, 0, 2 * Math.PI);
        context.fill();
        context.restore();
    }

    /* freeArmPoints: elbow and hand of the left arm (watch side, screen right) */
    function freeArmPoints(geometry) {
        const shoulder = geometry.left_shoulder;
        const head = geometry.head;
        if (teacher_pose === "scared") {
            return { elbow: { x: shoulder.x + 0.2, y: shoulder.y + 0.05 }, hand: { x: head.x + 0.06, y: head.y + 0.13 } };
        }
        if (teacher_pose === "cheer") {
            return { elbow: { x: shoulder.x + 0.12, y: shoulder.y + 0.28 }, hand: { x: shoulder.x + 0.04, y: shoulder.y + 0.56 + 0.04 * Math.sin(clock * 14) } };
        }
        if (teacher_pose === "shrug") {
            return { elbow: { x: shoulder.x + 0.22, y: shoulder.y - 0.12 }, hand: { x: shoulder.x + 0.4, y: shoulder.y + 0.04 } };
        }
        if (drying > 0) {
            return { elbow: { x: shoulder.x + 0.12, y: shoulder.y + 0.18 }, hand: { x: head.x + 0.1 * Math.sin(clock * 16), y: head.y + 0.17 } };
        }
        return { elbow: { x: shoulder.x + 0.05, y: shoulder.y - 0.28 }, hand: { x: shoulder.x - 0.02, y: shoulder.y - 0.55 } };
    }

    /* drawHair: ∩-shaped hair with nearly straight sides, ending a little above the
       shoulders, covered in small curls, with a sparse fringe of thin locks over a
       visible forehead — the back mass (behind the face and the hoodie) or the
       front; wet hair loses its curls and hangs dead straight, darker and longer */
    function drawHair(context, transform, geometry, behind) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const center_x = transform.toScreenX(geometry.head.x);
        const center_y = transform.toScreenY(geometry.head.y);
        const radius = geometry.head_radius * pixels_per_meter;
        const wet = teacher_wetness;
        const curliness = Math.max(1 - 1.6 * wet, 0);
        const base = wet > 0.5 ? "#7d6a50" : HAIR;
        const light = wet > 0.5 ? "#9c8767" : HAIR_LIGHT;
        const length = 1.35 + 0.25 * wet;
        const toScreen = ([x, y]) => [center_x + x * radius, center_y + y * radius];
        const tracePoints = (points) => {
            context.beginPath();
            points.map(toScreen).forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
        };
        const edge = (sign, inset, flare) => {
            const points = [];
            for (let k = 0; k <= 20; k++) {
                const t = k / 20;
                points.push([sign * (inset + flare * (1 - wet) * t * t), -0.3 + (length + 0.3) * t]);
            }
            return points;
        };
        const dome = (half_width, height) => {
            const points = [];
            for (let k = 0; k <= 24; k++) {
                const angle = Math.PI + Math.PI * k / 24;
                points.push([half_width * Math.cos(angle), -0.3 + height * Math.sin(angle)]);
            }
            return points;
        };
        const curls = (points, size) => {
            if (curliness <= 0) {
                return;
            }
            context.strokeStyle = light;
            context.lineWidth = Math.max(size * radius * 0.28, 1);
            points.forEach(([x, y], index) => {
                const [screen_x, screen_y] = toScreen([x, y]);
                const turn = index * 2.4;
                const curl_radius = size * radius * curliness * (0.8 + 0.3 * Math.abs(Math.sin(index * 1.7)));
                context.beginPath();
                for (let k = 0; k <= 10; k++) {
                    const angle = turn + k * 0.55;
                    const spiral = curl_radius * (0.35 + 0.65 * k / 10);
                    const point_x = screen_x + spiral * Math.cos(angle);
                    const point_y = screen_y + spiral * Math.sin(angle);
                    if (k === 0) {
                        context.moveTo(point_x, point_y);
                    } else {
                        context.lineTo(point_x, point_y);
                    }
                }
                context.stroke();
            });
        };
        context.save();
        context.lineCap = "round";
        context.fillStyle = base;
        if (behind) {
            const bottom = [];
            for (let k = 0; k <= 10; k++) {
                bottom.push([1.32 - 2.64 * k / 10, length + 0.07 * curliness * Math.sin(k * 2.2)]);
            }
            tracePoints([...edge(-1, 1.2, 0.12).reverse(), ...dome(1.2, 0.95), ...edge(1, 1.2, 0.12), ...bottom]);
            context.closePath();
            context.fill();
            context.restore();
            return;
        }
        tracePoints([...dome(1.16, 0.92), [0.95, -0.62], [0.5, -0.78], [0, -0.82], [-0.5, -0.78], [-0.95, -0.62]]);
        context.closePath();
        context.fill();
        for (const sign of [-1, 1]) {
            tracePoints([...edge(sign, 1.16, 0.14), ...edge(sign, 0.88, 0.06).reverse()]);
            context.closePath();
            context.fill();
        }
        context.strokeStyle = base;
        context.lineWidth = Math.max(radius * 0.09, 1.2);
        for (const [start_x, end_x, end_y] of [[-0.55, -0.62, -0.35], [-0.15, -0.05, -0.42], [0.3, 0.42, -0.38]]) {
            tracePoints([[start_x, -0.8], [(start_x + end_x) / 2 + 0.06 * curliness, -0.6], [end_x, end_y + 0.15 * wet]]);
            context.stroke();
        }
        const crown = [];
        for (let k = 0; k <= 8; k++) {
            const angle = Math.PI * (1.08 + 0.105 * k);
            crown.push([0.98 * Math.cos(angle), -0.3 + 0.82 * Math.sin(angle)]);
        }
        curls(crown, 0.12);
        const sides = [];
        for (const sign of [-1, 1]) {
            for (let k = 0; k < 5; k++) {
                const t = (k + 0.5) / 5;
                sides.push([sign * (1.02 + 0.06 * t * t), -0.2 + (length + 0.2) * t]);
                sides.push([sign * (1.17 + 0.1 * t * t), -0.1 + (length + 0.1) * t]);
            }
        }
        curls(sides, 0.1);
        if (curliness <= 0) {
            context.strokeStyle = light;
            context.lineWidth = Math.max(radius * 0.05, 1);
            for (const sign of [-1, 1]) {
                for (const inset of [0.96, 1.06]) {
                    tracePoints(edge(sign, inset, 0.04).slice(1, 20));
                    context.stroke();
                }
            }
        }
        context.restore();
    }

    /* drawFace: eyes, brows, nose and a mouth matching the pose */
    function drawFace(context, transform, geometry) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const center_x = transform.toScreenX(geometry.head.x);
        const center_y = transform.toScreenY(geometry.head.y);
        const radius = geometry.head_radius * pixels_per_meter;
        const ink = "#3e2723";
        const scared = teacher_pose === "scared";
        const sad = teacher_wetness > 0.5 || teacher_pose === "shrug";
        context.save();
        context.fillStyle = SKIN;
        context.beginPath();
        context.ellipse(center_x, center_y + radius * 0.08, radius * 0.92, radius * 1.05, 0, 0, 2 * Math.PI);
        context.fill();
        context.fillStyle = "rgba(160, 120, 90, 0.18)";
        context.beginPath();
        context.ellipse(center_x, center_y + radius * 0.6, radius * 0.6, radius * 0.35, 0, 0, Math.PI);
        context.fill();

        const eye_y = center_y - radius * 0.05;
        context.fillStyle = ink;
        context.strokeStyle = ink;
        context.lineWidth = Math.max(radius * 0.08, 1);
        for (const side of [-1, 1]) {
            context.beginPath();
            context.ellipse(center_x + side * radius * 0.36, eye_y - (scared ? radius * 0.04 : 0), radius * (scared ? 0.12 : 0.09), radius * (scared ? 0.16 : 0.11), 0, 0, 2 * Math.PI);
            context.fill();
            const brow_lift = scared ? radius * 0.12 : 0;
            const brow_tilt = sad ? radius * 0.07 : 0;
            context.beginPath();
            context.moveTo(center_x + side * radius * 0.18, eye_y - radius * 0.25 - brow_lift - brow_tilt);
            context.lineTo(center_x + side * radius * 0.55, eye_y - radius * 0.3 - brow_lift + brow_tilt);
            context.stroke();
        }
        context.strokeStyle = "rgba(120, 80, 60, 0.7)";
        context.lineWidth = Math.max(radius * 0.07, 1);
        context.beginPath();
        context.moveTo(center_x + radius * 0.02, eye_y + radius * 0.1);
        context.lineTo(center_x + radius * 0.12, eye_y + radius * 0.36);
        context.lineTo(center_x - radius * 0.02, eye_y + radius * 0.38);
        context.stroke();

        const mouth_y = center_y + radius * 0.58;
        context.strokeStyle = ink;
        context.fillStyle = "#6d2b20";
        context.lineWidth = Math.max(radius * 0.08, 1.2);
        context.beginPath();
        if (teacher_pose === "cheer") {
            context.arc(center_x, mouth_y - radius * 0.1, radius * 0.32, 0.1 * Math.PI, 0.9 * Math.PI);
            context.fill();
        } else if (scared) {
            context.ellipse(center_x, mouth_y, radius * 0.14, radius * 0.2, 0, 0, 2 * Math.PI);
            context.fill();
        } else if (sad) {
            context.arc(center_x, mouth_y + radius * 0.22, radius * 0.25, 1.15 * Math.PI, 1.85 * Math.PI);
            context.stroke();
        } else {
            context.arc(center_x, mouth_y - radius * 0.12, radius * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
            context.stroke();
        }
        context.restore();
    }

    /* drawTeacher: caricature — shaggy hair, orange hoodie with pushed-up sleeves,
       brown watch, light jeans; the swinging arm is drawn separately */
    function drawTeacher(context, transform, geometry) {
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const body_x = geometry.body_x;
        const ground_y = geometry.ground_y;
        const hip_y = geometry.hip_y;
        const shoulder_y = geometry.shoulder_y;
        const toX = transform.toScreenX;
        const toY = transform.toScreenY;

        context.save();
        context.fillStyle = "rgba(0, 0, 0, 0.18)";
        context.beginPath();
        context.ellipse(toX(body_x), toY(ground_y), 0.3 * pixels_per_meter, 0.035 * pixels_per_meter, 0, 0, 2 * Math.PI);
        context.fill();
        if (teacher_wetness > 0) {
            context.fillStyle = `rgba(66, 165, 245, ${0.35 * teacher_wetness})`;
            context.beginPath();
            context.ellipse(toX(body_x), toY(ground_y), (0.15 + 0.4 * teacher_wetness) * pixels_per_meter, 0.05 * pixels_per_meter, 0, 0, 2 * Math.PI);
            context.fill();
        }
        context.restore();

        for (const side of [-1, 1]) {
            limb(context, transform, [{ x: body_x + side * 0.09, y: hip_y }, { x: body_x + side * 0.11, y: ground_y + 0.06 }], 0.13, JEANS);
            limb(context, transform, [{ x: body_x + side * 0.11, y: ground_y + 0.45 }, { x: body_x + side * 0.112, y: ground_y + 0.1 }], 0.012, "rgba(70, 85, 110, 0.6)");
            context.save();
            context.fillStyle = "#4e342e";
            context.beginPath();
            context.ellipse(toX(body_x + side * 0.15), toY(ground_y + 0.03), 0.09 * pixels_per_meter, 0.04 * pixels_per_meter, 0, 0, 2 * Math.PI);
            context.fill();
            context.restore();
        }

        drawHair(context, transform, geometry, true);

        context.save();
        context.fillStyle = HOODIE_SHADE;
        context.beginPath();
        context.ellipse(toX(body_x), toY(shoulder_y + 0.02), 0.16 * pixels_per_meter, 0.07 * pixels_per_meter, 0, 0, 2 * Math.PI);
        context.fill();
        const gradient = context.createLinearGradient(toX(body_x - 0.22), 0, toX(body_x + 0.22), 0);
        gradient.addColorStop(0, HOODIE_SHADE);
        gradient.addColorStop(0.35, HOODIE);
        gradient.addColorStop(1, "#e07a1c");
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(toX(body_x - 0.2), toY(shoulder_y));
        context.quadraticCurveTo(toX(body_x), toY(shoulder_y + 0.05), toX(body_x + 0.2), toY(shoulder_y));
        context.lineTo(toX(body_x + 0.21), toY(hip_y - 0.02));
        context.quadraticCurveTo(toX(body_x), toY(hip_y - 0.06), toX(body_x - 0.21), toY(hip_y - 0.02));
        context.closePath();
        context.fill();
        context.fillStyle = HOODIE_SHADE;
        context.fillRect(toX(body_x - 0.21), toY(hip_y + 0.04), 0.42 * pixels_per_meter, 0.06 * pixels_per_meter);
        context.beginPath();
        context.moveTo(toX(body_x - 0.13), toY(hip_y + 0.24));
        context.lineTo(toX(body_x + 0.13), toY(hip_y + 0.24));
        context.lineTo(toX(body_x + 0.16), toY(hip_y + 0.08));
        context.lineTo(toX(body_x - 0.16), toY(hip_y + 0.08));
        context.closePath();
        context.fill();
        if (teacher_wetness > 0) {
            context.fillStyle = `rgba(120, 60, 10, ${0.3 * teacher_wetness})`;
            context.beginPath();
            context.ellipse(toX(body_x), toY(shoulder_y - 0.12), 0.18 * pixels_per_meter, 0.14 * pixels_per_meter, 0, 0, 2 * Math.PI);
            context.fill();
        }
        context.strokeStyle = "#fff3e0";
        context.lineWidth = Math.max(0.012 * pixels_per_meter, 1.2);
        context.beginPath();
        for (const side of [-1, 1]) {
            context.moveTo(toX(body_x + side * 0.04), toY(shoulder_y + 0.01));
            context.lineTo(toX(body_x + side * 0.05), toY(shoulder_y - 0.16));
        }
        context.stroke();
        context.restore();

        const free_arm = freeArmPoints(geometry);
        drawSleevedArm(context, transform, geometry.left_shoulder, free_arm.elbow, free_arm.hand, true);
        if (drying > 0) {
            context.save();
            const towel_x = toX(free_arm.hand.x);
            const towel_y = toY(free_arm.hand.y);
            const towel_width = 0.32 * pixels_per_meter;
            context.fillStyle = "#e3f2fd";
            context.strokeStyle = "#90caf9";
            context.lineWidth = 1.5;
            context.beginPath();
            context.roundRect(towel_x - towel_width / 2, towel_y - 0.03 * pixels_per_meter, towel_width, 0.2 * pixels_per_meter, 4);
            context.fill();
            context.stroke();
            context.fillStyle = "#64b5f6";
            context.fillRect(towel_x - towel_width / 2, towel_y + 0.1 * pixels_per_meter, towel_width, 0.025 * pixels_per_meter);
            context.restore();
        }

        drawFace(context, transform, geometry);
        drawHair(context, transform, geometry, false);

        if (teacher_wetness > 0.3) {
            context.save();
            context.fillStyle = "rgba(66, 165, 245, 0.85)";
            for (let i = 0; i < 5; i++) {
                const phase = (clock * 1.4 + i * 0.23) % 1;
                const drip_x = toX(geometry.head.x + (i - 2) * 0.06);
                const drip_y = toY(geometry.head.y - 0.12) + phase * 0.6 * pixels_per_meter;
                context.beginPath();
                context.ellipse(drip_x, drip_y, 0.012 * pixels_per_meter + 1, 0.02 * pixels_per_meter + 1.5, 0, 0, 2 * Math.PI);
                context.fill();
            }
            context.restore();
        }
    }

    /* drawBucket: bucket centred at (x, y) screen, opening along (sin r, −cos r) */
    function drawBucket(context, x, y, rotation, width, water, alpha = 1) {
        const height = width * 0.9;
        const bottom = height / 2;
        const top = -height / 2;
        const bottom_half = width * 0.36;
        const top_half = width * 0.5;
        context.save();
        context.globalAlpha = alpha;
        context.translate(x, y);
        context.rotate(rotation);
        if (water > 0) {
            const level = bottom - (bottom - top) * 0.8 * water;
            const ripple = Math.sin(clock * 7) * height * 0.03;
            const half_at_level = bottom_half + (top_half - bottom_half) * (bottom - level) / (bottom - top);
            context.fillStyle = "rgba(41, 121, 255, 0.85)";
            context.beginPath();
            context.moveTo(-bottom_half, bottom);
            context.lineTo(bottom_half, bottom);
            context.lineTo(half_at_level * 0.95, level - ripple);
            context.quadraticCurveTo(0, level + ripple, -half_at_level * 0.95, level + ripple);
            context.closePath();
            context.fill();
        }
        const gradient = context.createLinearGradient(-top_half, 0, top_half, 0);
        gradient.addColorStop(0, "rgba(176, 190, 197, 0.6)");
        gradient.addColorStop(0.5, "rgba(236, 239, 241, 0.4)");
        gradient.addColorStop(1, "rgba(120, 144, 156, 0.65)");
        context.fillStyle = gradient;
        context.strokeStyle = "#546e7a";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-bottom_half, bottom);
        context.lineTo(bottom_half, bottom);
        context.lineTo(top_half, top);
        context.lineTo(-top_half, top);
        context.closePath();
        context.fill();
        context.stroke();
        context.lineWidth = 1.6;
        context.beginPath();
        context.arc(0, top, top_half * 0.95, Math.PI, 2 * Math.PI);
        context.stroke();
        context.restore();
    }

    /* openingRotation: rotation making the bucket opening point along (dx, dy) screen */
    function openingRotation(direction_x, direction_y) {
        return Math.atan2(direction_x, -direction_y);
    }

    /* drawFreeBodyInset: bucket alone with P, T and the resultant (P alone once free,
       no forces during the arm-driven wind-up) */
    function drawFreeBodyInset(context, state, ink, show_forces) {
        const draw = globalThis.canvas_draw;
        const box_width = 168;
        const box_height = 236;
        const box_x = context.canvas.width - box_width - 14;
        const box_y = 14;
        const center_x = box_x + box_width / 2;
        const center_y = box_y + 100;
        context.save();
        context.fillStyle = isDark() ? "rgba(22, 27, 34, 0.92)" : "rgba(255, 255, 255, 0.92)";
        context.strokeStyle = "rgba(120, 130, 145, 0.45)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(box_x, box_y, box_width, box_height, 8);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(text("fbd_title"), center_x, box_y + 10);
        context.restore();
        if (!show_forces) {
            drawBucket(context, center_x, center_y, 0, 22, bucket_water);
            context.save();
            context.fillStyle = ink;
            context.font = "italic 12px system-ui, sans-serif";
            context.textAlign = "center";
            context.fillText(text("windup"), center_x, center_y + 60);
            context.restore();
            return;
        }
        const tension = state === null ? 0 : Math.max(state.tension_per_mass, 0);
        const theta = state === null ? 0 : state.theta;
        const net_x = -Math.sin(theta) * tension;
        const net_y = Math.cos(theta) * tension - challenge.gravity;
        const net = Math.hypot(net_x, net_y);
        const scale = 55 / Math.max(challenge.gravity, tension, net);
        draw.drawVector(context, center_x, center_y, 0, challenge.gravity * scale, { color: WEIGHT_COLOR, label: "P" });
        draw.drawVector(context, center_x, center_y, -Math.sin(theta) * tension * scale, -Math.cos(theta) * tension * scale, { color: TENSION_COLOR, label: "T" });
        draw.drawVector(context, center_x, center_y, net_x * scale, -net_y * scale, { color: ink, line_width: 4, label: "ΣF" });
        drawBucket(context, center_x, center_y, state === null ? 0 : openingRotation(-Math.sin(theta), -Math.cos(theta)), 22, bucket_water);
        context.save();
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = WEIGHT_COLOR;
        context.fillText(`P = ${formatValue(params().mass * challenge.gravity, 2)} N`, center_x, center_y + 78);
        context.fillStyle = TENSION_COLOR;
        context.fillText(`T = ${formatValue(params().mass * tension, 2)} N`, center_x, center_y + 94);
        context.fillStyle = ink;
        context.fillText(`ΣF = ${formatValue(params().mass * net, 2)} N`, center_x, center_y + 110);
        context.restore();
    }

    /* drawScene: grid, ground, path circle, teacher, swinging arm, rope, bucket, vectors */
    function drawScene(context, transform, geometry, state, driven) {
        const draw = globalThis.canvas_draw;
        const radius = geometry.radius;
        const pixels_per_meter = transform.toScreenX(1) - transform.toScreenX(0);
        const ink = isDark() ? "#e8ecf3" : "#1c2026";
        const width = context.canvas.width;
        const height = context.canvas.height;
        const ground_screen = transform.toScreenY(geometry.ground_y);

        context.clearRect(0, 0, width, height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        context.save();
        const place_style = PLACE_STYLES[challenge.place];
        const gradient = context.createLinearGradient(0, ground_screen, 0, ground_screen + 70);
        gradient.addColorStop(0, `rgba(${place_style.ground}, 0.45)`);
        gradient.addColorStop(1, `rgba(${place_style.ground}, 0)`);
        context.fillStyle = gradient;
        context.fillRect(0, ground_screen, width, Math.max(height - ground_screen, 0));
        context.strokeStyle = "rgba(120, 130, 145, 0.85)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, ground_screen);
        context.lineTo(width, ground_screen);
        context.stroke();
        context.strokeStyle = "rgba(120, 130, 145, 0.5)";
        context.lineWidth = 1.4;
        context.setLineDash([6, 7]);
        context.beginPath();
        context.arc(transform.toScreenX(0), transform.toScreenY(radius), radius * pixels_per_meter, 0, 2 * Math.PI);
        context.stroke();
        context.restore();

        context.save();
        context.font = "bold 13px system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillStyle = ink;
        context.fillText(`${place_style.icon} ${text(`place_${challenge.place}`)} · g = ${formatValue(challenge.gravity, 2)} m/s²`, 14, height - 12);
        context.restore();

        drawTeacher(context, transform, geometry);

        const direction = { x: Math.sin(state.theta), y: -Math.cos(state.theta) };
        const pivot = geometry.pivot;
        const hand = { x: pivot.x + ARM_LENGTH * direction.x, y: pivot.y + ARM_LENGTH * direction.y };
        const sag = { x: -0.035, y: -0.06 };
        const sag_along = sag.x * direction.x + sag.y * direction.y;
        const elbow = {
            x: pivot.x + 0.5 * ARM_LENGTH * direction.x + sag.x - sag_along * direction.x,
            y: pivot.y + 0.5 * ARM_LENGTH * direction.y + sag.y - sag_along * direction.y,
        };
        drawSleevedArm(context, transform, pivot, elbow, hand, false);

        const bucket_x = transform.toScreenX(state.x);
        const bucket_y = transform.toScreenY(state.y);
        const hand_x = transform.toScreenX(hand.x);
        const hand_y = transform.toScreenY(hand.y);
        context.save();
        context.strokeStyle = "#8d6e63";
        context.lineCap = "round";
        context.lineWidth = 2.8;
        context.beginPath();
        context.moveTo(hand_x, hand_y);
        if (bucket_on_rope) {
            context.lineTo(bucket_x, bucket_y);
        } else {
            context.quadraticCurveTo(hand_x + 6, hand_y + 18, hand_x + 14 * Math.sin(clock * 3), hand_y + 30);
        }
        context.stroke();
        context.restore();

        context.save();
        context.fillStyle = TENSION_COLOR;
        context.font = "bold 12px system-ui, sans-serif";
        context.textAlign = "right";
        context.textBaseline = "bottom";
        context.fillText(text("rope_label", { t: challenge.tension_max }), transform.toScreenX(-0.75 * radius), transform.toScreenY(1.75 * radius));
        context.restore();

        const bucket_width = BUCKET_WIDTH * pixels_per_meter;
        if (bucket_on_rope) {
            drawBucket(context, bucket_x, bucket_y, openingRotation(hand_x - bucket_x, hand_y - bucket_y), bucket_width, bucket_water);
            if (!driven) {
                const force_scale = 0.6 * radius * pixels_per_meter / state.max_force;
                const velocity_scale = 0.5 * radius * pixels_per_meter / state.max_speed;
                const tension = Math.max(state.tension_per_mass, 0);
                const toward_pivot = { x: -direction.x, y: -direction.y };
                const tangent = { x: Math.cos(state.theta), y: Math.sin(state.theta) };
                const acceleration_x = state.a_theta * tangent.x + state.a_r * toward_pivot.x;
                const acceleration_y = state.a_theta * tangent.y + state.a_r * toward_pivot.y;
                draw.drawVector(context, bucket_x, bucket_y, 0, challenge.gravity * force_scale, { color: WEIGHT_COLOR, label: "P" });
                draw.drawVector(context, bucket_x, bucket_y, toward_pivot.x * tension * force_scale, -toward_pivot.y * tension * force_scale, { color: TENSION_COLOR, label: "T" });
                draw.drawVector(context, bucket_x, bucket_y, acceleration_x * force_scale, -acceleration_y * force_scale, { color: ink, dash: [2, 4], line_width: 2, label: "a" });
                draw.drawVector(context, bucket_x, bucket_y, state.velocity_x * velocity_scale, -state.velocity_y * velocity_scale, { color: ink, dash: [7, 5], line_width: 2, label: "v" });
            }
        }
        drawFreeBodyInset(context, bucket_on_rope ? state : null, ink, !driven);
        return bucket_width;
    }

    /* spawnConfetti: rotating paper rectangles falling from above the canvas */
    function spawnConfetti(width, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: "confetti",
                x: randomBetween(0, width),
                y: randomBetween(-160, -10),
                velocity_x: randomBetween(-60, 60),
                velocity_y: randomBetween(60, 220),
                rotation: randomBetween(0, Math.PI),
                spin: randomBetween(-8, 8),
                wobble: randomBetween(0, 2 * Math.PI),
                size: randomBetween(6, 11),
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                life: randomBetween(3, 4.5),
            });
        }
    }

    /* launchRockets: fireworks rising from the bottom of the canvas */
    function launchRockets(width, height, count) {
        for (let i = 0; i < count; i++) {
            rockets.push({
                x: width * randomBetween(0.15, 0.85),
                y: height + 10,
                velocity_x: randomBetween(-40, 40),
                velocity_y: -randomBetween(height * 0.9, height * 1.25),
                delay: i * 0.22,
                color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            });
        }
    }

    /* explodeRocket: radial burst of glowing sparks */
    function explodeRocket(rocket) {
        const count = 70;
        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count + randomBetween(-0.05, 0.05);
            const speed = randomBetween(90, 230);
            particles.push({
                kind: "spark",
                x: rocket.x,
                y: rocket.y,
                velocity_x: speed * Math.cos(angle),
                velocity_y: speed * Math.sin(angle),
                color: Math.random() < 0.25 ? "#ffffff" : rocket.color,
                life: randomBetween(1.1, 1.8),
                max_life: 1.8,
            });
        }
    }

    /* spawnSplash: droplets bursting upward from a screen point */
    function spawnSplash(screen_x, screen_y, count, spread = 1) {
        for (let i = 0; i < count; i++) {
            const angle = randomBetween(-Math.PI * 0.95, -Math.PI * 0.05);
            const speed = randomBetween(50, 230) * spread;
            particles.push({
                kind: "droplet",
                x: screen_x,
                y: screen_y,
                velocity_x: speed * Math.cos(angle),
                velocity_y: speed * Math.sin(angle),
                size: randomBetween(1.5, 3.5),
                life: randomBetween(0.5, 1.1),
            });
        }
    }

    /* hitsTeacher: which part of the teacher a world point is inside, if any */
    function hitsTeacher(geometry, x, y) {
        if (Math.hypot(x - geometry.head.x, y - geometry.head.y) < geometry.head_radius * 1.35) {
            return "head";
        }
        if (Math.abs(x - geometry.body_x) < 0.22 && y > geometry.hip_y && y < geometry.shoulder_y + 0.05) {
            return "body";
        }
        return null;
    }

    /* emitWater: water leaving the bucket — each drop starts in the bucket with the
       bucket's velocity, then falls freely */
    function emitWater(state, amount) {
        for (let i = 0; i < amount; i++) {
            water_drops.push({
                x: state.x + randomBetween(-0.04, 0.04),
                y: state.y + randomBetween(-0.04, 0.04),
                velocity_x: state.velocity_x + randomBetween(-0.12, 0.12),
                velocity_y: state.velocity_y + randomBetween(-0.12, 0.12),
                size: randomBetween(2.5, 5),
            });
        }
    }

    /* updateWater: exact free fall of every drop (slow motion), splashing on the
       teacher (wets them) or on the ground */
    function updateWater(context, transform, delta_seconds, geometry) {
        const step = delta_seconds * SLOW_MOTION;
        const surviving = [];
        for (const drop of water_drops) {
            drop.x += drop.velocity_x * step;
            drop.y += drop.velocity_y * step - challenge.gravity * step * step / 2;
            drop.velocity_y -= challenge.gravity * step;
            const screen_x = transform.toScreenX(drop.x);
            const screen_y = transform.toScreenY(drop.y);
            const part = drop.velocity_y < 0 ? hitsTeacher(geometry, drop.x, drop.y) : null;
            if (part !== null) {
                spawnSplash(screen_x, screen_y, part === "head" ? 4 : 2, 0.7);
                teacher_wetness = Math.min(teacher_wetness + (part === "head" ? 0.05 : 0.03), 1);
                continue;
            }
            if (drop.y <= geometry.ground_y) {
                spawnSplash(screen_x, transform.toScreenY(geometry.ground_y), 2);
                if (Math.abs(drop.x - geometry.body_x) < 0.4) {
                    teacher_wetness = Math.min(teacher_wetness + 0.01, 1);
                }
                continue;
            }
            context.save();
            context.fillStyle = "rgba(33, 150, 243, 0.88)";
            context.beginPath();
            context.ellipse(screen_x, screen_y, drop.size * 1.2, drop.size, Math.atan2(-drop.velocity_y, drop.velocity_x), 0, 2 * Math.PI);
            context.fill();
            context.fillStyle = "rgba(255, 255, 255, 0.7)";
            context.beginPath();
            context.arc(screen_x - drop.size * 0.3, screen_y - drop.size * 0.3, drop.size * 0.3, 0, 2 * Math.PI);
            context.fill();
            context.restore();
            surviving.push(drop);
        }
        water_drops = surviving;
    }

    /* launchFlyer: the bucket leaves the snapped rope along its tangent, spinning at
       the swing's own angular velocity (it kept facing the shoulder) */
    function launchFlyer(state, rotation) {
        flyer = {
            phase: "flight",
            x: state.x,
            y: state.y,
            velocity_x: state.velocity_x,
            velocity_y: state.velocity_y,
            rotation,
            spin: -state.omega,
            path: [{ x: state.x, y: state.y }],
        };
    }

    /* updateFlyer: real parabola, impact on the ground, unlucky bounce whose parabola
       ends on the teacher's head (spin chosen to land upside down), then a hat */
    function updateFlyer(context, transform, delta_seconds, geometry, bucket_width) {
        if (flyer === null) {
            return;
        }
        const step = delta_seconds * SLOW_MOTION;
        const half_height = BUCKET_WIDTH * 0.45;
        if (flyer.phase === "flight" || flyer.phase === "bounce") {
            flyer.x += flyer.velocity_x * step;
            flyer.y += flyer.velocity_y * step - challenge.gravity * step * step / 2;
            flyer.velocity_y -= challenge.gravity * step;
            flyer.rotation += flyer.spin * step;
            flyer.path.push({ x: flyer.x, y: flyer.y });
            if (bucket_water > 0.35 && Math.random() < 0.6) {
                emitWater(flyer, 1);
                bucket_water = Math.max(bucket_water - 0.01, 0.35);
            }
        }
        if (flyer.phase === "flight" && flyer.y - half_height <= geometry.ground_y) {
            flyer.y = geometry.ground_y + half_height;
            const target = { x: geometry.head.x, y: geometry.head.y + geometry.head_radius + half_height };
            const bounce = bounceToward(flyer.x, flyer.y, flyer.velocity_y, target.x, target.y, challenge.gravity);
            flyer.velocity_x = bounce.velocity_x;
            flyer.velocity_y = bounce.velocity_y;
            const turns = Math.round((flyer.rotation - Math.PI) / (2 * Math.PI)) + (bounce.velocity_x < 0 ? -2 : 2);
            flyer.spin = (Math.PI + 2 * Math.PI * turns - flyer.rotation) / bounce.flight_time;
            flyer.phase = "bounce";
            flyer.remaining = bounce.flight_time;
            spawnSplash(transform.toScreenX(flyer.x), transform.toScreenY(geometry.ground_y), 25);
            shakeCanvas();
        } else if (flyer.phase === "bounce") {
            flyer.remaining -= step;
            if (flyer.remaining <= 0) {
                flyer.phase = "hat";
                hat = { fading: null };
                spawnSplash(transform.toScreenX(geometry.head.x), transform.toScreenY(geometry.head.y + geometry.head_radius), 55, 1.2);
                teacher_wetness = 1;
                teacher_pose = "shrug";
                bucket_water = 0;
                shakeCanvas();
            }
        }
        if (flyer.phase !== "hat") {
            context.save();
            context.strokeStyle = isDark() ? "rgba(236, 239, 241, 0.55)" : "rgba(55, 71, 79, 0.55)";
            context.lineWidth = 1.5;
            context.setLineDash([5, 5]);
            context.beginPath();
            flyer.path.forEach((point, index) => {
                const screen_x = transform.toScreenX(point.x);
                const screen_y = transform.toScreenY(point.y);
                if (index === 0) {
                    context.moveTo(screen_x, screen_y);
                } else {
                    context.lineTo(screen_x, screen_y);
                }
            });
            context.stroke();
            context.restore();
            drawBucket(context, transform.toScreenX(flyer.x), transform.toScreenY(flyer.y), flyer.rotation, bucket_width, bucket_water);
        }
    }

    /* drawHat: the bucket upside down on the teacher's head, lifted off and faded at reset */
    function drawHat(context, transform, geometry, delta_seconds, bucket_width) {
        if (hat === null) {
            return;
        }
        let lift = 0;
        let alpha = 1;
        if (hat.fading !== null) {
            hat.fading += delta_seconds;
            lift = 0.3 * hat.fading / HAT_FADE_SECONDS;
            alpha = Math.max(1 - hat.fading / HAT_FADE_SECONDS, 0);
            if (alpha <= 0) {
                hat = null;
                return;
            }
        }
        drawBucket(
            context,
            transform.toScreenX(geometry.head.x),
            transform.toScreenY(geometry.head.y + geometry.head_radius + BUCKET_WIDTH * 0.25 + lift),
            Math.PI,
            bucket_width,
            0,
            alpha,
        );
    }

    /* updateDrying: towel rubbing, steam wisps and a shrinking puddle */
    function updateDrying(transform, delta_seconds, geometry) {
        if (drying <= 0) {
            return;
        }
        drying -= delta_seconds;
        teacher_wetness = Math.max(teacher_wetness - delta_seconds / (DRYING_SECONDS * 0.9), 0);
        if (Math.random() < 0.5) {
            particles.push({
                kind: "steam",
                x: transform.toScreenX(geometry.head.x + randomBetween(-0.2, 0.2)),
                y: transform.toScreenY(geometry.head.y + randomBetween(0, 0.15)),
                velocity_x: randomBetween(-10, 10),
                velocity_y: -randomBetween(25, 50),
                size: randomBetween(5, 10),
                life: 1.2,
            });
        }
        if (drying <= 0) {
            drying = 0;
            teacher_wetness = 0;
        }
    }

    /* updateParticles: confetti, sparks, droplets and steam (screen units) */
    function updateParticles(context, delta_seconds) {
        const surviving = [];
        for (const particle of particles) {
            particle.life -= delta_seconds;
            if (particle.life <= 0 || particle.y > context.canvas.height + 40) {
                continue;
            }
            context.save();
            if (particle.kind === "confetti") {
                particle.wobble += delta_seconds * 6;
                particle.velocity_y = Math.min(particle.velocity_y + 260 * delta_seconds, 260);
                particle.x += (particle.velocity_x + Math.sin(particle.wobble) * 40) * delta_seconds;
                particle.y += particle.velocity_y * delta_seconds;
                particle.rotation += particle.spin * delta_seconds;
                context.globalAlpha = Math.min(particle.life, 1);
                context.translate(particle.x, particle.y);
                context.rotate(particle.rotation);
                context.scale(1, Math.abs(Math.cos(particle.wobble)) * 0.8 + 0.2);
                context.fillStyle = particle.color;
                context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
            } else if (particle.kind === "spark") {
                particle.velocity_x *= 1 - 1.6 * delta_seconds;
                particle.velocity_y = particle.velocity_y * (1 - 1.6 * delta_seconds) + 120 * delta_seconds;
                particle.x += particle.velocity_x * delta_seconds;
                particle.y += particle.velocity_y * delta_seconds;
                context.globalCompositeOperation = "lighter";
                context.globalAlpha = Math.min(particle.life / particle.max_life * 1.4, 1);
                context.strokeStyle = particle.color;
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(particle.x, particle.y);
                context.lineTo(particle.x - particle.velocity_x * 0.05, particle.y - particle.velocity_y * 0.05);
                context.stroke();
                context.fillStyle = particle.color;
                context.beginPath();
                context.arc(particle.x, particle.y, 1.8, 0, 2 * Math.PI);
                context.fill();
            } else if (particle.kind === "steam") {
                particle.x += (particle.velocity_x + Math.sin(particle.life * 9) * 12) * delta_seconds;
                particle.y += particle.velocity_y * delta_seconds;
                particle.size += 8 * delta_seconds;
                context.globalAlpha = 0.35 * Math.min(particle.life, 1);
                context.fillStyle = isDark() ? "#cfd8dc" : "#b0bec5";
                context.beginPath();
                context.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
                context.fill();
            } else {
                particle.velocity_y += 700 * delta_seconds;
                particle.x += particle.velocity_x * delta_seconds;
                particle.y += particle.velocity_y * delta_seconds;
                context.globalAlpha = Math.min(particle.life * 2, 1);
                context.fillStyle = "rgba(66, 165, 245, 0.9)";
                context.beginPath();
                context.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
                context.fill();
            }
            context.restore();
            surviving.push(particle);
        }
        particles = surviving;

        const flying = [];
        for (const rocket of rockets) {
            if (rocket.delay > 0) {
                rocket.delay -= delta_seconds;
                flying.push(rocket);
                continue;
            }
            rocket.velocity_y += 420 * delta_seconds;
            rocket.x += rocket.velocity_x * delta_seconds;
            rocket.y += rocket.velocity_y * delta_seconds;
            if (rocket.velocity_y >= -40) {
                explodeRocket(rocket);
                continue;
            }
            context.save();
            context.globalCompositeOperation = "lighter";
            context.strokeStyle = rocket.color;
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(rocket.x, rocket.y);
            context.lineTo(rocket.x - rocket.velocity_x * 0.04, rocket.y - rocket.velocity_y * 0.04);
            context.stroke();
            context.restore();
            flying.push(rocket);
        }
        rockets = flying;
    }

    /* drawBurst: jagged comic burst behind a fail headline */
    function drawBurst(context, center_x, center_y, radius, fill, stroke) {
        context.beginPath();
        for (let k = 0; k < 24; k++) {
            const angle = (k * Math.PI) / 12 + clock * 0.4;
            const spike = k % 2 === 0 ? radius : radius * 0.62;
            context.lineTo(center_x + spike * 1.6 * Math.cos(angle), center_y + spike * 0.75 * Math.sin(angle));
        }
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = stroke;
        context.lineWidth = 3;
        context.stroke();
    }

    /* showBanner: animated headline + subtitle */
    function showBanner(style, title, subtitle, extra = null) {
        banner = { style, title, subtitle, extra, age: 0 };
    }

    /* drawBanner: pop-in headline with sunburst (success) or comic burst (fail) */
    function drawBanner(context, delta_seconds) {
        if (banner === null) {
            return;
        }
        banner.age += delta_seconds;
        const duration = banner.style === "success" ? SUCCESS_SEQUENCE_SECONDS : FAIL_SEQUENCE_SECONDS;
        const fade = Math.min((duration - banner.age) / 0.5, 1);
        if (fade <= 0) {
            banner = null;
            return;
        }
        const scale = easeOutBack(Math.min(banner.age / 0.45, 1));
        const center_x = context.canvas.width / 2;
        const center_y = Math.min(110, context.canvas.height * 0.24);
        const title_size = Math.max(Math.min(context.canvas.width / 13, 52), 24);

        context.save();
        context.globalAlpha = Math.max(fade, 0);
        context.translate(center_x, center_y);
        context.scale(scale, scale);
        if (banner.style === "success") {
            context.save();
            context.rotate(clock * 0.6);
            for (let k = 0; k < 16; k++) {
                context.rotate(Math.PI / 8);
                context.fillStyle = k % 2 === 0 ? "rgba(255, 213, 79, 0.28)" : "rgba(255, 241, 118, 0.14)";
                context.beginPath();
                context.moveTo(0, 0);
                context.lineTo(title_size * 6, -title_size * 0.5);
                context.lineTo(title_size * 6, title_size * 0.5);
                context.closePath();
                context.fill();
            }
            context.restore();
        } else if (banner.style !== "slow") {
            const colors = banner.style === "water" ? ["#e3f2fd", "#1e88e5"] : ["#ffebee", "#e53935"];
            drawBurst(context, 0, 0, title_size * 1.25, colors[0], colors[1]);
        }

        const shake = banner.style === "slow" ? Math.sin(banner.age * 18) * 6 * Math.max(1 - banner.age, 0) : 0;
        context.font = `900 ${title_size}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineJoin = "round";
        context.lineWidth = Math.max(title_size * 0.14, 4);
        context.strokeStyle = banner.style === "slow" ? "#37474f" : "#ffffff";
        context.strokeText(banner.title, shake, 0);
        if (banner.style === "success") {
            const gradient = context.createLinearGradient(0, -title_size / 2, 0, title_size / 2);
            gradient.addColorStop(0, "#fff176");
            gradient.addColorStop(0.5, "#ffb300");
            gradient.addColorStop(1, "#e65100");
            context.fillStyle = gradient;
            context.shadowColor = "rgba(255, 179, 0, 0.8)";
            context.shadowBlur = 18;
        } else {
            context.fillStyle = { water: "#1565c0", broke: "#c62828", slow: "#eceff1" }[banner.style];
        }
        context.fillText(banner.title, shake, 0);
        context.shadowBlur = 0;

        context.font = `600 ${Math.max(title_size * 0.32, 13)}px system-ui, sans-serif`;
        context.lineWidth = 4;
        context.strokeStyle = "rgba(0, 0, 0, 0.55)";
        context.strokeText(banner.subtitle, 0, title_size * 0.95);
        context.fillStyle = "#ffffff";
        context.fillText(banner.subtitle, 0, title_size * 0.95);

        if (banner.extra !== null) {
            const pulse = 1 + 0.06 * Math.sin(clock * 10);
            context.scale(pulse, pulse);
            context.font = `900 ${Math.max(title_size * 0.55, 18)}px system-ui, sans-serif`;
            context.lineWidth = 6;
            context.strokeStyle = "#4a148c";
            context.strokeText(banner.extra, 0, title_size * 1.75);
            context.fillStyle = "#e1bee7";
            context.fillText(banner.extra, 0, title_size * 1.75);
        }
        context.restore();
    }

    /* drawFlash: full-canvas color flash (gold on success, blue / red on a fail) */
    function drawFlash(context, delta_seconds) {
        if (flash === null) {
            return;
        }
        flash.alpha -= delta_seconds * 0.9;
        if (flash.alpha <= 0) {
            flash = null;
            return;
        }
        const width = context.canvas.width;
        const height = context.canvas.height;
        const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
        gradient.addColorStop(0, `rgba(${flash.color}, 0)`);
        gradient.addColorStop(1, `rgba(${flash.color}, ${flash.alpha})`);
        context.save();
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.restore();
    }

    /* drawSparkles: twinkling stars around the dry bucket after a success */
    function drawSparkles(context, screen_x, screen_y) {
        context.save();
        context.fillStyle = "#ffd54f";
        for (let k = 0; k < 6; k++) {
            const angle = (k * Math.PI) / 3 + clock * 1.5;
            const radius = 30 + 8 * Math.sin(clock * 5 + k);
            const size = 3 + 3 * Math.abs(Math.sin(clock * 6 + k * 1.7));
            const star_x = screen_x + radius * Math.cos(angle);
            const star_y = screen_y + radius * Math.sin(angle);
            context.beginPath();
            for (let i = 0; i < 8; i++) {
                const spike = i % 2 === 0 ? size : size * 0.35;
                context.lineTo(star_x + spike * Math.cos((i * Math.PI) / 4), star_y + spike * Math.sin((i * Math.PI) / 4));
            }
            context.closePath();
            context.fill();
        }
        context.restore();
    }

    /* freezeAt: pause main.js and pin its time exactly (the timeline snaps to 0.01 s) */
    function freezeAt(main_time, playing) {
        if (playing) {
            document.getElementById("play_pause_button").click();
        }
        const timeline = document.getElementById("timeline");
        const grid_step = timeline.step;
        timeline.step = "any";
        timeline.value = String(main_time);
        timeline.dispatchEvent(new Event("input"));
        timeline.step = grid_step;
    }

    /* resolveRun: the event has been reached — celebrate, or freeze the clock and let
       the failure play out with the game's own (slow-motion) clock */
    function resolveRun(context, state, playing, bucket_rotation) {
        run.resolved = true;
        run.after = 0;
        if (run.outcome === "success") {
            goals += 1;
            const milestone_index = MILESTONES.indexOf(goals);
            spawnConfetti(context.canvas.width, milestone_index >= 0 ? 260 : 150);
            launchRockets(context.canvas.width, context.canvas.height, milestone_index >= 0 ? 7 : 3);
            flash = { color: "255, 213, 79", alpha: milestone_index >= 0 ? 0.45 : 0.25 };
            teacher_pose = "cheer";
            showBanner("success", text("success_title"), text("success_sub"), milestone_index >= 0 ? text("milestone_banner", { n: milestone_index + 1 }) : null);
            sequence = { kind: "success", remaining: SUCCESS_SEQUENCE_SECONDS };
            updatePanel();
            return;
        }
        freezeAt(run.main_time, playing);
        sequence = { kind: "fail", remaining: FAIL_SEQUENCE_SECONDS };
        if (run.outcome === "water_fell") {
            teacher_pose = "scared";
            flash = { color: "30, 136, 229", alpha: 0.3 };
            showBanner("water", text("water_title"), text("water_sub", { cause: text(`cause_water_${challenge.variable}`) }));
        } else if (run.outcome === "rope_broke") {
            bucket_on_rope = false;
            teacher_pose = "scared";
            launchFlyer(state, bucket_rotation);
            flash = { color: "229, 57, 53", alpha: 0.35 };
            showBanner("broke", text("broke_title"), text("broke_sub", { cause: text(`cause_rope_${challenge.variable}`) }));
            shakeCanvas();
        } else if (run.outcome === "underfilled") {
            teacher_pose = "shrug";
            showBanner("slow", text("underfilled_title"), text("underfilled_sub"));
        } else {
            teacher_pose = "shrug";
            showBanner("slow", text("slow_title"), text("slow_sub"));
        }
        updatePanel();
    }

    /* overlay: called by main.js at the end of every frame; repaints the whole scene,
       main.js time t being the clock: wind-up for t < T_w, free swing afterwards */
    function overlay(context, transform, payload) {
        if (!game_active) {
            last_overlay_milliseconds = null;
            return;
        }
        const now_milliseconds = performance.now();
        const delta_seconds = last_overlay_milliseconds === null
            ? 0
            : Math.min((now_milliseconds - last_overlay_milliseconds) / 1000, 0.05);
        last_overlay_milliseconds = now_milliseconds;
        clock += delta_seconds;

        const { launch_speed, radius, mass } = params();
        const swing_data = currentSwing();
        const windup_duration = windupDuration(radius, launch_speed);
        const playing = payload.time !== previous_time;

        if (payload.time > 0 && previous_time === 0 && run === null) {
            const event = evaluateSwing(challenge, game_value);
            const event_time = event.outcome === "too_slow" ? 0 : swingTimeAtAngle(swing_data, event.theta);
            run = { ...event, swing_time: event_time, main_time: windup_duration + event_time, resolved: false };
            attempts += 1;
            teacher_pose = "idle";
            updatePanel();
        }
        if (payload.time === 0 && run !== null && sequence === null) {
            run = null;
            bucket_water = 1;
            teacher_pose = "idle";
        }

        let angles;
        let driven = false;
        if (run !== null && run.resolved) {
            run.after += delta_seconds * SLOW_MOTION;
            const keeps_swinging = run.outcome === "success" || run.outcome === "water_fell" || run.outcome === "underfilled";
            angles = swingAt(swing_data, keeps_swinging ? run.swing_time + run.after : run.swing_time);
        } else if (payload.time < windup_duration) {
            angles = windupAt(radius, launch_speed, payload.time);
            driven = true;
        } else {
            angles = swingAt(swing_data, payload.time - windup_duration);
        }
        const state = bucketState(radius, angles.theta, angles.omega);
        state.max_force = Math.max(challenge.gravity, launch_speed ** 2 / radius + 3 * challenge.gravity);
        state.max_speed = Math.max(Math.sqrt(launch_speed ** 2 + 2 * challenge.gravity * radius), 1e-9);

        const geometry = layout();
        if (run !== null && !run.resolved && !driven) {
            if (teacher_pose === "idle" && state.y > 1.5 * radius) {
                teacher_pose = "scared";
            } else if (teacher_pose === "scared" && state.y < radius) {
                teacher_pose = "idle";
            }
        }

        const bucket_width = drawScene(context, transform, geometry, state, driven);
        const tension = driven || !bucket_on_rope ? 0 : Math.max(state.tension_per_mass * mass, 0);
        panel_elements.cards.load.value.textContent = driven ? "—" : `${formatValue(tension)} / ${challenge.tension_max} N`;
        panel_elements.gauge_fill.style.width = `${Math.min(100, (100 * tension) / challenge.tension_max)}%`;

        if (run !== null && !run.resolved && payload.time >= run.main_time - 1e-9) {
            const event_angles = run.outcome === "too_slow"
                ? windupAt(radius, launch_speed, windup_duration)
                : swingAt(swing_data, run.swing_time);
            const event_state = bucketState(radius, event_angles.theta, event_angles.omega);
            const hand_x = ARM_LENGTH * Math.sin(event_state.theta);
            const hand_y = radius - ARM_LENGTH * Math.cos(event_state.theta);
            const rotation = openingRotation(
                transform.toScreenX(hand_x) - transform.toScreenX(event_state.x),
                transform.toScreenY(hand_y) - transform.toScreenY(event_state.y),
            );
            resolveRun(context, event_state, playing, rotation);
        }
        if (run !== null && run.resolved && run.outcome === "water_fell" && bucket_water > 0) {
            const share = Math.min(delta_seconds * SLOW_MOTION / WATER_EMISSION_SECONDS, bucket_water);
            emitWater(state, Math.ceil(share * 90));
            bucket_water = Math.max(bucket_water - share, 0);
        }
        if (run !== null && run.resolved && run.outcome === "success") {
            drawSparkles(context, transform.toScreenX(state.x), transform.toScreenY(state.y));
        }
        previous_time = payload.time;

        updateWater(context, transform, delta_seconds, geometry);
        updateFlyer(context, transform, delta_seconds, geometry, bucket_width);
        drawHat(context, transform, geometry, delta_seconds, bucket_width);
        updateDrying(transform, delta_seconds, geometry);
        updateParticles(context, delta_seconds);
        drawFlash(context, delta_seconds);
        drawBanner(context, delta_seconds);

        if (sequence !== null) {
            sequence.remaining -= delta_seconds;
            const effects_done = water_drops.length === 0 && (flyer === null || flyer.phase === "hat");
            if (sequence.remaining <= 0 && effects_done) {
                const finished = sequence.kind;
                sequence = null;
                if (finished === "success") {
                    newChallenge();
                } else {
                    resetRun();
                }
            }
        }
    }

    /* follow language changes made by main.js (it sets <html lang> on toggle) */
    new MutationObserver(updatePanel).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
    });

    /* in game mode, any parameter change resets the run to t = 0 */
    document.getElementById("parameter_rows").addEventListener("input", () => {
        if (game_active && sequence === null) {
            run = null;
            bucket_water = 1;
            teacher_pose = "idle";
            document.getElementById("reset_button").click();
        }
    });

    buildUi();
    updatePanel();
    globalThis.loop_game_overlay = overlay;
    /* fit-view extent for main.js: the swing circle, the whole teacher and room for the banner */
    globalThis.loop_game_view_extent = () => (game_active
        ? {
            left: -params().radius - 0.7,
            right: params().radius + 0.7,
            bottom: params().radius - SHOULDER_HEIGHT - 0.15,
            top: 2 * params().radius + 1.1,
        }
        : null);
})();
