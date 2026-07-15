/*
 * calcul.js — Statics of a hanging sign: rigid horizontal bar on a wall pivot,
 * held by a cable, with a sign hanging from two hooks.
 * Model: bar of mass m2 and length L, pivot at the left end (origin), cable
 * from the right end to the wall making an angle theta with the WALL (the
 * vertical), so its components at the bar end are T·sin(theta) toward the wall
 * and T·cos(theta) upward. A uniform sign of mass m1 hangs from two hooks
 * symmetric about the sign's middle, so each hook carries m1·g/2. Equilibrium
 * of the bar (formulary: Σ F⃗ᵢ = 0 and Σ Mᵢ = 0, M = F·r):
 *   moments about the pivot:  T·cos(theta)·L = m2·g·L/2 + (m1·g/2)·(x_left + x_right)
 *   forces:                   R_x = T·sin(theta),  R_y = (m1+m2)·g − T·cos(theta)
 * All SI units, angles in radians. Classic script (works via file://);
 * exposes globalThis.statics_calcul.
 */
(() => {
    const EDGE_MARGIN = 0.02;

    /* degToRad: convert an angle from degrees to radians */
    function degToRad(angle_degrees) {
        return angle_degrees * Math.PI / 180;
    }

    /* hookPositions: hook abscissas from the sign center and spacing, kept on the bar */
    function hookPositions(length, sign_center, spacing) {
        const clamp = (value) => Math.min(Math.max(value, EDGE_MARGIN), length - EDGE_MARGIN);
        return {
            left: clamp(sign_center - spacing / 2),
            right: clamp(sign_center + spacing / 2),
        };
    }

    /* cableTension: from the moment balance about the pivot */
    function cableTension(sign_mass, bar_mass, length, angle_from_wall, hook_left, hook_right, gravity) {
        const load_moment = bar_mass * gravity * length / 2
            + (sign_mass * gravity / 2) * (hook_left + hook_right);
        return load_moment / (length * Math.cos(angle_from_wall));
    }

    /* pivotForceX: horizontal pivot reaction (away from the wall) */
    function pivotForceX(tension, angle_from_wall) {
        return tension * Math.sin(angle_from_wall);
    }

    /* pivotForceY: vertical pivot reaction (upward) */
    function pivotForceY(sign_mass, bar_mass, tension, angle_from_wall, gravity) {
        return (sign_mass + bar_mass) * gravity - tension * Math.cos(angle_from_wall);
    }

    /* forceMagnitude: |F| from components */
    function forceMagnitude(force_x, force_y) {
        return Math.hypot(force_x, force_y);
    }

    globalThis.statics_calcul = {
        EDGE_MARGIN,
        degToRad,
        hookPositions,
        cableTension,
        pivotForceX,
        pivotForceY,
        forceMagnitude,
    };
})();
