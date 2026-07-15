/*
 * calcul.js — Coaxial cable / cylindrical capacitor (Gauss + potential).
 * Model: inner metal cylinder of radius a carrying +lambda per unit length,
 * outer metal tube of radius b carrying −lambda (or nothing, for the "uncharged
 * tube" question). Infinite-length approximation (edge effects neglected); the
 * length L only enters the capacitance and the stored energy. By Gauss's
 * theorem (formulary: ∮ E·dS = Σq/ε₀):
 *   E(r) = λ/(2πε₀·r) for a ≤ r ≤ b, 0 inside the metal (r < a); for r > b the
 *   field is 0 when the tube carries −λ and λ/(2πε₀·r) when it is uncharged.
 * Potential with the imposed reference V(b) = 0:
 *   V(r) = λ/(2πε₀)·ln(b/r) between, constant V(a) inside, and beyond b either
 *   0 (charged tube) or −λ/(2πε₀)·ln(r/b) (uncharged tube). The difference
 *   V(a) − V(b) = λ/(2πε₀)·ln(b/a) does NOT depend on the tube's charge.
 * Boundary condition at a conductor: E = σ/ε₀ with σ_a = λ/(2πa).
 * Energy density u = ε₀·E²/2; capacitance C = 2πε₀·L/ln(b/a) (geometry only);
 * stored energy U = ½·C·(ΔV)². SI units throughout.
 * Classic script (works via file://); exposes globalThis.coaxial_calcul.
 */
(() => {
    const VACUUM_PERMITTIVITY = 8.854e-12;
    const TWO_PI_EPSILON = 2 * Math.PI * VACUUM_PERMITTIVITY;

    /* fieldAt: |E|(r) with sign along +r (lambda > 0 → outward) */
    function fieldAt(lambda, radius_a, radius_b, r, outer_charged) {
        if (r < radius_a) {
            return 0;
        }
        if (r > radius_b && outer_charged) {
            return 0;
        }
        return lambda / (TWO_PI_EPSILON * r);
    }

    /* potentialAt: V(r) with the imposed reference V(b) = 0 */
    function potentialAt(lambda, radius_a, radius_b, r, outer_charged) {
        if (r >= radius_b) {
            return outer_charged ? 0 : -(lambda / TWO_PI_EPSILON) * Math.log(r / radius_b);
        }
        const clamped = Math.max(r, radius_a);
        return (lambda / TWO_PI_EPSILON) * Math.log(radius_b / clamped);
    }

    /* potentialDifference: V(a) − V(b) = λ/(2πε₀)·ln(b/a) */
    function potentialDifference(lambda, radius_a, radius_b) {
        return (lambda / TWO_PI_EPSILON) * Math.log(radius_b / radius_a);
    }

    /* surfaceChargeDensity: σ_a = λ/(2π·a) on the inner conductor */
    function surfaceChargeDensity(lambda, radius_a) {
        return lambda / (2 * Math.PI * radius_a);
    }

    /* energyDensity: u = ε₀·E²/2 */
    function energyDensity(field) {
        return VACUUM_PERMITTIVITY * field * field / 2;
    }

    /* capacitance: C = 2πε₀·L / ln(b/a) — geometry only */
    function capacitance(radius_a, radius_b, length) {
        return TWO_PI_EPSILON * length / Math.log(radius_b / radius_a);
    }

    /* storedEnergy: U = ½·C·(ΔV)² = λ²·L·ln(b/a)/(4πε₀) */
    function storedEnergy(lambda, radius_a, radius_b, length) {
        const difference = potentialDifference(lambda, radius_a, radius_b);
        return capacitance(radius_a, radius_b, length) * difference * difference / 2;
    }

    globalThis.coaxial_calcul = {
        VACUUM_PERMITTIVITY,
        fieldAt,
        potentialAt,
        potentialDifference,
        surfaceChargeDensity,
        energyDensity,
        capacitance,
        storedEnergy,
    };
})();
