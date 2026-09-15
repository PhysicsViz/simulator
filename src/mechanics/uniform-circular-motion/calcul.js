/*
 * calcul.js — Uniform circular motion (MCU) kinematics, plus the vertical-circle
 * rope tension used by the bucket game.
 * Model: point mass on a circle of radius R at constant speed v; the angle theta
 * is measured from the +x axis, counterclockwise, so the top of the circle is
 * theta = pi/2. Course formulary notation: omega = v/R, v = R·omega, a_r =
 * −R·omega² = −v²/R (purely radial, toward the center, alpha = 0), net force
 * F = m·v²/R. For a bucket on a rope in a VERTICAL circle at constant speed,
 * the rope tension is T = m·(v²/R − g·sin(theta)) — maximal at the bottom
 * (theta = −pi/2), minimal at the top, where the water stays in iff
 * v ≥ sqrt(g·R). All SI units, angles in radians.
 * Classic script (works via file://); exposes globalThis.circular_motion_calcul.
 */
(() => {
    /* angularVelocity: omega = v / R */
    function angularVelocity(speed, radius) {
        return speed / radius;
    }

    /* angleAt: theta(t) = theta0 + omega·t (MCU: alpha = 0) */
    function angleAt(initial_angle, angular_velocity, time) {
        return initial_angle + angular_velocity * time;
    }

    /* positionX / positionY: x = R·cos(theta), y = R·sin(theta) */
    function positionX(radius, angle) {
        return radius * Math.cos(angle);
    }
    function positionY(radius, angle) {
        return radius * Math.sin(angle);
    }

    /* velocityX / velocityY: tangent vector of norm v */
    function velocityX(speed, angle) {
        return -speed * Math.sin(angle);
    }
    function velocityY(speed, angle) {
        return speed * Math.cos(angle);
    }

    /* accelerationX / accelerationY: centripetal, toward the center */
    function accelerationX(speed, radius, angle) {
        return -(speed * speed / radius) * Math.cos(angle);
    }
    function accelerationY(speed, radius, angle) {
        return -(speed * speed / radius) * Math.sin(angle);
    }

    /* centripetalAcceleration: a_r = v²/R = R·omega² */
    function centripetalAcceleration(speed, radius) {
        return speed * speed / radius;
    }

    /* centripetalForce: F = m·v²/R */
    function centripetalForce(mass, speed, radius) {
        return mass * speed * speed / radius;
    }

    /* period: T = 2·pi·R / v */
    function period(radius, speed) {
        return 2 * Math.PI * radius / speed;
    }

    /* ropeTension: vertical circle at constant speed, T = m·(v²/R − g·sin(theta)) */
    function ropeTension(mass, gravity, radius, speed, angle) {
        return mass * (speed * speed / radius - gravity * Math.sin(angle));
    }

    /* minTopSpeed: water stays in the bucket at the top iff v ≥ sqrt(g·R) */
    function minTopSpeed(gravity, radius) {
        return Math.sqrt(gravity * radius);
    }

    globalThis.circular_motion_calcul = {
        angularVelocity,
        angleAt,
        positionX,
        positionY,
        velocityX,
        velocityY,
        accelerationX,
        accelerationY,
        centripetalAcceleration,
        centripetalForce,
        period,
        ropeTension,
        minTopSpeed,
    };
})();
