/*
 * calcul.js — Charged sphere on a massless thread between two vertical
 * parallel insulating plates of surface charge densities +σ and −σ. The two
 * infinite plates create a uniform horizontal field E = σ/ε₀ between them
 * (σ/(2ε₀) each, adding up), pointing from +σ to −σ, and the potential
 * difference across the gap L is ΔV = E·L. Static equilibrium of the sphere
 * (weight m·g down, horizontal electric force q·E, thread tension T along the
 * thread at angle φ from the vertical) gives tan φ = q·E/(m·g), so
 * E = m·g·tan φ/q, ΔV = E·L and T = m·g/cos φ. A negative ΔV (reversed
 * polarity) simply gives a negative deflection angle. SI units.
 * Classic script (works via file://); exposes globalThis.charged_pendulum_calcul.
 */
(() => {
    const VACUUM_PERMITTIVITY = 8.854e-12;

    /* electricField: uniform field between the plates, E = ΔV/L (signed) */
    function electricField(potential_difference, plate_distance) {
        return potential_difference / plate_distance;
    }

    /* fieldFromAngle: E making the thread settle at φ, from tan φ = q·E/(m·g) */
    function fieldFromAngle(mass, gravity, angle_radians, charge) {
        return mass * gravity * Math.tan(angle_radians) / charge;
    }

    /* potentialFromAngle: ΔV = E·L for the field that holds the angle φ */
    function potentialFromAngle(mass, gravity, angle_radians, charge, plate_distance) {
        return fieldFromAngle(mass, gravity, angle_radians, charge) * plate_distance;
    }

    /* equilibriumAngle: φ = atan(q·E/(m·g)) (signed, radians) */
    function equilibriumAngle(charge, field, mass, gravity) {
        return Math.atan(charge * field / (mass * gravity));
    }

    /* electricForce: F_e = q·E (signed, horizontal) */
    function electricForce(charge, field) {
        return charge * field;
    }

    /* threadTension: T = m·g/cos φ (the thread carries weight plus deflection) */
    function threadTension(mass, gravity, angle_radians) {
        return mass * gravity / Math.cos(angle_radians);
    }

    /* surfaceChargeDensity: |σ| = ε₀·|E| for the pair of plates */
    function surfaceChargeDensity(field) {
        return VACUUM_PERMITTIVITY * Math.abs(field);
    }

    globalThis.charged_pendulum_calcul = {
        VACUUM_PERMITTIVITY,
        electricField,
        fieldFromAngle,
        potentialFromAngle,
        equilibriumAngle,
        electricForce,
        threadTension,
        surfaceChargeDensity,
    };
})();
