/*
 * calcul.js — Projectile motion kinematics (no air resistance).
 * Model: uniform gravity field, point mass launched from height h0 with speed v0
 * at angle theta above the horizontal. All angles are in radians, all quantities
 * in SI units (m, s, m/s, m/s², kg, N). Air resistance is neglected; mass does
 * not affect the trajectory and only enters through the weight force P = m·g.
 * Classic script (no ES module exports) so pages work when opened via file://.
 * Exposes globalThis.projectile_calcul; Node tests import this file for its
 * side effect and read that global.
 */
(() => {
    /* degToRad: convert an angle from degrees to radians */
    function degToRad(angle_degrees) {
        return angle_degrees * Math.PI / 180;
    }

    /* positionX: horizontal position x(t) = v0·cos(theta)·t */
    function positionX(initial_speed, launch_angle, time) {
        return initial_speed * Math.cos(launch_angle) * time;
    }

    /* positionY: vertical position y(t) = h0 + v0·sin(theta)·t − ½·g·t² */
    function positionY(initial_height, initial_speed, launch_angle, gravity, time) {
        return initial_height + initial_speed * Math.sin(launch_angle) * time - 0.5 * gravity * time * time;
    }

    /* velocityX: horizontal velocity component vx = v0·cos(theta), constant */
    function velocityX(initial_speed, launch_angle) {
        return initial_speed * Math.cos(launch_angle);
    }

    /* velocityY: vertical velocity component vy(t) = v0·sin(theta) − g·t */
    function velocityY(initial_speed, launch_angle, gravity, time) {
        return initial_speed * Math.sin(launch_angle) - gravity * time;
    }

    /* flightTime: time until y(t) = 0, positive root of the quadratic:
       t = (v0·sin(theta) + sqrt((v0·sin(theta))² + 2·g·h0)) / g */
    function flightTime(initial_height, initial_speed, launch_angle, gravity) {
        const vertical_speed = initial_speed * Math.sin(launch_angle);
        return (vertical_speed + Math.sqrt(vertical_speed * vertical_speed + 2 * gravity * initial_height)) / gravity;
    }

    /* maxHeight: apex height reached during the flight (t ≥ 0):
       h0 + (v0·sin(theta))² / (2·g) when launched upward, h0 otherwise */
    function maxHeight(initial_height, initial_speed, launch_angle, gravity) {
        const vertical_speed = initial_speed * Math.sin(launch_angle);
        if (vertical_speed <= 0) {
            return initial_height;
        }
        return initial_height + vertical_speed * vertical_speed / (2 * gravity);
    }

    /* horizontalRange: horizontal distance travelled when the projectile lands, x(t_flight) */
    function horizontalRange(initial_height, initial_speed, launch_angle, gravity) {
        return positionX(initial_speed, launch_angle, flightTime(initial_height, initial_speed, launch_angle, gravity));
    }

    /* weightForce: weight magnitude P = m·g */
    function weightForce(mass, gravity) {
        return mass * gravity;
    }

    /* speedMagnitude: |v| = sqrt(vx² + vy²) */
    function speedMagnitude(velocity_x, velocity_y) {
        return Math.hypot(velocity_x, velocity_y);
    }

    globalThis.projectile_calcul = {
        degToRad,
        positionX,
        positionY,
        velocityX,
        velocityY,
        flightTime,
        maxHeight,
        horizontalRange,
        weightForce,
        speedMagnitude,
    };
})();
