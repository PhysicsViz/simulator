/*
 * calcul.js — Simple DC circuit: a real battery (EMF E with internal
 * resistance r) feeding a load resistance R through ideal wires, steady
 * state. Pouillet's law gives I = E/(r + R); the terminal voltage is
 * U = E − r·I = R·I; the load receives P_R = R·I² = U·I while r dissipates
 * P_r = r·I² and the battery delivers P = E·I, so the efficiency is
 * η = U/E = R/(R + r). The load power E²·R/(R + r)² peaks at R = r with
 * P_max = E²/(4r) (impedance matching); the extreme cases are the short
 * circuit I_cc = E/r (R = 0) and the open circuit U₀ = E (I = 0).
 * loadForPower inverts P(R): R² + (2r − E²/P)·R + r² = 0 gives the two load
 * values (one on each side of R = r) that dissipate a given power, and
 * internalFromPower deduces r from a measured pair (R, P) through I = √(P/R).
 * SI units.
 * Classic script (works via file://); exposes globalThis.simple_circuit_calcul.
 */
(() => {
    /* current: Pouillet's law, I = E/(r + R) */
    function current(emf, internal_resistance, load_resistance) {
        return emf / (internal_resistance + load_resistance);
    }

    /* terminalVoltage: U = E − r·I (what a voltmeter reads at the terminals) */
    function terminalVoltage(emf, internal_resistance, circuit_current) {
        return emf - internal_resistance * circuit_current;
    }

    /* loadPower: P_R = R·I² (received by the load) */
    function loadPower(load_resistance, circuit_current) {
        return load_resistance * circuit_current * circuit_current;
    }

    /* internalPower: P_r = r·I² (lost inside the battery) */
    function internalPower(internal_resistance, circuit_current) {
        return internal_resistance * circuit_current * circuit_current;
    }

    /* totalPower: P = E·I (delivered by the EMF) */
    function totalPower(emf, circuit_current) {
        return emf * circuit_current;
    }

    /* efficiency: η = R/(R + r) = U/E */
    function efficiency(load_resistance, internal_resistance) {
        return load_resistance / (load_resistance + internal_resistance);
    }

    /* maxLoadPower: P_max = E²/(4r), reached at R = r (impedance matching) */
    function maxLoadPower(emf, internal_resistance) {
        return emf * emf / (4 * internal_resistance);
    }

    /* shortCircuitCurrent: I_cc = E/r (R = 0) */
    function shortCircuitCurrent(emf, internal_resistance) {
        return emf / internal_resistance;
    }

    /* internalFromPower: r deduced from a measured pair (R, P) — the current
       is I = √(P/R), so r = E/I − R = E·√(R/P) − R */
    function internalFromPower(emf, load_resistance, power) {
        return emf * Math.sqrt(load_resistance / power) - load_resistance;
    }

    /* loadForPower: the two load resistances dissipating a given power, or
       null when the power exceeds P_max — roots of R² + (2r − E²/P)·R + r² */
    function loadForPower(emf, internal_resistance, power) {
        const linear_coefficient = 2 * internal_resistance - emf * emf / power;
        const discriminant = linear_coefficient * linear_coefficient
            - 4 * internal_resistance * internal_resistance;
        if (discriminant < 0) {
            return null;
        }
        const root = Math.sqrt(discriminant);
        return {
            low: (-linear_coefficient - root) / 2,
            high: (-linear_coefficient + root) / 2,
        };
    }

    globalThis.simple_circuit_calcul = {
        current,
        terminalVoltage,
        loadPower,
        internalPower,
        totalPower,
        efficiency,
        maxLoadPower,
        shortCircuitCurrent,
        internalFromPower,
        loadForPower,
    };
})();
