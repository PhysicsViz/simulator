/*
 * calcul.js — Block on an inclined plane with friction.
 * Model: block of mass m on a slope of angle alpha, position s measured along
 * the slope (positive up-slope), launched with velocity v0 parallel to the
 * slope. Forces: weight P = m·g, normal N = m·g·cos(alpha), friction f = mu·N
 * opposing the motion (single coefficient mu = mu_s = mu_k). While moving:
 * a = −g·(sin(alpha) + sign(v)·mu·cos(alpha)). At rest the block stays stopped
 * iff tan(alpha) ≤ mu, otherwise it slides back down. The piecewise motion is
 * integrated with velocity-sign clamping (a zero crossing stops the step so the
 * static test applies). All SI units, angles in radians.
 * Classic script (works via file://); exposes globalThis.incline_calcul.
 */
(() => {
    const REST_SPEED = 1e-9;

    /* degToRad: convert an angle from degrees to radians */
    function degToRad(angle_degrees) {
        return angle_degrees * Math.PI / 180;
    }

    /* normalForce: N = m·g·cos(alpha) */
    function normalForce(mass, gravity, angle) {
        return mass * gravity * Math.cos(angle);
    }

    /* kineticFriction: f = mu·N */
    function kineticFriction(friction_coefficient, normal_force) {
        return friction_coefficient * normal_force;
    }

    /* staysStopped: static equilibrium condition tan(alpha) ≤ mu */
    function staysStopped(angle, friction_coefficient) {
        return Math.tan(angle) <= friction_coefficient + 1e-12;
    }

    /* movingAcceleration: a = −g·(sin(alpha) + sign(v)·mu·cos(alpha)); a body released
       from rest on a too-steep slope starts moving down, so sign(v) = −1 then */
    function movingAcceleration(angle, friction_coefficient, gravity, velocity_sign) {
        return -gravity * (Math.sin(angle) + velocity_sign * friction_coefficient * Math.cos(angle));
    }

    /* stepState: one integration step with zero-crossing clamp */
    function stepState(state, angle, friction_coefficient, gravity, dt) {
        if (Math.abs(state.velocity) < REST_SPEED) {
            if (staysStopped(angle, friction_coefficient)) {
                return { position: state.position, velocity: 0 };
            }
            const acceleration = movingAcceleration(angle, friction_coefficient, gravity, -1);
            const velocity = acceleration * dt;
            return { position: state.position + velocity * dt / 2, velocity };
        }
        const sign = Math.sign(state.velocity);
        const acceleration = movingAcceleration(angle, friction_coefficient, gravity, sign);
        let velocity = state.velocity + acceleration * dt;
        if (velocity * state.velocity < 0) {
            velocity = 0;
        }
        return { position: state.position + (state.velocity + velocity) * dt / 2, velocity };
    }

    /* currentAcceleration: the acceleration the block actually undergoes right now */
    function currentAcceleration(state, angle, friction_coefficient, gravity) {
        if (Math.abs(state.velocity) < REST_SPEED) {
            return staysStopped(angle, friction_coefficient)
                ? 0
                : movingAcceleration(angle, friction_coefficient, gravity, -1);
        }
        return movingAcceleration(angle, friction_coefficient, gravity, Math.sign(state.velocity));
    }

    /* simulate: trajectory [{time, position, velocity, acceleration}]; the block is
       blocked at min_position (bottom corner of the slope) if it reaches it */
    function simulate(initial_speed, angle, friction_coefficient, gravity, dt, steps, min_position = -Infinity) {
        let state = { position: 0, velocity: initial_speed };
        const frames = [{
            time: 0,
            position: 0,
            velocity: initial_speed,
            acceleration: currentAcceleration(state, angle, friction_coefficient, gravity),
        }];
        for (let i = 1; i <= steps; i++) {
            state = stepState(state, angle, friction_coefficient, gravity, dt);
            if (state.position <= min_position) {
                state = { position: min_position, velocity: 0 };
            }
            const at_bottom = state.position === min_position;
            frames.push({
                time: i * dt,
                position: state.position,
                velocity: state.velocity,
                acceleration: at_bottom ? 0 : currentAcceleration(state, angle, friction_coefficient, gravity),
            });
        }
        return frames;
    }

    /* stoppingDistance: distance travelled up-slope before stopping,
       d = v0² / (2·g·(sin(alpha) + mu·cos(alpha))), for v0 > 0 */
    function stoppingDistance(initial_speed, angle, friction_coefficient, gravity) {
        return initial_speed * initial_speed
            / (2 * gravity * (Math.sin(angle) + friction_coefficient * Math.cos(angle)));
    }

    /* speedAtPosition: speed while still moving up at position s (0 if unreachable):
       v² = v0² − 2·g·(sin(alpha) + mu·cos(alpha))·s */
    function speedAtPosition(initial_speed, position, angle, friction_coefficient, gravity) {
        const speed_squared = initial_speed * initial_speed
            - 2 * gravity * (Math.sin(angle) + friction_coefficient * Math.cos(angle)) * position;
        return Math.sqrt(Math.max(speed_squared, 0));
    }

    globalThis.incline_calcul = {
        degToRad,
        normalForce,
        kineticFriction,
        staysStopped,
        movingAcceleration,
        stepState,
        currentAcceleration,
        simulate,
        stoppingDistance,
        speedAtPosition,
    };
})();
