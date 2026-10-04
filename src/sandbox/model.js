/* Shared 2D world, SI units. Bodies own state; forces, contacts and rods act
 * on the same bodies. Force providers can implement springs or electric fields
 * later without prescribing independent trajectories. */
(() => {
    const inverseMass = (body) => body.fixed ? 0 : 1 / body.mass;
    function createWorld({ gravity = 9.81 } = {}) {
        return { gravity, bodies: [], rods: [], time: 0, nextId: 1, forceProviders: [] };
    }
    function addBody(world, options = {}) {
        const body = { id: world.nextId++, x: 4, y: 5, vx: 0, vy: 0, mass: 1, radius: .3,
            restitution: .8, fixed: false, color: '#1976d2', ...options, trail: [], history: [] };
        world.bodies.push(body);
        return body;
    }
    const rodModes = ['mutual', 'anchor-a', 'anchor-b'];
    function setRodMode(rod, mode) {
        if (!rodModes.includes(mode)) throw new RangeError('Unknown rod interaction mode');
        rod.mode = mode;
    }
    function addRod(world, a, b, length = Math.hypot(b.x - a.x, b.y - a.y), { mode = 'mutual' } = {}) {
        if (!rodModes.includes(mode)) throw new RangeError('Unknown rod interaction mode');
        if (a === b || length < a.radius + b.radius || world.rods.some((r) => (r.a === a.id && r.b === b.id) || (r.b === a.id && r.a === b.id))) return null;
        const rod = { id: world.nextId++, a: a.id, b: b.id, length, mode };
        world.rods.push(rod);
        return rod;
    }
    function removeBody(world, id) {
        world.bodies = world.bodies.filter((b) => b.id !== id);
        world.rods = world.rods.filter((r) => r.a !== id && r.b !== id);
    }
    function registerForce(world, provider) {
        world.forceProviders.push(provider);
        return () => { world.forceProviders = world.forceProviders.filter((p) => p !== provider); };
    }
    function solveRod(world, rod) {
        const a = world.bodies.find((b) => b.id === rod.a), b = world.bodies.find((b) => b.id === rod.b);
        // A moving anchor keeps its own trajectory and velocity. Only the
        // follower receives this constraint's corrections and impulses.
        const ia = rod.mode === 'anchor-a' ? 0 : inverseMass(a);
        const ib = rod.mode === 'anchor-b' ? 0 : inverseMass(b), sum = ia + ib;
        if (!sum) return;
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
        const correction = (distance - rod.length) / sum;
        a.x += nx * correction * ia; a.y += ny * correction * ia;
        b.x -= nx * correction * ib; b.y -= ny * correction * ib;
        const impulse = ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny) / sum;
        a.vx += impulse * nx * ia; a.vy += impulse * ny * ia;
        b.vx -= impulse * nx * ib; b.vy -= impulse * ny * ib;
    }
    function collide(a, b) {
        const ia = inverseMass(a), ib = inverseMass(b), sum = ia + ib;
        if (!sum) return;
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), overlap = a.radius + b.radius - distance;
        if (overlap < 0) return;
        const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
        a.x -= nx * overlap * ia / sum; a.y -= ny * overlap * ia / sum;
        b.x += nx * overlap * ib / sum; b.y += ny * overlap * ib / sum;
        const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relative >= 0) return;
        const impulse = -(1 + Math.min(a.restitution, b.restitution)) * relative / sum;
        a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia;
        b.vx += impulse * nx * ib; b.vy += impulse * ny * ib;
    }
    function floor(b) {
        if (b.fixed) return;
        if (b.y < b.radius) { b.y = b.radius; if (b.vy < 0) b.vy *= -b.restitution; }
    }
    function substep(world, dt) {
        const forces = new Map(world.bodies.map((b) => [b.id, { x: 0, y: -world.gravity * b.mass }]));
        const addForce = (id, fx, fy) => {
            const f = forces.get(id);
            if (f) { f.x += fx; f.y += fy; }
        };
        for (const provider of world.forceProviders) provider(world, addForce);
        for (const b of world.bodies) {
            if (b.fixed) continue;
            const f = forces.get(b.id), ax = f.x / b.mass, ay = f.y / b.mass;
            b.x += b.vx * dt + .5 * ax * dt * dt; b.y += b.vy * dt + .5 * ay * dt * dt;
            b.vx += ax * dt; b.vy += ay * dt;
        }
        // Iteration couples contacts and distance constraints (including chains).
        const anchorPairs = new Set(world.rods.filter((r) => r.mode === 'anchor-a' || r.mode === 'anchor-b')
            .map((r) => [r.a, r.b].sort((a, b) => a - b).join(':')));
        for (let iteration = 0; iteration < 12; iteration++) {
            for (const rod of world.rods) solveRod(world, rod);
            for (let i = 0; i < world.bodies.length; i++) {
                floor(world.bodies[i]);
                for (let j = i + 1; j < world.bodies.length; j++) {
                    const a = world.bodies[i], b = world.bodies[j];
                    // Do not reintroduce feedback through a direct contact
                    // between the endpoints of an anchor-only connection.
                    if (!anchorPairs.has([a.id, b.id].sort((a, b) => a - b).join(':'))) collide(a, b);
                }
            }
        }
        world.time += dt;
    }
    function advance(world, dt) {
        if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
        recordHistory(world);
        let remaining = dt;
        while (remaining > 1e-12) {
            // Limit displacement to prevent fast small bodies passing through contacts.
            const speed = Math.max(1, ...world.bodies.filter((b) => !b.fixed).map((b) => Math.hypot(b.vx, b.vy)));
            const radius = Math.min(.3, ...world.bodies.map((b) => b.radius));
            const step = Math.min(remaining, 1 / 240, radius / (4 * speed));
            substep(world, step); remaining -= step;
        }
        for (const b of world.bodies) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 600) b.trail.shift(); }
        recordHistory(world);
    }
    function recordHistory(world) {
        for (const b of world.bodies) {
            const sample = { time: world.time, x: b.x, y: b.y, vx: b.fixed ? 0 : b.vx, vy: b.fixed ? 0 : b.vy };
            const history = b.history;
            if (history.length && history[history.length - 1].time === world.time) history[history.length - 1] = sample;
            else history.push(sample);
            // Retain at most the last minute, even when graphs are collapsed.
            const cutoff = world.time - 60;
            const first = history.findIndex((s) => s.time >= cutoff);
            if (first > 0) history.splice(0, first);
            if (history.length > 2000) b.history = history.filter((_, i) => i % 2 === 0 || i === history.length - 1);
        }
    }
    function resetHistory(world) { for (const b of world.bodies) b.history = []; recordHistory(world); }
    function snapshot(world) {
        return { gravity: world.gravity, nextId: world.nextId,
            bodies: world.bodies.map(({ trail, history, ...b }) => ({ ...b })), rods: world.rods.map((r) => ({ ...r })) };
    }
    function restore(world, saved) {
        Object.assign(world, saved, { bodies: saved.bodies.map((b) => ({ ...b, trail: [], history: [] })), rods: saved.rods.map((r) => ({ ...r })), time: 0 });
        resetHistory(world);
    }
    globalThis.sandbox_model = { createWorld, addBody, addRod, setRodMode, removeBody, registerForce, advance, snapshot, restore, recordHistory, resetHistory };
})();
