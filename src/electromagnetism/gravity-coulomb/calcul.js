/*
 * calcul.js — Two identical bodies (mass m, charge of absolute value q each)
 * alone in deep space, interacting only through gravity and the Coulomb force.
 * Both forces scale as 1/d², so the net force is C/d² with the constant
 * coefficient C = G·m² − s·k·q² (s = +1 for same-sign charges, −1 for opposite
 * signs; C > 0 means net attraction). Equilibrium requires k·q² = G·m², i.e.
 * q = m·√(G/k), independent of the distance — and same-sign charges, so the
 * electric repulsion opposes the gravitational attraction.
 * Released at rest the bodies move radially; with the relative separation d(t)
 * obeying d̈ = −μ/d² (μ = 2C/m), the motion has the exact Kepler radial-fall
 * solution t(d) (cycloid form when attractive, hyperbolic form when repulsive),
 * inverted numerically by bisection. SI units throughout.
 * Classic script (works via file://); exposes globalThis.gravity_coulomb_calcul.
 */
(() => {
    const GRAVITATIONAL_CONSTANT = 6.674e-11;
    const COULOMB_CONSTANT = 8.988e9;
    const ELEMENTARY_CHARGE = 1.602e-19;
    const BISECTION_ITERATIONS = 60;

    /* gravityForce: F_g = G·m·m/d² (always attractive) */
    function gravityForce(mass, distance) {
        return GRAVITATIONAL_CONSTANT * mass * mass / (distance * distance);
    }

    /* coulombForce: F_e = k·q·q/d² (magnitude) */
    function coulombForce(charge, distance) {
        return COULOMB_CONSTANT * charge * charge / (distance * distance);
    }

    /* forceCoefficient: C such that the net attraction is C/d²;
       same-sign charges repel (C = G·m² − k·q²), opposite signs attract (+) */
    function forceCoefficient(mass, charge, same_signs) {
        const sign_factor = same_signs ? 1 : -1;
        return GRAVITATIONAL_CONSTANT * mass * mass - sign_factor * COULOMB_CONSTANT * charge * charge;
    }

    /* netAttraction: signed net force on each body along the joining line,
       positive = pulled toward the other body */
    function netAttraction(mass, charge, same_signs, distance) {
        return forceCoefficient(mass, charge, same_signs) / (distance * distance);
    }

    /* equilibriumCharge: q solving k·q² = G·m², i.e. q = m·√(G/k) —
       independent of the separation */
    function equilibriumCharge(mass) {
        return mass * Math.sqrt(GRAVITATIONAL_CONSTANT / COULOMB_CONSTANT);
    }

    /* elementaryChargeCount: number of protons or electrons carrying |q| */
    function elementaryChargeCount(charge) {
        return Math.abs(charge) / ELEMENTARY_CHARGE;
    }

    /* relativeMu: μ in d̈ = −μ/d² for the separation d of the two bodies
       (each body feels C/d² and they close in symmetrically, hence the factor 2) */
    function relativeMu(mass, charge, same_signs) {
        return 2 * forceCoefficient(mass, charge, same_signs) / mass;
    }

    /* separationTime: exact time for the separation to evolve from
       initial_distance (at rest) to target_distance under d̈ = −μ/d².
       Attractive (μ > 0, d decreases): cycloid solution
       t = √(d₀³/(2μ))·[arccos(√(d/d₀)) + √((d/d₀)(1 − d/d₀))].
       Repulsive (μ < 0, d increases): hyperbolic solution
       t = √(d₀/(2ν))·[√(d(d − d₀)) + d₀·ln((√d + √(d − d₀))/√d₀)], ν = −μ. */
    function separationTime(initial_distance, mu, target_distance) {
        if (mu > 0) {
            const ratio = Math.min(Math.max(target_distance / initial_distance, 0), 1);
            const root = Math.sqrt(ratio);
            return Math.sqrt(initial_distance ** 3 / (2 * mu))
                * (Math.acos(root) + root * Math.sqrt(1 - ratio));
        }
        if (mu < 0) {
            const distance = Math.max(target_distance, initial_distance);
            const excess = distance - initial_distance;
            return Math.sqrt(initial_distance / (2 * -mu))
                * (Math.sqrt(distance * excess)
                    + initial_distance * Math.log((Math.sqrt(distance) + Math.sqrt(excess)) / Math.sqrt(initial_distance)));
        }
        return target_distance === initial_distance ? 0 : Infinity;
    }

    /* contactTime: time until the surfaces touch (d = contact_distance),
       Infinity when the bodies do not approach */
    function contactTime(initial_distance, mu, contact_distance) {
        if (mu <= 0) {
            return Infinity;
        }
        return separationTime(initial_distance, mu, Math.min(contact_distance, initial_distance));
    }

    /* separationAt: d(t) by bisection on the monotonic exact t(d) */
    function separationAt(initial_distance, mu, time) {
        if (time <= 0 || mu === 0) {
            return initial_distance;
        }
        if (mu > 0) {
            if (time >= separationTime(initial_distance, mu, 0)) {
                return 0;
            }
            let lower = 0;
            let upper = initial_distance;
            for (let i = 0; i < BISECTION_ITERATIONS; i++) {
                const middle = (lower + upper) / 2;
                if (separationTime(initial_distance, mu, middle) > time) {
                    lower = middle;
                } else {
                    upper = middle;
                }
            }
            return (lower + upper) / 2;
        }
        let lower = initial_distance;
        let upper = initial_distance * 2 + Math.sqrt(2 * -mu / initial_distance) * time;
        while (separationTime(initial_distance, mu, upper) < time) {
            upper *= 2;
        }
        for (let i = 0; i < BISECTION_ITERATIONS; i++) {
            const middle = (lower + upper) / 2;
            if (separationTime(initial_distance, mu, middle) < time) {
                lower = middle;
            } else {
                upper = middle;
            }
        }
        return (lower + upper) / 2;
    }

    /* relativeSpeed: |ḋ| from energy conservation, ḋ² = 2μ(1/d − 1/d₀)
       (valid for both signs of μ: the product stays non-negative on the
       reachable side of d₀) */
    function relativeSpeed(initial_distance, mu, distance) {
        return Math.sqrt(Math.max(2 * mu * (1 / distance - 1 / initial_distance), 0));
    }

    /* separationRate: signed ḋ — negative while the bodies approach */
    function separationRate(initial_distance, mu, distance) {
        return -Math.sign(mu) * relativeSpeed(initial_distance, mu, distance);
    }

    /* relativeAcceleration: signed d̈ = −μ/d² */
    function relativeAcceleration(mu, distance) {
        return -mu / (distance * distance);
    }

    globalThis.gravity_coulomb_calcul = {
        GRAVITATIONAL_CONSTANT,
        COULOMB_CONSTANT,
        ELEMENTARY_CHARGE,
        gravityForce,
        coulombForce,
        forceCoefficient,
        netAttraction,
        equilibriumCharge,
        elementaryChargeCount,
        relativeMu,
        separationTime,
        contactTime,
        separationAt,
        relativeSpeed,
        separationRate,
        relativeAcceleration,
    };
})();
