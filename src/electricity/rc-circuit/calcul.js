/*
 * calcul.js — RC circuit: an ideal battery E charges a capacitor C through a
 * resistor R (charge mode), or the charged capacitor empties through the same
 * resistor (discharge mode). The mesh law E = R·i + u_C with i = C·du_C/dt
 * gives exact exponentials with the time constant τ = R·C (ohms × farads =
 * seconds): charging, u_C(t) = E·(1 − e^(−t/τ)) and i(t) = (E/R)·e^(−t/τ);
 * discharging from E, u_C(t) = E·e^(−t/τ) and i(t) = −(E/R)·e^(−t/τ). At
 * t = τ the capacitor is at 63.2 % (charge) or 36.8 % (discharge); at 5τ the
 * regime is established (99.3 %). Energy: the capacitor stores ½·C·u², the
 * battery supplies E·q = C·E·u while charging, and the resistor dissipates
 * the difference ½·C·E²·(1 − e^(−2t/τ)) — HALF the supplied energy in total,
 * whatever R. triggerTime inverts the charge law: u_C reaches a threshold at
 * t = τ·ln(E/(E − u_s)). SI units.
 * Classic script (works via file://); exposes globalThis.rc_circuit_calcul.
 */
(() => {
    /* timeConstant: τ = R·C (the Ω·F = s classic) */
    function timeConstant(resistance, capacitance) {
        return resistance * capacitance;
    }

    /* chargeVoltage: u_C(t) = E·(1 − e^(−t/τ)) */
    function chargeVoltage(emf, time_constant, time) {
        return emf * (1 - Math.exp(-time / time_constant));
    }

    /* dischargeVoltage: u_C(t) = E·e^(−t/τ), starting fully charged */
    function dischargeVoltage(emf, time_constant, time) {
        return emf * Math.exp(-time / time_constant);
    }

    /* chargeCurrent: i(t) = (E/R)·e^(−t/τ), maximal at t = 0 */
    function chargeCurrent(emf, resistance, time_constant, time) {
        return (emf / resistance) * Math.exp(-time / time_constant);
    }

    /* dischargeCurrent: i(t) = −(E/R)·e^(−t/τ) (reversed direction) */
    function dischargeCurrent(emf, resistance, time_constant, time) {
        return -(emf / resistance) * Math.exp(-time / time_constant);
    }

    /* capacitorCharge: q = C·u_C */
    function capacitorCharge(capacitance, voltage) {
        return capacitance * voltage;
    }

    /* storedEnergy: E_C = ½·C·u² */
    function storedEnergy(capacitance, voltage) {
        return capacitance * voltage * voltage / 2;
    }

    /* suppliedEnergy: E·q = C·E·u delivered by the battery while charging */
    function suppliedEnergy(emf, capacitance, voltage) {
        return capacitance * emf * voltage;
    }

    /* dissipatedEnergy: heat in R — supplied minus stored while charging,
       initial stock minus remaining while discharging */
    function dissipatedEnergy(emf, capacitance, voltage, discharging) {
        if (discharging) {
            return storedEnergy(capacitance, emf) - storedEnergy(capacitance, voltage);
        }
        return suppliedEnergy(emf, capacitance, voltage) - storedEnergy(capacitance, voltage);
    }

    /* triggerTime: instant the charging capacitor reaches a threshold,
       t = τ·ln(E/(E − u_s)) — Infinity when the threshold is unreachable */
    function triggerTime(emf, time_constant, threshold) {
        if (threshold >= emf) {
            return Infinity;
        }
        return time_constant * Math.log(emf / (emf - threshold));
    }

    globalThis.rc_circuit_calcul = {
        timeConstant,
        chargeVoltage,
        dischargeVoltage,
        chargeCurrent,
        dischargeCurrent,
        capacitorCharge,
        storedEnergy,
        suppliedEnergy,
        dissipatedEnergy,
        triggerTime,
    };
})();
