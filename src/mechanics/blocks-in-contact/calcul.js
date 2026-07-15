/*
 * calcul.js — Two blocks in contact pushed on a frictionless horizontal
 * surface. A force of module F acts on the rear block; both blocks share the
 * acceleration a = F/(mA + mB). Isolating the FRONT block, the only horizontal
 * force is the contact force from the rear block, so the action–reaction pair
 * has module F_contact = m_front·a = m_front·F/(mA + mB): swapping the blocks
 * changes m_front and therefore the contact force, while a is unchanged. The
 * net horizontal force on any block is m·a; vertically N = m·g balances the
 * weight (ΣF_y = 0). Starting from rest the motion is MRUA: x = a·t²/2,
 * v = a·t. SI units.
 * Classic script (works via file://); exposes globalThis.blocks_contact_calcul.
 */
(() => {
    /* accelerationModule: a = F/(mA + mB) — the blocks move together */
    function accelerationModule(force, mass_a, mass_b) {
        return force / (mass_a + mass_b);
    }

    /* contactForceModule: |F_contact| = m_front·a (action = reaction) */
    function contactForceModule(force, front_mass, mass_a, mass_b) {
        return front_mass * accelerationModule(force, mass_a, mass_b);
    }

    /* netForceModule: |ΣF| = m·a on any block of the pair */
    function netForceModule(mass, acceleration) {
        return mass * acceleration;
    }

    /* normalForce: N = m·g (vertical equilibrium on the horizontal surface) */
    function normalForce(mass, gravity) {
        return mass * gravity;
    }

    /* positionAt: displacement x(t) = a·t²/2 (MRUA from rest) */
    function positionAt(acceleration, time) {
        return acceleration * time * time / 2;
    }

    /* velocityAt: v(t) = a·t */
    function velocityAt(acceleration, time) {
        return acceleration * time;
    }

    /* travelTime: time to cover a distance from rest, Infinity when a ≤ 0 */
    function travelTime(distance, acceleration) {
        if (acceleration <= 0) {
            return Infinity;
        }
        return Math.sqrt(2 * distance / acceleration);
    }

    globalThis.blocks_contact_calcul = {
        accelerationModule,
        contactForceModule,
        netForceModule,
        normalForce,
        positionAt,
        velocityAt,
        travelTime,
    };
})();
