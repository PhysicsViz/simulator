/*
 * calcul.js — Charged particle in the uniform field of infinite plates.
 * Model: point particle of charge q and mass m between two horizontal infinite
 * plates (bottom plate at y = 0, optional top plate at y = gap). Each infinite
 * plate creates a uniform field E = sigma/(2*epsilon0); the parameters are the
 * algebraic field contributions along +y, so the total field is their sum.
 * Weight is neglected (electric force dominates), therefore the motion is MRU
 * horizontally (u(t) = u0) and MRUA vertically with a = q*E/m, launched with no
 * vertical velocity from height y0. SI units (charge in coulombs).
 * Classic script (works via file://); exposes globalThis.charged_particle_calcul.
 */
(() => {
    /* totalField: algebraic sum of the plate contributions along +y */
    function totalField(field_1, field_2) {
        return field_1 + field_2;
    }

    /* electricForce: F_y = q·E (algebraic, along +y) */
    function electricForce(charge, field) {
        return charge * field;
    }

    /* acceleration: a_y = q·E / m (weight neglected) */
    function acceleration(charge, field, mass) {
        return charge * field / mass;
    }

    /* positionX: x(t) = u0·t + x0, with x0 = 0 (MRU) */
    function positionX(initial_horizontal_speed, time) {
        return initial_horizontal_speed * time;
    }

    /* positionY: y(t) = a·t²/2 + y0 (MRUA, v0y = 0) */
    function positionY(initial_height, acceleration_y, time) {
        return initial_height + acceleration_y * time * time / 2;
    }

    /* velocityY: v(t) = a·t */
    function velocityY(acceleration_y, time) {
        return acceleration_y * time;
    }

    /* impactTime: time until the particle hits a plate (y = 0 or y = gap),
       Infinity when a = 0 (straight flight) */
    function impactTime(initial_height, acceleration_y, gap) {
        if (acceleration_y > 0) {
            return Math.sqrt(2 * (gap - initial_height) / acceleration_y);
        }
        if (acceleration_y < 0) {
            return Math.sqrt(2 * initial_height / -acceleration_y);
        }
        return Infinity;
    }

    /* speedMagnitude: |v| = sqrt(u² + v²) */
    function speedMagnitude(velocity_x, velocity_y) {
        return Math.hypot(velocity_x, velocity_y);
    }

    globalThis.charged_particle_calcul = {
        totalField,
        electricForce,
        acceleration,
        positionX,
        positionY,
        velocityY,
        impactTime,
        speedMagnitude,
    };
})();
