/* Versioned browser-local presets. Validate stored data before it reaches physics. */
(() => {
    const key = 'simulator_sandbox_presets_v1';
    const finite = (value) => typeof value === 'number' && Number.isFinite(value);
    const id = (value) => Number.isSafeInteger(value) && value > 0;
    function validate(preset) {
        if (!preset || typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80) throw new Error('Invalid preset name');
        const scene = preset.scene;
        if (!scene || !finite(scene.gravity) || scene.gravity < 0 || scene.gravity > 30 || !id(scene.nextId)
            || !Array.isArray(scene.bodies) || scene.bodies.length > 30 || !Array.isArray(scene.rods)) throw new Error('Invalid scene');
        const ids = new Set(), bodyIds = new Set();
        for (const b of scene.bodies) {
            if (!id(b.id) || ids.has(b.id) || !['x', 'y', 'vx', 'vy', 'mass', 'radius', 'restitution'].every((field) => finite(b[field]))
                || b.mass <= 0 || b.radius <= 0 || b.y < b.radius - 1e-6 || b.restitution < 0 || b.restitution > 1
                || typeof b.fixed !== 'boolean' || typeof b.color !== 'string') throw new Error('Invalid body');
            ids.add(b.id); bodyIds.add(b.id);
        }
        const pairs = new Set();
        for (const r of scene.rods) {
            const pair = [r.a, r.b].sort((a, b) => a - b).join(':');
            if (!id(r.id) || ids.has(r.id) || !bodyIds.has(r.a) || !bodyIds.has(r.b) || r.a === r.b || pairs.has(pair)
                || !finite(r.length) || r.length <= 0 || !['mutual', 'anchor-a', 'anchor-b'].includes(r.mode)) throw new Error('Invalid rod');
            ids.add(r.id); pairs.add(pair);
        }
        if ([...ids].some((value) => value >= scene.nextId)) throw new Error('Invalid next ID');
        const view = preset.view;
        if (!view || !['centerX', 'centerY', 'scale'].every((field) => finite(view[field])) || view.scale < 1e-9 || view.scale > 1000) throw new Error('Invalid camera');
        return preset;
    }
    function read(storage) {
        const raw = storage.getItem(key);
        if (!raw) return [];
        const data = JSON.parse(raw);
        if (data.version !== 1 || !Array.isArray(data.presets)) throw new Error('Invalid preset library');
        const names = new Set();
        for (const preset of data.presets) { validate(preset); if (names.has(preset.name)) throw new Error('Duplicate preset'); names.add(preset.name); }
        return data.presets;
    }
    function write(storage, presets) {
        for (const preset of presets) validate(preset);
        storage.setItem(key, JSON.stringify({ version: 1, presets }));
    }
    function create(name, scene, view) {
        return validate(JSON.parse(JSON.stringify({ name: name.trim(), scene, view })));
    }
    globalThis.sandbox_presets = { create, read, write };
})();
