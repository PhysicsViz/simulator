(() => {
    const $ = (id) => document.getElementById(id), physics = globalThis.sandbox_model;
    const words = {
        title: ['Bac à sable', 'Physics sandbox'],
        intro: ['Construisez un monde partagé : déplacez les objets, modifiez leurs propriétés et reliez-les. Les collisions et les contraintes font évoluer tous les objets ensemble.', 'Build a shared world: move objects, edit their properties, and connect them. Collisions and constraints affect all objects together.'],
        play: ['Démarrer', 'Play'], pause: ['Pause', 'Pause'], step: ['Pas +0,02 s', 'Step +0.02 s'], reset: ['Revenir au départ', 'Reset to start'], speed: ['Vitesse', 'Playback'],
        addBody: ['+ Bille', '+ Ball'], addAnchor: ['+ Ancrage', '+ Anchor'], addPendulum: ['+ Pendule', '+ Pendulum'], connect: ['Relier par une tige', 'Connect with a rod'],
        trails: ['Trajectoires', 'Trails'], vectors: ['Directions des vitesses', 'Velocity directions'],
        hint: ['Glissez les objets pour les déplacer (met en pause). Glissez le fond ou utilisez Maj + glisser pour déplacer la vue. Molette ou boutons pour zoomer. Les flèches déplacent l’objet de 0,1 m ; Maj + flèches déplace la vue. Pour relier : activez l’outil, puis cliquez sur deux objets.', 'Drag objects to move them (pauses playback). Drag the background or Shift + drag to pan. Use the wheel or buttons to zoom. Arrow keys move the object by 0.1 m; Shift + arrows pans the view. To connect: activate the tool, then click two objects.'],
        world: ['Monde', 'World'], gravity: ['Gravité (m/s²)', 'Gravity (m/s²)'],
        assumption: ['Monde sans limites horizontales ni plafond, avec un sol à y = 0. Billes sans rotation ni frottement, tiges rigides sans masse.', 'No side walls or ceiling; the floor is at y = 0. Balls have no rotation or friction; rods are rigid and massless.'],
        selected: ['Objet sélectionné', 'Selected object'], apply: ['Appliquer', 'Apply'], remove: ['Supprimer', 'Delete'], detach: ['Détacher les tiges', 'Detach rods'],
        objects: ['Objets de la scène', 'Scene objects'], clear: ['Tout effacer', 'Clear all'],
        objectHint: ['Configurez la scène avant de démarrer. Revenir au départ restaure les positions, vitesses et liaisons initiales, même après des modifications pendant la simulation.', 'Configure the scene before starting. Reset restores the starting positions, velocities, and connections, even after edits during simulation.'],
        none: ['Sélectionnez ou ajoutez un objet.', 'Select or add an object.'], ball: ['Bille', 'Ball'], anchor: ['Ancrage', 'Anchor'],
        x: ['Position x (m)', 'Position x (m)'], y: ['Position y (m)', 'Position y (m)'], vx: ['Vitesse x (m/s)', 'Velocity x (m/s)'], vy: ['Vitesse y (m/s)', 'Velocity y (m/s)'],
        mass: ['Masse (kg)', 'Mass (kg)'], radius: ['Rayon (m)', 'Radius (m)'], restitution: ['Rebond (0–1)', 'Restitution (0–1)'], fixed: ['Fixe', 'Fixed'],
        invalid: ['Vérifiez les valeurs. Les objets doivent rester au-dessus du sol.', 'Check the values. Objects must remain above the floor.'],
        limit: ['Maximum 30 objets.', 'Maximum 30 objects.'], first: ['Choisissez le premier objet à relier.', 'Choose the first object to connect.'], second: ['Choisissez le deuxième objet.', 'Choose the second object.'],
        connected: ['Tige ajoutée. Vous pouvez continuer à relier des objets.', 'Rod added. You can continue connecting objects.'], cannotConnect: ['Cette liaison existe déjà ou les objets sont trop proches.', 'This connection already exists or the objects are too close.'],
        newConnection: ['Nouvelle liaison :', 'New connection:'],
        mutual: ['Interaction réciproque', 'Both objects affect each other'],
        anchorFirst: ['Le premier objet sert d’ancrage', 'First object acts as anchor'],
        anchorSecond: ['Le deuxième objet sert d’ancrage', 'Second object acts as anchor'],
        connections: ['Liaisons de cet objet', 'Connections for this object'],
        connectionHint: ['Une liaison réciproque transmet les forces aux deux objets. Un ancrage mobile entraîne l’autre objet sans subir sa réaction. Les lignes pointillées indiquent le sens ancrage → objet. Les collisions avec les autres objets restent actives.', 'A mutual connection transfers forces to both objects. A moving anchor drives the other object without receiving its reaction. Dashed arrows point from anchor to follower. Collisions with other objects remain active.'],
        noConnections: ['Aucune liaison.', 'No connections.'],
        anchors: ['sert d’ancrage à', 'anchors'], rod: ['Tige', 'Rod'],
        zoomIn: ['Zoom +', 'Zoom in'], zoomOut: ['Zoom −', 'Zoom out'], fitView: ['Voir les objets et le sol', 'Fit objects and floor'],
        setStart: ['Utiliser cette scène comme départ', 'Use current scene as start'],
        presets: ['Préconfigurations', 'Scene presets'], presetName: ['Nom', 'Name'], savedPresets: ['Scènes enregistrées', 'Saved scenes'],
        savePreset: ['Enregistrer le départ', 'Save starting setup'], loadPreset: ['Charger', 'Load'], deletePreset: ['Supprimer la préconfiguration', 'Delete preset'],
        presetHint: ['Les préconfigurations conservent la scène de départ et la vue dans ce navigateur. Un nom existant remplace cette préconfiguration. Pour enregistrer les placements actuels après une simulation, utilisez d’abord « Utiliser cette scène comme départ ».', 'Presets keep the starting setup and view in this browser. Saving an existing name replaces that preset. To save current placements after a simulation, first choose “Use current scene as start”.'],
        noPresets: ['Aucune préconfiguration', 'No saved presets'], presetSaved: ['Préconfiguration enregistrée.', 'Preset saved.'], presetLoaded: ['Préconfiguration chargée.', 'Preset loaded.'],
        presetDeleted: ['Préconfiguration supprimée.', 'Preset deleted.'], presetError: ['Impossible de lire ou enregistrer les préconfigurations dans ce navigateur.', 'Could not read or save presets in this browser.'],
        presetInvalid: ['Donnez un nom à la préconfiguration (80 caractères maximum).', 'Enter a preset name (maximum 80 characters).'],
        graphs: ['Graphiques par objet', 'Graphs for each object'],
        graphHint: ['Position x, y et vitesse vₓ, vᵧ, |v| sur une fenêtre de temps glissante. Ouvrez ou repliez les graphiques de chaque objet. Les historiques sont effacés au retour au départ.', 'Position x, y and velocity vₓ, vᵧ, |v| over a rolling time window. Expand or collapse each object’s graphs. Reset clears the history.'],
        graphWindow: ['Durée affichée', 'Time window'],
        positionGraph: ['Position (m)', 'Position (m)'], velocityGraph: ['Vitesse (m/s)', 'Velocity (m/s)'],
        noGraphs: ['Ajoutez un objet pour afficher ses graphiques.', 'Add an object to see its graphs.'],
    };
    let language = 'fr'; try { if (localStorage.getItem('simulator_language') === 'en') language = 'en'; } catch { /* optional storage */ }
    const t = (key) => words[key][language === 'fr' ? 0 : 1];
    const world = physics.createWorld(), colors = ['#1976d2', '#d45b18', '#8754c7', '#008579', '#c83f72'];
    let selectedId = null, playing = false, connecting = false, firstId = null, drag = null, saved, last, started = false;
    const presetTools = globalThis.sandbox_presets;
    let presets = [], presetStatusKey = '';
    try { presets = presetTools.read(localStorage); } catch { presetStatusKey = 'presetError'; }
    const selected = () => world.bodies.find((b) => b.id === selectedId);
    const fmt = (v) => v.toFixed(2);
    function pause() { playing = false; $('play').textContent = t('play'); }
    function saveSetup() {
        // Setup edits before the first Play/Step establish the start. Pausing or
        // editing a running experiment must never overwrite its initial state.
        if (started) return;
        world.time = 0; for (const b of world.bodies) b.trail = []; physics.resetHistory(world); saved = physics.snapshot(world);
    }
    function notify(key) { $('message').textContent = key ? t(key) : ''; }
    function updateConnections(body) {
        for (const rod of world.rods) {
            if (rod.a !== body.id && rod.b !== body.id) continue;
            const a = world.bodies.find((b) => b.id === rod.a), b = world.bodies.find((b) => b.id === rod.b);
            rod.length = Math.max(a.radius + b.radius, Math.hypot(a.x - b.x, a.y - b.y));
        }
    }
    function objectList() {
        $('objects').replaceChildren();
        for (const b of world.bodies) {
            const button = document.createElement('button'); button.type = 'button';
            button.textContent = `${t(b.fixed ? 'anchor' : 'ball')} #${b.id}`;
            button.classList.toggle('active', b.id === selectedId); button.setAttribute('aria-pressed', String(b.id === selectedId));
            button.style.borderLeft = `4px solid ${b.color}`;
            button.addEventListener('click', () => selectBody(b)); $('objects').append(button);
        }
    }
    function editor() {
        const b = selected(); $('fields').replaceChildren();
        connectionEditor();
        $('selection_name').textContent = b ? `${t(b.fixed ? 'anchor' : 'ball')} #${b.id}` : t('none');
        $('apply').disabled = $('remove').disabled = $('detach').disabled = !b;
        if (!b) return;
        const schema = [['x', null, null], ['y', 0, null], ['vx', -50, 50], ['vy', -50, 50], ['mass', .1, 100], ['radius', .1, 1.5], ['restitution', 0, 1]];
        for (const [key, min, max] of schema) {
            const row = document.createElement('label'); row.className = 'field';
            const label = document.createElement('span'); label.textContent = t(key);
            const input = document.createElement('input'); Object.assign(input, { type: 'number', name: key, step: 'any', required: true, value: Number(b[key].toFixed(4)) });
            if (min !== null) input.min = min;
            if (max !== null) input.max = max;
            row.append(label, input); $('fields').append(row);
        }
        const row = document.createElement('label'); row.className = 'field'; row.append(document.createTextNode(t('fixed')));
        const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'fixed'; input.checked = b.fixed;
        row.append(input); $('fields').append(row);
    }
    function connectionEditor() {
        $('connections').replaceChildren();
        const rods = world.rods.filter((r) => r.a === selectedId || r.b === selectedId);
        if (!rods.length) { $('connections').textContent = t('noConnections'); return; }
        for (const rod of rods) {
            const row = document.createElement('div'); row.className = 'connection';
            const label = document.createElement('label');
            label.append(document.createTextNode(`${t('rod')} #${rod.a} ↔ #${rod.b} · ${fmt(rod.length)} m`));
            const select = document.createElement('select');
            for (const [mode, text] of [['mutual', t('mutual')], ['anchor-a', `#${rod.a} ${t('anchors')} #${rod.b}`], ['anchor-b', `#${rod.b} ${t('anchors')} #${rod.a}`]]) {
                const option = document.createElement('option'); option.value = mode; option.textContent = text; select.append(option);
            }
            select.value = rod.mode || 'mutual';
            select.addEventListener('change', () => { pause(); physics.setRodMode(rod, select.value); saveSetup(); notify(''); draw(); });
            label.append(select); row.append(label); $('connections').append(row);
        }
    }
    function selectBody(b) {
        pause();
        selectedId = b.id;
        if (connecting) {
            if (firstId === null) { firstId = b.id; notify('second'); }
            else {
                const a = world.bodies.find((body) => body.id === firstId);
                if (a && physics.addRod(world, a, b, undefined, { mode: $('connection_mode').value })) { pause(); saveSetup(); notify('connected'); }
                else notify('cannotConnect');
                firstId = null;
            }
        }
        editor(); objectList(); draw();
    }
    function add(kind) {
        const count = kind === 'pendulum' ? 2 : 1;
        if (world.bodies.length + count > 30) { notify('limit'); return; }
        pause(); notify('');
        const color = colors[world.bodies.length % colors.length], x = view.centerX;
        const y = Math.max(count === 2 ? 2.5 : .3, view.centerY);
        let b;
        if (count === 2) {
            const anchor = physics.addBody(world, { x, y, fixed: true, radius: .16, color });
            b = physics.addBody(world, { x: x + 2, y, radius: .3, color });
            physics.addRod(world, anchor, b);
        } else b = physics.addBody(world, { x, y, fixed: kind === 'anchor', radius: kind === 'anchor' ? .16 : .3, color });
        selectedId = b.id; saveSetup(); editor(); objectList(); draw();
    }
    function apply(event) {
        event.preventDefault(); const b = selected(); if (!b) return;
        const values = {};
        for (const input of $('properties').querySelectorAll('input[type="number"]')) {
            const v = Number(input.value);
            if (input.value === '' || !Number.isFinite(v) || (input.min !== '' && v < Number(input.min)) || (input.max !== '' && v > Number(input.max))) { notify('invalid'); return; }
            values[input.name] = v;
        }
        if (values.y < values.radius) { notify('invalid'); return; }
        pause(); Object.assign(b, values, { fixed: $('properties').elements.namedItem('fixed').checked });
        if (b.fixed) { b.vx = 0; b.vy = 0; }
        updateConnections(b); saveSetup(); notify(''); editor(); objectList(); draw();
    }
    const canvas = $('scene'), ctx = canvas.getContext('2d');
    const graphCards = new Map();
    let lastGraphDraw = 0;
    const cameraTools = globalThis.sandbox_camera, view = cameraTools.create();
    cameraTools.fit(view, [], canvas.clientWidth, canvas.clientHeight);
    let camera = { scale: 1, x: 0, y: 0 };
    const screen = (x, y) => [camera.x + x * camera.scale, camera.y - y * camera.scale];
    function draw() {
        const width = canvas.clientWidth, height = canvas.clientHeight, ratio = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
        const scale = view.scale, visible = cameraTools.transform(view, width, height);
        const [originX, originY] = visible.toScreen(0, 0);
        camera = { scale, x: originX, y: originY };
        const style = getComputedStyle(document.documentElement), muted = style.getPropertyValue('--muted').trim();
        const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
        ctx.strokeStyle = style.getPropertyValue('--border').trim(); ctx.fillStyle = muted; ctx.lineWidth = 1; ctx.font = '11px system-ui';
        // Draw only visible grid lines; spacing adapts to zoom, not world size.
        const rawStep = 55 / scale, base = 10 ** Math.floor(Math.log10(rawStep));
        const grid = [1, 2, 5, 10].find((factor) => factor * base >= rawStep) * base;
        const firstX = Math.ceil(visible.left / grid) * grid, firstY = Math.ceil(visible.bottom / grid) * grid;
        for (let i = 0; i <= Math.ceil(width / (grid * scale)); i++) {
            const x = firstX + i * grid, px = screen(x, 0)[0]; line(px, 0, px, height);
            ctx.fillText(String(Number(x.toPrecision(5))), px + 3, Math.min(height - 8, Math.max(14, originY + 14)));
        }
        for (let i = 0; i <= Math.ceil(height / (grid * scale)); i++) {
            const y = firstY + i * grid, py = screen(0, y)[1]; line(0, py, width, py);
            ctx.fillText(String(Number(y.toPrecision(5))), 4, py - 4);
        }
        if (originY < height) {
            ctx.fillStyle = style.getPropertyValue('--border').trim(); ctx.globalAlpha = .35;
            ctx.fillRect(0, Math.max(0, originY), width, height - Math.max(0, originY)); ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = muted; ctx.lineWidth = 2; line(0, originY, width, originY);
        ctx.fillStyle = muted; ctx.fillText('x (m)', width - 40, Math.min(height - 8, Math.max(14, originY - 8))); ctx.fillText('y (m)', 4, 14);
        for (const rod of world.rods) {
            const a = world.bodies.find((b) => b.id === rod.a), b = world.bodies.find((b) => b.id === rod.b);
            const anchorOnly = rod.mode === 'anchor-a' || rod.mode === 'anchor-b';
            ctx.setLineDash(anchorOnly ? [6, 5] : []);
            ctx.strokeStyle = muted; ctx.lineWidth = 3; line(...screen(a.x, a.y), ...screen(b.x, b.y));
            ctx.setLineDash([]);
            if (anchorOnly) {
                const from = rod.mode === 'anchor-a' ? a : b, to = rod.mode === 'anchor-a' ? b : a;
                const [x1, y1] = screen(from.x, from.y), [x2, y2] = screen(to.x, to.y);
                const x = x1 + (x2 - x1) * .65, y = y1 + (y2 - y1) * .65, angle = Math.atan2(y2 - y1, x2 - x1);
                for (const offset of [-.5, .5]) line(x, y, x - 10 * Math.cos(angle + offset), y - 10 * Math.sin(angle + offset));
            }
        }
        for (const b of world.bodies) {
            const [x, y] = screen(b.x, b.y), radius = b.radius * scale;
            ctx.strokeStyle = b.color; ctx.fillStyle = b.color; ctx.lineWidth = 1.5;
            if ($('trails').checked && b.trail.length) { ctx.beginPath(); b.trail.forEach((p, i) => { const [px, py] = screen(p.x, p.y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); }
            ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fill();
            if (b.fixed) { ctx.strokeStyle = style.getPropertyValue('--panel').trim(); line(x - radius / 2, y - radius / 2, x + radius / 2, y + radius / 2); line(x - radius / 2, y + radius / 2, x + radius / 2, y - radius / 2); }
            if (b.id === selectedId || b.id === firstId) { ctx.strokeStyle = style.getPropertyValue('--foreground').trim(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, radius + 4, 0, Math.PI * 2); ctx.stroke(); }
            ctx.fillText(`#${b.id}`, x + radius + 5, y - radius - 3);
            const speed = Math.hypot(b.vx, b.vy);
            if ($('vectors').checked && !b.fixed && speed > .01) {
                const dx = b.vx / speed * 30, dy = -b.vy / speed * 30, angle = Math.atan2(dy, dx);
                ctx.strokeStyle = '#168449'; line(x, y, x + dx, y + dy);
                for (const offset of [-.5, .5]) line(x + dx, y + dy, x + dx - 7 * Math.cos(angle + offset), y + dy - 7 * Math.sin(angle + offset));
            }
        }
        $('time').textContent = `${fmt(world.time)} s`;
        const b = selected(); $('readout').textContent = b ? `x: ${fmt(b.x)} m · y: ${fmt(b.y)} m · |v|: ${fmt(Math.hypot(b.vx, b.vy))} m/s` : '';
        drawGraphs();
    }
    function drawGraphs() {
        physics.recordHistory(world);
        const now = Date.now();
        if (playing && now - lastGraphDraw < 100) return;
        lastGraphDraw = now;
        for (const [id, card] of graphCards) {
            if (!world.bodies.some((b) => b.id === id)) { card.details.remove(); graphCards.delete(id); }
        }
        if (!world.bodies.length) { $('object_graphs').textContent = t('noGraphs'); return; }
        if (!graphCards.size) $('object_graphs').replaceChildren();
        for (const b of world.bodies) {
            let card = graphCards.get(b.id);
            if (!card) {
                const details = document.createElement('details'); details.className = 'object-graphs'; details.open = true;
                details.style.setProperty('--object-color', b.color);
                const summary = document.createElement('summary'), grid = document.createElement('div'); grid.className = 'graph-grid';
                const position = document.createElement('canvas'), velocity = document.createElement('canvas');
                const captions = [];
                for (const plot of [position, velocity]) {
                    const figure = document.createElement('figure'), caption = document.createElement('figcaption');
                    captions.push(caption); plot.setAttribute('role', 'img'); figure.append(caption, plot); grid.append(figure);
                }
                const values = document.createElement('output'); values.className = 'graph-values';
                details.append(summary, grid, values); $('object_graphs').append(details);
                card = { details, summary, position, velocity, captions, values }; graphCards.set(b.id, card);
                details.addEventListener('toggle', () => { if (details.open) { lastGraphDraw = 0; drawGraphs(); } });
            }
            const name = `${t(b.fixed ? 'anchor' : 'ball')} #${b.id}`;
            card.summary.textContent = name;
            card.captions[0].textContent = t('positionGraph'); card.captions[1].textContent = t('velocityGraph');
            card.position.setAttribute('aria-label', `${name}: ${t('positionGraph')}`);
            card.velocity.setAttribute('aria-label', `${name}: ${t('velocityGraph')}`);
            if (!card.details.open) continue;
            const duration = Number($('graph_window').value);
            const start = Math.max(0, world.time - duration);
            const history = b.history.filter((s) => s.time >= start);
            const options = { cursor_time: world.time, time_min: start, time_max: Math.max(duration, world.time) };
            const points = (key) => history.map((s) => [s.time, s[key]]);
            globalThis.canvas_graph.drawTimeGraph(card.position, [
                { label: 'x', color: '#1976d2', points: points('x') }, { label: 'y', color: '#d45b18', points: points('y') },
            ], { ...options, unit: 'm' });
            globalThis.canvas_graph.drawTimeGraph(card.velocity, [
                { label: 'vₓ', color: '#1976d2', points: points('vx') }, { label: 'vᵧ', color: '#d45b18', points: points('vy') },
                { label: '|v|', color: '#008579', points: history.map((s) => [s.time, Math.hypot(s.vx, s.vy)]) },
            ], { ...options, unit: 'm/s' });
            const sample = b.history[b.history.length - 1];
            card.values.textContent = `t: ${fmt(sample.time)} s · x: ${fmt(sample.x)} m · y: ${fmt(sample.y)} m · vₓ: ${fmt(sample.vx)} m/s · vᵧ: ${fmt(sample.vy)} m/s · |v|: ${fmt(Math.hypot(sample.vx, sample.vy))} m/s`;
        }
    }
    function position(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left - camera.x) / camera.scale, y: (camera.y - (event.clientY - rect.top)) / camera.scale };
    }
    function moveBody(b, x, y) {
        b.x = x; b.y = Math.max(b.radius, y);
        updateConnections(b);
    }
    canvas.addEventListener('pointerdown', (event) => {
        if ((event.button !== 0 && event.button !== 1) || drag) return;
        const p = position(event), b = [...world.bodies].reverse().find((body) => Math.hypot(body.x - p.x, body.y - p.y) <= Math.max(body.radius, 12 / camera.scale));
        canvas.focus();
        if (!b || event.shiftKey || event.button === 1) {
            event.preventDefault(); drag = { kind: 'pan', pointer: event.pointerId, x: event.clientX, y: event.clientY };
            canvas.setPointerCapture(event.pointerId); return;
        }
        selectBody(b);
        if (connecting) return;
        pause(); drag = { kind: 'body', id: b.id, pointer: event.pointerId, dx: b.x - p.x, dy: b.y - p.y };
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
        if (!drag || drag.pointer !== event.pointerId) return;
        if (drag.kind === 'pan') {
            cameraTools.pan(view, event.clientX - drag.x, event.clientY - drag.y);
            drag.x = event.clientX; drag.y = event.clientY; draw(); return;
        }
        const p = position(event), b = world.bodies.find((body) => body.id === drag.id);
        if (b) { moveBody(b, p.x + drag.dx, p.y + drag.dy); draw(); }
    });
    function endDrag(event) {
        if (!drag || drag.pointer !== event.pointerId) return;
        const movedBody = drag.kind === 'body'; drag = null;
        if (movedBody) { saveSetup(); editor(); } draw();
    }
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, endDrag);
    canvas.addEventListener('keydown', (event) => {
        const b = selected(), offsets = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, .1], ArrowDown: [0, -.1] };
        if (offsets[event.key] && event.shiftKey) {
            event.preventDefault(); const [dx, dy] = offsets[event.key]; cameraTools.pan(view, -dx * 400, dy * 400); draw();
        } else if (b && offsets[event.key]) { event.preventDefault(); pause(); const [dx, dy] = offsets[event.key]; moveBody(b, b.x + dx, b.y + dy); saveSetup(); editor(); draw(); }
        if (event.key === 'Escape') { connecting = false; firstId = null; connectionState(); notify(''); draw(); }
    });
    function zoom(factor, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) {
        if (drag) return;
        cameraTools.zoom(view, canvas.clientWidth, canvas.clientHeight, x, y, factor); draw();
    }
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault(); const rect = canvas.getBoundingClientRect();
        zoom(Math.exp(Math.max(-1, Math.min(1, -event.deltaY * .002))), event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
    $('zoom_in').addEventListener('click', () => zoom(1.25));
    $('zoom_out').addEventListener('click', () => zoom(1 / 1.25));
    $('fit_view').addEventListener('click', () => { if (drag) return; cameraTools.fit(view, world.bodies, canvas.clientWidth, canvas.clientHeight); draw(); });
    function connectionState() { $('connect').classList.toggle('active', connecting); $('connect').setAttribute('aria-pressed', String(connecting)); }
    function languageUI() {
        document.documentElement.lang = language; document.title = `${t('title')} — Physics Simulator`;
        for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
        $('language_toggle').textContent = language === 'fr' ? 'EN' : 'FR'; $('play').textContent = t(playing ? 'pause' : 'play');
        canvas.setAttribute('aria-label', t('title')); editor(); objectList(); presetList(); draw();
        try { localStorage.setItem('simulator_language', language); } catch { /* optional storage */ }
    }
    function presetStatus(key) { presetStatusKey = key; $('preset_status').textContent = key ? t(key) : ''; }
    function presetList(name = $('preset_list').value) {
        $('preset_list').replaceChildren();
        if (!presets.length) {
            const option = document.createElement('option'); option.value = ''; option.textContent = t('noPresets'); $('preset_list').append(option);
        }
        for (const preset of presets) {
            const option = document.createElement('option'); option.value = preset.name; option.textContent = preset.name; $('preset_list').append(option);
        }
        $('preset_list').value = presets.some((p) => p.name === name) ? name : (presets[0]?.name || '');
        $('load_preset').disabled = $('delete_preset').disabled = $('preset_list').disabled = !presets.length;
        presetStatus(presetStatusKey);
    }
    function resetScene(scene = saved, presetView) {
        pause(); drag = null; connecting = false; firstId = null; last = undefined;
        physics.restore(world, scene); started = false; saved = physics.snapshot(world);
        if (!selected()) selectedId = world.bodies[0]?.id ?? null;
        $('gravity').value = world.gravity;
        if (presetView) Object.assign(view, presetView);
        else cameraTools.fit(view, world.bodies, canvas.clientWidth, canvas.clientHeight);
        connectionState(); notify(''); editor(); objectList(); draw();
    }
    $('save_preset').addEventListener('submit', (event) => {
        event.preventDefault();
        const name = $('preset_name').value.trim();
        if (!name || name.length > 80) { presetStatus('presetInvalid'); return; }
        try {
            const preset = presetTools.create(name, saved, view);
            const next = [...presets.filter((p) => p.name !== name), preset];
            presetTools.write(localStorage, next); presets = next;
            presetStatus('presetSaved'); presetList(name);
        } catch { presetStatus('presetError'); }
    });
    $('load_preset').addEventListener('click', () => {
        const preset = presets.find((p) => p.name === $('preset_list').value); if (!preset) return;
        resetScene(preset.scene, preset.view); $('preset_name').value = preset.name; presetStatus('presetLoaded');
    });
    $('delete_preset').addEventListener('click', () => {
        const name = $('preset_list').value; if (!presets.some((p) => p.name === name)) return;
        try {
            const next = presets.filter((p) => p.name !== name); presetTools.write(localStorage, next); presets = next;
            presetStatus('presetDeleted'); presetList();
        } catch { presetStatus('presetError'); }
    });
    $('set_start').addEventListener('click', () => { pause(); started = false; saveSetup(); editor(); objectList(); notify(''); draw(); });
    $('properties').addEventListener('submit', apply);
    $('gravity').addEventListener('change', () => {
        const input = $('gravity'), value = Number(input.value);
        if (input.value === '' || !Number.isFinite(value) || value < 0 || value > 30) { input.value = world.gravity; notify('invalid'); return; }
        pause(); world.gravity = value; saveSetup(); notify(''); draw();
    });
    for (const [id, kind] of [['add_body', 'ball'], ['add_anchor', 'anchor'], ['add_pendulum', 'pendulum']]) $(id).addEventListener('click', () => add(kind));
    $('connect').addEventListener('click', () => { pause(); connecting = !connecting; firstId = null; connectionState(); notify(connecting ? 'first' : ''); draw(); });
    $('remove').addEventListener('click', () => { if (!selected()) return; pause(); physics.removeBody(world, selectedId); selectedId = null; firstId = null; saveSetup(); editor(); objectList(); draw(); });
    $('detach').addEventListener('click', () => { if (!selected()) return; pause(); world.rods = world.rods.filter((r) => r.a !== selectedId && r.b !== selectedId); saveSetup(); connectionEditor(); draw(); });
    $('play').addEventListener('click', () => {
        if (drag) return; playing = !playing; last = undefined;
        if (playing) { started = true; connecting = false; firstId = null; connectionState(); notify(''); }
        else editor(); $('play').textContent = t(playing ? 'pause' : 'play');
    });
    $('step').addEventListener('click', () => { pause(); started = true; physics.advance(world, .02); editor(); draw(); });
    $('reset').addEventListener('click', () => resetScene());
    $('clear').addEventListener('click', () => { pause(); world.bodies = []; world.rods = []; selectedId = firstId = null; saveSetup(); editor(); objectList(); notify(''); draw(); });
    $('language_toggle').addEventListener('click', () => { language = language === 'fr' ? 'en' : 'fr'; notify(''); languageUI(); });
    for (const id of ['trails', 'vectors']) $(id).addEventListener('change', draw);
    $('graph_window').addEventListener('change', () => { lastGraphDraw = 0; drawGraphs(); });
    window.addEventListener('resize', draw); window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
    function frame(now) {
        if (playing && last !== undefined) { physics.advance(world, Math.min((now - last) / 1000, .05) * Number($('speed').value)); draw(); }
        last = now; requestAnimationFrame(frame);
    }
    // A pendulum can strike the nearby free ball in the initial scene.
    const a = physics.addBody(world, { x: 6, y: 3, fixed: true, radius: .16, color: colors[0] });
    const b = physics.addBody(world, { x: 3.3, y: 3, color: colors[0] });
    physics.addRod(world, a, b);
    physics.addBody(world, { x: 6.6, y: .3, color: colors[1] });
    selectedId = b.id; saveSetup(); languageUI(); requestAnimationFrame(frame);
})();
