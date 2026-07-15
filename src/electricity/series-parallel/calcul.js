/*
 * calcul.js — Series versus parallel resistor combinations on an ideal DC
 * source (no internal resistance, ideal wires, ohmic resistors, steady state).
 * Series: the same current I = V/R_eq flows through every resistor,
 * R_eq = Σ R_k, and the voltages U_k = R_k·I add up to V (mesh law).
 * Parallel: every branch sees the full voltage V, the branch currents
 * I_k = V/R_k add up at the node (node law), and 1/R_eq = Σ 1/R_k, so
 * R_eq(series) ≥ max(R_k) while R_eq(parallel) ≤ min(R_k).
 * Power dissipated: P = U·I = R·I² = U²/R — chainPowers, parallelPowers and
 * mixedPowers give the per-resistor powers of the three classic layouts
 * (used by the brightness game: brightness grows with power). SI units.
 * Classic script (works via file://); exposes globalThis.series_parallel_calcul.
 */
(() => {
    /* seriesResistance: R_eq = Σ R_k */
    function seriesResistance(resistances) {
        return resistances.reduce((sum, resistance) => sum + resistance, 0);
    }

    /* parallelResistance: 1/R_eq = Σ 1/R_k */
    function parallelResistance(resistances) {
        return 1 / resistances.reduce((sum, resistance) => sum + 1 / resistance, 0);
    }

    /* currentFromVoltage: Ohm's law, I = V/R */
    function currentFromVoltage(voltage, resistance) {
        return voltage / resistance;
    }

    /* seriesVoltages: U_k = R_k·I with the common series current */
    function seriesVoltages(voltage, resistances) {
        const current = currentFromVoltage(voltage, seriesResistance(resistances));
        return resistances.map((resistance) => resistance * current);
    }

    /* parallelCurrents: I_k = V/R_k, each branch under the full voltage */
    function parallelCurrents(voltage, resistances) {
        return resistances.map((resistance) => currentFromVoltage(voltage, resistance));
    }

    /* power: P = U·I */
    function power(voltage, current) {
        return voltage * current;
    }

    /* chainPowers: three resistors in series — P_k = R_k·I² (grows with R) */
    function chainPowers(voltage, resistances) {
        const current = currentFromVoltage(voltage, seriesResistance(resistances));
        return resistances.map((resistance) => resistance * current * current);
    }

    /* parallelPowers: three resistors in parallel — P_k = V²/R_k (shrinks with R) */
    function parallelPowers(voltage, resistances) {
        return resistances.map((resistance) => voltage * voltage / resistance);
    }

    /* mixedPowers: resistances[0] in series with (resistances[1] ∥ resistances[2]);
       returns the powers in the same order */
    function mixedPowers(voltage, resistances) {
        const pair_resistance = parallelResistance([resistances[1], resistances[2]]);
        const total_current = currentFromVoltage(voltage, resistances[0] + pair_resistance);
        const pair_voltage = pair_resistance * total_current;
        return [
            resistances[0] * total_current * total_current,
            pair_voltage * pair_voltage / resistances[1],
            pair_voltage * pair_voltage / resistances[2],
        ];
    }

    globalThis.series_parallel_calcul = {
        seriesResistance,
        parallelResistance,
        currentFromVoltage,
        seriesVoltages,
        parallelCurrents,
        power,
        chainPowers,
        parallelPowers,
        mixedPowers,
    };
})();
