/*
 * calcul.js — Simple pendulum dynamics (rigid massless rod, no friction).
 * Model: point mass m at the end of a rigid rod of length L, pivot fixed at the
 * origin, angle theta measured from the downward vertical (positive counter-
 * clockwise). Equation of motion alpha = −(g/L)·sin(theta), integrated with RK4
 * (no small-angle approximation). All angles in radians, SI units. The rod is
 * rigid so the constraint force ("tension") T = m·(g·cos(theta) + L·omega²) can
 * be evaluated at any angle. Classic script (works via file://); exposes
 * globalThis.pendulum_calcul; Node tests import this file for its side effect.
 */
(() => {
    /* degToRad: convert an angle from degrees to radians */
    function degToRad(angle_degrees) {
        return angle_degrees * Math.PI / 180;
    }

    /* radToDeg: convert an angle from radians to degrees */
    function radToDeg(angle_radians) {
        return angle_radians * 180 / Math.PI;
    }

    /* angularAcceleration: alpha = −(g/L)·sin(theta) */
    function angularAcceleration(angle, gravity, length) {
        return -(gravity / length) * Math.sin(angle);
    }

    /* stepState: one RK4 step of size dt on the state {angle, angular_velocity} */
    function stepState(state, gravity, length, dt) {
        const acceleration = (angle) => angularAcceleration(angle, gravity, length);
        const k1_angle = state.angular_velocity;
        const k1_omega = acceleration(state.angle);
        const k2_angle = state.angular_velocity + k1_omega * dt / 2;
        const k2_omega = acceleration(state.angle + k1_angle * dt / 2);
        const k3_angle = state.angular_velocity + k2_omega * dt / 2;
        const k3_omega = acceleration(state.angle + k2_angle * dt / 2);
        const k4_angle = state.angular_velocity + k3_omega * dt;
        const k4_omega = acceleration(state.angle + k3_angle * dt);
        return {
            angle: state.angle + (dt / 6) * (k1_angle + 2 * k2_angle + 2 * k3_angle + k4_angle),
            angular_velocity: state.angular_velocity + (dt / 6) * (k1_omega + 2 * k2_omega + 2 * k3_omega + k4_omega),
        };
    }

    /* simulate: trajectory [{time, angle, angular_velocity}] from the initial state,
       steps RK4 steps of size dt (element 0 is the initial state at t = 0) */
    function simulate(initial_angle, initial_angular_velocity, gravity, length, dt, steps) {
        const trajectory = [{ time: 0, angle: initial_angle, angular_velocity: initial_angular_velocity }];
        let state = { angle: initial_angle, angular_velocity: initial_angular_velocity };
        for (let i = 1; i <= steps; i++) {
            state = stepState(state, gravity, length, dt);
            trajectory.push({ time: i * dt, angle: state.angle, angular_velocity: state.angular_velocity });
        }
        return trajectory;
    }

    /* bobX: horizontal bob position x = L·sin(theta), pivot at the origin */
    function bobX(length, angle) {
        return length * Math.sin(angle);
    }

    /* bobY: vertical bob position y = −L·cos(theta), pivot at the origin */
    function bobY(length, angle) {
        return -length * Math.cos(angle);
    }

    /* tangentialSpeed: v = L·omega (signed) */
    function tangentialSpeed(length, angular_velocity) {
        return length * angular_velocity;
    }

    /* speedFromEnergy: |v| at angle theta from energy conservation:
       v² = v0² + 2·g·L·(cos(theta) − cos(theta0)) */
    function speedFromEnergy(initial_angle, initial_speed, angle, gravity, length) {
        const speed_squared = initial_speed * initial_speed
            + 2 * gravity * length * (Math.cos(angle) - Math.cos(initial_angle));
        return Math.sqrt(Math.max(speed_squared, 0));
    }

    /* tension: rod constraint force T = m·(g·cos(theta) + L·omega²) */
    function tension(mass, gravity, length, angle, angular_velocity) {
        return mass * (gravity * Math.cos(angle) + length * angular_velocity * angular_velocity);
    }

    /* smallAnglePeriod: T0 = 2·pi·sqrt(L/g), valid for small oscillations */
    function smallAnglePeriod(length, gravity) {
        return 2 * Math.PI * Math.sqrt(length / gravity);
    }

    /* mechanicalEnergy: E/m = v²/2 − g·L·cos(theta), conserved quantity per unit mass */
    function mechanicalEnergy(angle, angular_velocity, gravity, length) {
        const speed = tangentialSpeed(length, angular_velocity);
        return speed * speed / 2 - gravity * length * Math.cos(angle);
    }

    globalThis.pendulum_calcul = {
        degToRad,
        radToDeg,
        angularAcceleration,
        stepState,
        simulate,
        bobX,
        bobY,
        tangentialSpeed,
        speedFromEnergy,
        tension,
        smallAnglePeriod,
        mechanicalEnergy,
    };
})();
