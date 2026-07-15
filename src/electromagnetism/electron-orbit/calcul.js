/*
 * calcul.js — Average current of the orbiting electron (classical Bohr
 * picture): the electron describes a circle of radius R at constant speed v,
 * so the same charge e crosses any section of the "wire" once per period
 * T = 2πR/v, giving the average current I = e/T = e·v/(2πR) — the course
 * question (≈ 1.06 mA for R = 53 pm and v = 2200 km/s). Derived quantities:
 * revolution frequency f = 1/T, angular velocity ω = v/R, centripetal
 * acceleration a = v²/R, the charge N·e that has crossed the gate after N
 * completed turns (a staircase whose slope is the average current), the
 * magnetic moment µ = I·π·R² of the current loop (≈ the Bohr magneton) and
 * the field B = µ₀·I/(2R) at the center. The conventional current runs
 * OPPOSITE to the electron's motion (negative charge). SI units.
 * Classic script (works via file://); exposes globalThis.electron_orbit_calcul.
 */
(() => {
    const ELEMENTARY_CHARGE = 1.602e-19;
    const VACUUM_PERMEABILITY = 4 * Math.PI * 1e-7;
    const BOHR_MAGNETON = 9.274e-24;
    const COULOMB_CONSTANT = 8.988e9;

    /* period: T = 2πR/v (time for the charge e to pass once) */
    function period(radius, speed) {
        return 2 * Math.PI * radius / speed;
    }

    /* frequency: f = 1/T = v/(2πR) revolutions per second */
    function frequency(radius, speed) {
        return speed / (2 * Math.PI * radius);
    }

    /* averageCurrent: the course answer, I = e/T = e·v/(2πR) */
    function averageCurrent(radius, speed) {
        return ELEMENTARY_CHARGE * speed / (2 * Math.PI * radius);
    }

    /* angularVelocity: ω = v/R */
    function angularVelocity(radius, speed) {
        return speed / radius;
    }

    /* centripetalAcceleration: a = v²/R toward the nucleus */
    function centripetalAcceleration(radius, speed) {
        return speed * speed / radius;
    }

    /* completedTurns: gate crossings after a time (electron starts AT the gate) */
    function completedTurns(radius, speed, time) {
        return Math.max(Math.floor(time / period(radius, speed) + 1e-9), 0);
    }

    /* chargePassed: Q = N·e, the staircase whose average slope is I */
    function chargePassed(radius, speed, time) {
        return completedTurns(radius, speed, time) * ELEMENTARY_CHARGE;
    }

    /* magneticMoment: µ = I·π·R² of the equivalent current loop */
    function magneticMoment(radius, speed) {
        return averageCurrent(radius, speed) * Math.PI * radius * radius;
    }

    /* centerField: B = µ₀·I/(2R) at the center of the loop */
    function centerField(radius, speed) {
        return VACUUM_PERMEABILITY * averageCurrent(radius, speed) / (2 * radius);
    }

    /* coulombForce: attraction k·e²/R² holding the electron on its orbit */
    function coulombForce(radius) {
        return COULOMB_CONSTANT * ELEMENTARY_CHARGE * ELEMENTARY_CHARGE / (radius * radius);
    }

    globalThis.electron_orbit_calcul = {
        ELEMENTARY_CHARGE,
        VACUUM_PERMEABILITY,
        BOHR_MAGNETON,
        COULOMB_CONSTANT,
        period,
        frequency,
        averageCurrent,
        angularVelocity,
        centripetalAcceleration,
        completedTurns,
        chargePassed,
        magneticMoment,
        centerField,
        coulombForce,
    };
})();
