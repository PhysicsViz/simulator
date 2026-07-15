/*
 * main.js — DC circuit page logic: grid-based circuit editor (place wires,
 * resistors, sources, switches, capacitors and ammeters between adjacent grid
 * nodes, select to edit values, toggle switches), animated scene with current
 * dots and per-component current/power labels, transport controls with timeline
 * scrubbing over a precomputed transient (backward Euler, for RC circuits),
 * live formula cards (Kirchhoff, U = R·I, P = U·I, capacitor law, equivalent
 * resistance) and time graphs (ammeter current, capacitor voltage, source
 * power). The default circuit is a battery + switch + ammeter + series resistor
 * feeding a resistor ∥ capacitor pair. Classic script (works via file://);
 * reads the globals of calcul.js, canvas_draw.js, scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.circuit_calcul;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Circuit électrique", en: "Electric circuit" },
        assumption: {
            fr: "Hypothèses : composants idéaux (sources de tension parfaites, fils et ampèremètres de résistance de contact 1 mΩ), lois de Kirchhoff résolues à chaque instant (Σ I = 0 aux nœuds, Σ V = 0 sur les mailles), condensateurs initialement déchargés, transitoires intégrés numériquement. Cliquez deux nœuds voisins pour placer le composant choisi ; cliquez un composant pour le sélectionner (un interrupteur se bascule).",
            en: "Assumptions: ideal components (perfect voltage sources, wires and ammeters with 1 mΩ contact resistance), Kirchhoff's laws solved at every instant (Σ I = 0 at nodes, Σ V = 0 around loops), capacitors initially discharged, transients integrated numerically. Click two neighbouring nodes to place the chosen component; click a component to select it (a switch toggles).",
        },
        transport_title: { fr: "Simulation", en: "Simulation" },
        controls_title: { fr: "Composants", en: "Components" },
        selection_title: { fr: "Sélection", en: "Selection" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Graphes", en: "Graphs" },
        graph_current: { fr: "Courant de l'ampèremètre I (A)", en: "Ammeter current I (A)" },
        graph_capacitor: { fr: "Tension du condensateur U_C (V)", en: "Capacitor voltage U_C (V)" },
        graph_power: { fr: "Puissance de la source P (W)", en: "Source power P (W)" },
        play: { fr: "Lancer", en: "Play" },
        pause: { fr: "Pause", en: "Pause" },
        reset: { fr: "⟲", en: "⟲" },
        reset_hint: { fr: "Revenir à t = 0", en: "Back to t = 0" },
        step_back: { fr: "−0,1 s", en: "−0.1 s" },
        step_forward: { fr: "+0,1 s", en: "+0.1 s" },
        speed_label: { fr: "Vitesse de lecture", en: "Playback speed" },
        zoom_fit_hint: { fr: "Ajuster la vue au circuit", en: "Fit view to the circuit" },
        tool_select: { fr: "Sélection", en: "Select" },
        tool_wire: { fr: "Fil", en: "Wire" },
        tool_resistor: { fr: "Résistance", en: "Resistor" },
        tool_source: { fr: "Source", en: "Source" },
        tool_switch: { fr: "Interrupteur", en: "Switch" },
        tool_capacitor: { fr: "Condensateur", en: "Capacitor" },
        tool_ammeter: { fr: "Ampèremètre", en: "Ammeter" },
        tool_delete: { fr: "Supprimer", en: "Delete" },
        selection_none: { fr: "Cliquez un composant pour l'éditer.", en: "Click a component to edit it." },
        selection_delete: { fr: "Supprimer ce composant", en: "Delete this component" },
        switch_state_closed: { fr: "Fermé (ON) — cliquer pour ouvrir", en: "Closed (ON) — click to open" },
        switch_state_open: { fr: "Ouvert (OFF) — cliquer pour fermer", en: "Open (OFF) — click to close" },
        type_wire: { fr: "Fil", en: "Wire" },
        type_resistor: { fr: "Résistance R", en: "Resistor R" },
        type_source: { fr: "Source de tension U", en: "Voltage source U" },
        type_switch: { fr: "Interrupteur", en: "Switch" },
        type_capacitor: { fr: "Condensateur C", en: "Capacitor C" },
        type_ammeter: { fr: "Ampèremètre", en: "Ammeter" },
        formula_kirchhoff: { fr: "Lois de Kirchhoff", en: "Kirchhoff's laws" },
        formula_kirchhoff_note: { fr: "résolues à chaque nœud et chaque maille", en: "solved at every node and loop" },
        formula_ohm: { fr: "Loi d'Ohm (résistance affichée)", en: "Ohm's law (shown resistor)" },
        formula_current: { fr: "Courant (résistance affichée)", en: "Current (shown resistor)" },
        formula_power: { fr: "Puissance dissipée", en: "Dissipated power" },
        formula_source_power: { fr: "Puissance de la source", en: "Source power" },
        formula_capacitor: { fr: "Courant du condensateur", en: "Capacitor current" },
        formula_capacitor_voltage: { fr: "Tension du condensateur", en: "Capacitor voltage" },
        formula_equivalent: { fr: "Résistance équivalente vue de la source", en: "Equivalent resistance seen by the source" },
        no_component: { fr: "—", en: "—" },
        nodes_label: { fr: "nœuds", en: "nodes" },
    };

    const GRID_COLUMNS = 8;
    const GRID_ROWS = 4;
    const SPEED_OPTIONS = [0.5, 1, 2, 4];
    const TIME_STEP = 0.1;
    const SIMULATION_DURATION = 20;
    const SIMULATION_RATE = 240;
    const GRAPH_STRIDE = 24;
    const DEFAULT_VALUES = { resistor: 10, source: 9, capacitor: 0.1 };

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const camera = globalThis.scene_camera.createCamera(canvas);
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };

    let current_language = localStorage.getItem("simulator_language") || "fr";
    let simulation_time = 0;
    let is_playing = false;
    let playback_speed = 1;
    let last_frame_timestamp = null;
    let component_counter = 0;
    let components = [];
    let frames = [];
    let selected_id = null;
    let active_tool = "select";
    let pending_node = null;
    let pointer_down_position = null;
    let dot_phase = 0;
    let last_render_milliseconds = null;

    /* Game mode hook — game.js sets the "game-mode" body class; without game.js
       this is always false and the editor behaves normally */
    function gameLocked() {
        return document.body.classList.contains("game-mode");
    }

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* newComponent: create a component with the type's default value */
    function newComponent(type, node_a, node_b) {
        component_counter += 1;
        return {
            id: `component_${component_counter}`,
            type,
            nodes: [node_a, node_b],
            value: DEFAULT_VALUES[type] || 0,
            closed: true,
        };
    }

    /* buildDefaultCircuit: battery + switch + ammeter + R1 in series, R2 ∥ C load */
    function buildDefaultCircuit() {
        const edges = [
            ["source", "0,1", "0,0", 9],
            ["wire", "0,1", "0,2"],
            ["wire", "0,2", "0,3"],
            ["switch", "0,0", "1,0"],
            ["ammeter", "1,0", "2,0"],
            ["resistor", "2,0", "3,0", 10],
            ["wire", "3,0", "4,0"],
            ["wire", "4,0", "5,0"],
            ["resistor", "4,0", "4,1", 20],
            ["wire", "4,1", "4,2"],
            ["wire", "4,2", "4,3"],
            ["capacitor", "5,0", "5,1", 0.1],
            ["wire", "5,1", "5,2"],
            ["wire", "5,2", "5,3"],
            ["wire", "0,3", "1,3"],
            ["wire", "1,3", "2,3"],
            ["wire", "2,3", "3,3"],
            ["wire", "3,3", "4,3"],
            ["wire", "4,3", "5,3"],
        ];
        components = edges.map(([type, a, b, value]) => {
            const component = newComponent(type, a, b);
            if (value !== undefined) {
                component.value = value;
            }
            return component;
        });
    }

    /* rebuildSimulation: recompute the whole transient after any circuit edit */
    function rebuildSimulation() {
        frames = calc.simulate(components, 1 / SIMULATION_RATE, SIMULATION_DURATION * SIMULATION_RATE);
        simulation_time = Math.min(simulation_time, SIMULATION_DURATION);
    }

    /* frameAt: simulation frame closest to the requested time */
    function frameAt(time) {
        const index = Math.min(Math.max(Math.round(time * SIMULATION_RATE), 0), frames.length - 1);
        return frames[index];
    }

    /* firstOfType: first component of a type (for the graphs and formula cards) */
    function firstOfType(type) {
        return components.find((component) => component.type === type) || null;
    }

    /* selectedOrFirst: the selected component if it matches the type, else the first one */
    function selectedOrFirst(type) {
        const selected = components.find((component) => component.id === selected_id);
        return selected && selected.type === type ? selected : firstOfType(type);
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* nodeWorld: grid node "c,r" → world coordinates (y downward on the grid) */
    function nodeWorld(node_id) {
        const [column, row] = node_id.split(",").map(Number);
        return { x: column, y: -row };
    }

    /* fitView: frame the whole grid */
    function fitView() {
        camera.fitTo({ left: -0.6, right: GRID_COLUMNS - 1 + 0.6, bottom: -(GRID_ROWS - 1) - 0.7, top: 0.7 });
    }

    /* worldFromPixel: inverse camera mapping for pointer interactions */
    function worldFromPixel(pixel_x, pixel_y) {
        const bounds = camera.transform().bounds;
        return {
            x: bounds.left + (pixel_x / canvas.width) * (bounds.right - bounds.left),
            y: bounds.top - (pixel_y / canvas.height) * (bounds.top - bounds.bottom),
        };
    }

    /* nearestNode: grid node within 0.34 world units of the point, or null */
    function nearestNode(world) {
        const column = Math.round(world.x);
        const row = Math.round(-world.y);
        if (column < 0 || column >= GRID_COLUMNS || row < 0 || row >= GRID_ROWS) {
            return null;
        }
        return Math.hypot(world.x - column, world.y + row) <= 0.34 ? `${column},${row}` : null;
    }

    /* componentAt: component whose edge midpoint is within 0.4 world units, or null */
    function componentAt(world) {
        let best = null;
        let best_distance = 0.4;
        for (const component of components) {
            const a = nodeWorld(component.nodes[0]);
            const b = nodeWorld(component.nodes[1]);
            const distance = Math.hypot(world.x - (a.x + b.x) / 2, world.y - (a.y + b.y) / 2);
            if (distance < best_distance) {
                best = component;
                best_distance = distance;
            }
        }
        return best;
    }

    /* placeComponent: add the active tool's component between two adjacent nodes,
       replacing whatever occupied that edge */
    function placeComponent(node_a, node_b) {
        if (active_tool === "capacitor" && gameLocked()) {
            return;
        }
        components = components.filter((component) =>
            !(component.nodes.includes(node_a) && component.nodes.includes(node_b)));
        const component = newComponent(active_tool, node_a, node_b);
        if (gameLocked()) {
            component.value = DEFAULT_VALUES[component.type] || 0;
        }
        components.push(component);
        selected_id = component.id;
        rebuildSimulation();
        renderSelectionPanel();
    }

    /* handleCanvasClick: tool-dependent interaction (kept separate from camera panning) */
    function handleCanvasClick(world) {
        if (active_tool === "select") {
            const component = componentAt(world);
            selected_id = component ? component.id : null;
            if (component && component.type === "switch") {
                component.closed = !component.closed;
                rebuildSimulation();
            }
            renderSelectionPanel();
            return;
        }
        if (active_tool === "delete") {
            const component = componentAt(world);
            if (component) {
                components = components.filter((other) => other.id !== component.id);
                if (selected_id === component.id) {
                    selected_id = null;
                }
                rebuildSimulation();
                renderSelectionPanel();
            }
            return;
        }
        const node = nearestNode(world);
        if (node === null) {
            pending_node = null;
            return;
        }
        if (pending_node === null || pending_node === node) {
            pending_node = node;
            return;
        }
        const [column_a, row_a] = pending_node.split(",").map(Number);
        const [column_b, row_b] = node.split(",").map(Number);
        if (Math.abs(column_a - column_b) + Math.abs(row_a - row_b) === 1) {
            placeComponent(pending_node, node);
            pending_node = node;
        } else {
            pending_node = node;
        }
    }

    /* drawComponent: symbol, labels and live measurements on the component's edge */
    function drawComponent(component, transform, branch, ink) {
        const a = nodeWorld(component.nodes[0]);
        const b = nodeWorld(component.nodes[1]);
        const ax = transform.toScreenX(a.x);
        const ay = transform.toScreenY(a.y);
        const bx = transform.toScreenX(b.x);
        const by = transform.toScreenY(b.y);
        const mid_x = (ax + bx) / 2;
        const mid_y = (ay + by) / 2;
        const length = Math.hypot(bx - ax, by - ay);
        const dir = { x: (bx - ax) / length, y: (by - ay) / length };
        const normal = { x: -dir.y, y: dir.x };
        const selected = component.id === selected_id;

        context.save();
        context.strokeStyle = selected ? "#1976d2" : ink;
        context.lineWidth = selected ? 3 : 2;

        /* leadTo: straight leads from both nodes up to ±gap around the midpoint */
        const leadTo = (gap) => {
            context.beginPath();
            context.moveTo(ax, ay);
            context.lineTo(mid_x - dir.x * gap, mid_y - dir.y * gap);
            context.moveTo(bx, by);
            context.lineTo(mid_x + dir.x * gap, mid_y + dir.y * gap);
            context.stroke();
        };

        if (component.type === "wire") {
            context.beginPath();
            context.moveTo(ax, ay);
            context.lineTo(bx, by);
            context.stroke();
        } else if (component.type === "resistor") {
            leadTo(length * 0.22);
            const half = length * 0.22;
            context.beginPath();
            context.rect(
                mid_x - dir.x * half - normal.x * 8,
                mid_y - dir.y * half - normal.y * 8,
                dir.x * 2 * half + normal.x * 16,
                dir.y * 2 * half + normal.y * 16,
            );
            context.stroke();
        } else if (component.type === "source") {
            leadTo(7);
            context.beginPath();
            context.moveTo(mid_x - dir.x * 5 - normal.x * 16, mid_y - dir.y * 5 - normal.y * 16);
            context.lineTo(mid_x - dir.x * 5 + normal.x * 16, mid_y - dir.y * 5 + normal.y * 16);
            context.stroke();
            context.lineWidth = (selected ? 3 : 2) + 3;
            context.beginPath();
            context.moveTo(mid_x + dir.x * 5 - normal.x * 8, mid_y + dir.y * 5 - normal.y * 8);
            context.lineTo(mid_x + dir.x * 5 + normal.x * 8, mid_y + dir.y * 5 + normal.y * 8);
            context.stroke();
            context.fillStyle = "#d32f2f";
            context.font = "bold 13px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("+", mid_x - dir.x * 16 + normal.x * 22, mid_y - dir.y * 16 + normal.y * 22);
        } else if (component.type === "switch") {
            leadTo(length * 0.24);
            const gap = length * 0.24;
            const start = { x: mid_x - dir.x * gap, y: mid_y - dir.y * gap };
            const lever_angle = component.closed ? 0 : 0.6;
            const cos = Math.cos(lever_angle);
            const sin = Math.sin(lever_angle);
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(
                start.x + (dir.x * cos - normal.x * sin) * gap * 2,
                start.y + (dir.y * cos - normal.y * sin) * gap * 2,
            );
            context.stroke();
            context.fillStyle = context.strokeStyle;
            for (const sign of [-1, 1]) {
                context.beginPath();
                context.arc(mid_x + dir.x * gap * sign, mid_y + dir.y * gap * sign, 3, 0, 2 * Math.PI);
                context.fill();
            }
        } else if (component.type === "capacitor") {
            leadTo(6);
            for (const sign of [-1, 1]) {
                context.beginPath();
                context.moveTo(mid_x + dir.x * 6 * sign - normal.x * 13, mid_y + dir.y * 6 * sign - normal.y * 13);
                context.lineTo(mid_x + dir.x * 6 * sign + normal.x * 13, mid_y + dir.y * 6 * sign + normal.y * 13);
                context.stroke();
            }
        } else if (component.type === "ammeter") {
            leadTo(13);
            context.beginPath();
            context.arc(mid_x, mid_y, 13, 0, 2 * Math.PI);
            context.stroke();
            context.fillStyle = context.strokeStyle;
            context.font = "bold 12px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("A", mid_x, mid_y);
        }

        /* vertical components stack both text lines on one side so neighbouring
           columns don't collide; horizontal ones use above/below */
        const vertical = Math.abs(dir.x) < 0.5;
        const label_x = vertical ? mid_x + Math.abs(normal.x) * 26 : mid_x + normal.x * 24;
        const label_y = vertical ? mid_y - 8 : mid_y + normal.y * 24;
        const measure_x = vertical ? label_x : mid_x - normal.x * 24;
        const measure_y = vertical ? mid_y + 8 : mid_y - normal.y * 24;
        context.font = "11px system-ui, sans-serif";
        context.textAlign = vertical ? "left" : "center";
        context.textBaseline = "middle";
        context.fillStyle = ink;
        if (component.type === "resistor") {
            context.fillText(`${formatNumber(component.value)} Ω`, label_x, label_y);
        } else if (component.type === "source") {
            context.fillText(`${formatNumber(component.value)} V`, label_x, label_y);
        } else if (component.type === "capacitor") {
            context.fillText(`${formatNumber(component.value * 1000)} mF`, label_x, label_y);
        }
        context.fillStyle = "#1976d2";
        if (component.type === "ammeter") {
            context.font = "bold 12px system-ui, sans-serif";
            context.fillText(`I = ${formatNumber(branch.current)} A`, label_x, label_y);
        } else if (component.type === "resistor" || component.type === "source") {
            context.fillText(
                `${formatNumber(Math.abs(branch.current))} A · ${formatNumber(Math.abs(branch.power))} W`,
                measure_x,
                measure_y,
            );
        } else if (component.type === "capacitor") {
            context.fillText(`U = ${formatNumber(Math.abs(branch.voltage))} V`, measure_x, measure_y);
        }
        context.restore();
    }

    /* drawCurrentDots: animated dots along every conducting component, speed ∝ I */
    function drawCurrentDots(transform, branches) {
        context.save();
        context.fillStyle = "#fbc02d";
        for (const component of components) {
            const branch = branches.get(component.id);
            if (!branch || Math.abs(branch.current) < 1e-3) {
                continue;
            }
            const a = nodeWorld(component.nodes[0]);
            const b = nodeWorld(component.nodes[1]);
            for (let j = 0; j < 3; j++) {
                const raw = dot_phase * branch.current * 0.4 + j / 3;
                const fraction = ((raw % 1) + 1) % 1;
                const x = transform.toScreenX(a.x + (b.x - a.x) * fraction);
                const y = transform.toScreenY(a.y + (b.y - a.y) * fraction);
                context.beginPath();
                context.arc(x, y, 2.5, 0, 2 * Math.PI);
                context.fill();
            }
        }
        context.restore();
    }

    /* drawScene: grid nodes, components, current animation and pending-node marker */
    function drawScene(transform, frame) {
        const ink = inkColor();
        context.clearRect(0, 0, canvas.width, canvas.height);

        context.save();
        context.fillStyle = "rgba(120, 130, 145, 0.5)";
        for (let column = 0; column < GRID_COLUMNS; column++) {
            for (let row = 0; row < GRID_ROWS; row++) {
                context.beginPath();
                context.arc(transform.toScreenX(column), transform.toScreenY(-row), 2.5, 0, 2 * Math.PI);
                context.fill();
            }
        }
        context.restore();

        for (const component of components) {
            drawComponent(component, transform, frame.branches.get(component.id) || { current: 0, voltage: 0, power: 0 }, ink);
        }
        drawCurrentDots(transform, frame.branches);

        if (pending_node !== null && active_tool !== "select" && active_tool !== "delete") {
            const world = nodeWorld(pending_node);
            context.save();
            context.strokeStyle = "#1976d2";
            context.lineWidth = 2;
            context.beginPath();
            context.arc(transform.toScreenX(world.x), transform.toScreenY(world.y), 9, 0, 2 * Math.PI);
            context.stroke();
            context.restore();
        }

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.circuit_game_overlay === "function") {
            const ammeter = firstOfType("ammeter");
            const ammeter_branch = ammeter ? frame.branches.get(ammeter.id) : null;
            globalThis.circuit_game_overlay(context, transform, {
                time: frame.time,
                ammeter_current: ammeter_branch ? ammeter_branch.current : null,
            });
        }
    }

    /* updateFormulas: refresh every formula card from the current frame */
    function updateFormulas(frame) {
        const resistor = selectedOrFirst("resistor");
        const source = firstOfType("source");
        const capacitor = firstOfType("capacitor");
        const none = strings.no_component[current_language];
        const resistor_branch = resistor ? frame.branches.get(resistor.id) : null;
        const source_branch = source ? frame.branches.get(source.id) : null;
        const capacitor_branch = capacitor ? frame.branches.get(capacitor.id) : null;
        const source_current = source_branch ? Math.abs(source_branch.current) : 0;
        const cards = {
            kirchhoff: {
                substitution: strings.formula_kirchhoff_note[current_language],
                result: `${frame.node_count} ${strings.nodes_label[current_language]}`,
            },
            ohm: {
                substitution: resistor_branch ? `${formatNumber(resistor.value)} × ${formatNumber(Math.abs(resistor_branch.current))}` : none,
                result: resistor_branch ? `${formatNumber(Math.abs(resistor_branch.voltage))} V` : none,
            },
            current: {
                substitution: resistor_branch ? `${formatNumber(Math.abs(resistor_branch.voltage))} / ${formatNumber(resistor.value)}` : none,
                result: resistor_branch ? `${formatNumber(Math.abs(resistor_branch.current))} A` : none,
            },
            power: {
                substitution: resistor_branch ? `${formatNumber(resistor.value)} × ${formatNumber(Math.abs(resistor_branch.current))}²` : none,
                result: resistor_branch ? `${formatNumber(Math.abs(resistor_branch.power))} W` : none,
            },
            source_power: {
                substitution: source_branch ? `${formatNumber(source.value)} × ${formatNumber(source_current)}` : none,
                result: source_branch ? `${formatNumber(Math.abs(source_branch.power))} W` : none,
            },
            capacitor: {
                substitution: capacitor_branch ? `C = ${formatNumber(capacitor.value * 1000)} mF` : none,
                result: capacitor_branch ? `i_C = ${formatNumber(capacitor_branch.current)} A` : none,
            },
            capacitor_voltage: {
                substitution: capacitor_branch ? `q = C·U_C` : none,
                result: capacitor_branch ? `U_C = ${formatNumber(Math.abs(capacitor_branch.voltage))} V` : none,
            },
            equivalent: {
                substitution: source_branch && source_current > 1e-6 ? `${formatNumber(source.value)} / ${formatNumber(source_current)}` : none,
                result: source_branch && source_current > 1e-6 ? `${formatNumber(source.value / source_current)} Ω` : "∞",
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawGraphs: ammeter current, capacitor voltage and source power versus time */
    function drawGraphs(time) {
        const ammeter = firstOfType("ammeter");
        const capacitor = firstOfType("capacitor");
        const source = firstOfType("source");
        const current_points = [];
        const capacitor_points = [];
        const power_points = [];
        for (let i = 0; i < frames.length; i += GRAPH_STRIDE) {
            const frame = frames[i];
            current_points.push([frame.time, ammeter ? (frame.branches.get(ammeter.id) || {}).current || 0 : 0]);
            capacitor_points.push([frame.time, capacitor ? Math.abs((frame.branches.get(capacitor.id) || {}).voltage || 0) : 0]);
            power_points.push([frame.time, source ? Math.abs((frame.branches.get(source.id) || {}).power || 0) : 0]);
        }
        graph.drawTimeGraph(document.getElementById("graph_current"), [
            { label: "I", color: "#1976d2", points: current_points },
        ], { cursor_time: time, unit: "A" });
        graph.drawTimeGraph(document.getElementById("graph_capacitor"), [
            { label: "U_C", color: "#d32f2f", points: capacitor_points },
        ], { cursor_time: time, unit: "V" });
        graph.drawTimeGraph(document.getElementById("graph_power"), [
            { label: "P", color: "#e8722c", points: power_points },
        ], { cursor_time: time, unit: "W" });
    }

    /* render: draw the scene, graphs, and refresh time display, timeline and formulas */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        const now_milliseconds = performance.now();
        if (last_render_milliseconds !== null) {
            dot_phase += Math.min((now_milliseconds - last_render_milliseconds) / 1000, 0.05);
        }
        last_render_milliseconds = now_milliseconds;

        const time = Math.min(simulation_time, SIMULATION_DURATION);
        const frame = frameAt(time);
        drawScene(camera.transform(), frame);

        document.getElementById("time_display").textContent = `t = ${formatNumber(time)} s`;
        document.getElementById("timeline").value = time;
        updateFormulas(frame);
        if (!document.body.classList.contains("game-mode")) {
            drawGraphs(time);
        }
    }

    /* animationFrame: advance simulation time while playing, then render */
    function animationFrame(timestamp) {
        if (is_playing) {
            if (last_frame_timestamp !== null) {
                const delta_seconds = Math.min((timestamp - last_frame_timestamp) / 1000, 0.05);
                simulation_time += delta_seconds * playback_speed;
                if (simulation_time >= SIMULATION_DURATION) {
                    simulation_time = SIMULATION_DURATION;
                    setPlaying(false);
                }
            }
            last_frame_timestamp = timestamp;
        }
        render();
        requestAnimationFrame(animationFrame);
    }

    /* setPlaying: toggle play state and keep the button label in sync */
    function setPlaying(playing) {
        is_playing = playing;
        last_frame_timestamp = null;
        document.getElementById("play_pause_button").textContent = playing
            ? strings.pause[current_language]
            : strings.play[current_language];
    }

    /* stepTime: shift simulation time by a signed amount, clamped to the window */
    function stepTime(delta_seconds) {
        simulation_time = Math.min(Math.max(simulation_time + delta_seconds, 0), SIMULATION_DURATION);
    }

    /* buildToolButtons: one button per editor tool */
    function buildToolButtons() {
        const container = document.getElementById("tool_buttons");
        const tools = ["select", "wire", "resistor", "source", "switch", "capacitor", "ammeter", "delete"];
        for (const tool of tools) {
            const button = document.createElement("button");
            button.type = "button";
            button.id = `tool_${tool}`;
            button.dataset.i18n = `tool_${tool}`;
            button.classList.toggle("active", tool === active_tool);
            button.addEventListener("click", () => {
                active_tool = tool;
                pending_node = null;
                for (const sibling of container.children) {
                    sibling.classList.toggle("active", sibling === button);
                }
            });
            container.append(button);
        }
    }

    /* renderSelectionPanel: value editor for the selected component */
    function renderSelectionPanel() {
        const container = document.getElementById("selection_rows");
        container.textContent = "";
        const component = components.find((other) => other.id === selected_id);
        if (!component) {
            const hint = document.createElement("p");
            hint.className = "selection-hint";
            hint.textContent = strings.selection_none[current_language];
            container.append(hint);
            return;
        }
        const title = document.createElement("p");
        title.className = "selection-type";
        title.textContent = strings[`type_${component.type}`][current_language];
        container.append(title);

        const ranges = {
            resistor: { min: 1, max: 100, step: 1, unit: "Ω", scale: 1 },
            source: { min: 1, max: 24, step: 0.5, unit: "V", scale: 1 },
            capacitor: { min: 10, max: 1000, step: 10, unit: "mF", scale: 1000 },
        };
        const range = ranges[component.type];
        if (range) {
            const row = document.createElement("div");
            row.className = "parameter-row";
            const slider = document.createElement("input");
            slider.type = "range";
            const number = document.createElement("input");
            number.type = "number";
            for (const input of [slider, number]) {
                input.min = range.min;
                input.max = range.max;
                input.step = range.step;
                input.value = component.value * range.scale;
                input.disabled = gameLocked();
            }
            const apply = (raw_value, mirror) => {
                const value = Number(raw_value);
                if (!Number.isFinite(value)) {
                    return;
                }
                component.value = value / range.scale;
                mirror.value = raw_value;
                rebuildSimulation();
            };
            slider.addEventListener("input", () => apply(slider.value, number));
            number.addEventListener("input", () => apply(number.value, slider));
            const unit = document.createElement("span");
            unit.className = "unit";
            unit.textContent = range.unit;
            const value_wrap = document.createElement("div");
            value_wrap.className = "value-wrap";
            value_wrap.append(number, unit);
            row.append(slider, value_wrap);
            container.append(row);
        }
        if (component.type === "switch") {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.textContent = component.closed
                ? strings.switch_state_closed[current_language]
                : strings.switch_state_open[current_language];
            toggle.addEventListener("click", () => {
                component.closed = !component.closed;
                rebuildSimulation();
                renderSelectionPanel();
            });
            container.append(toggle);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "selection-delete";
        remove.textContent = strings.selection_delete[current_language];
        remove.addEventListener("click", () => {
            components = components.filter((other) => other.id !== component.id);
            selected_id = null;
            rebuildSimulation();
            renderSelectionPanel();
        });
        container.append(remove);
    }

    /* buildSpeedButtons: segmented ×0.5 … ×4 playback speed control */
    function buildSpeedButtons() {
        const container = document.getElementById("speed_buttons");
        for (const speed of SPEED_OPTIONS) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = `×${speed}`;
            button.classList.toggle("active", speed === playback_speed);
            button.addEventListener("click", () => {
                playback_speed = speed;
                for (const sibling of container.children) {
                    sibling.classList.toggle("active", sibling === button);
                }
            });
            container.append(button);
        }
    }

    /* applyLanguage: swap every known data-i18n element and persist the choice */
    function applyLanguage(language) {
        current_language = language;
        localStorage.setItem("simulator_language", language);
        document.documentElement.lang = language;
        for (const element of document.querySelectorAll("[data-i18n]")) {
            const entry = strings[element.dataset.i18n];
            if (entry) {
                element.textContent = entry[language];
            }
        }
        document.getElementById("reset_button").title = strings.reset_hint[language];
        document.getElementById("zoom_fit_button").title = strings.zoom_fit_hint[language];
        document.getElementById("language_toggle").textContent = language === "fr" ? "EN" : "FR";
        setPlaying(is_playing);
        renderSelectionPanel();
    }

    /* init: build the circuit and controls, bind everything, start the render loop */
    function init() {
        buildDefaultCircuit();
        rebuildSimulation();
        buildToolButtons();
        buildSpeedButtons();
        camera.bind({
            zoom_in_id: "zoom_in_button",
            zoom_out_id: "zoom_out_button",
            zoom_fit_id: "zoom_fit_button",
            onFit: fitView,
        });

        canvas.addEventListener("pointerdown", (event) => {
            pointer_down_position = { x: event.clientX, y: event.clientY };
        });
        canvas.addEventListener("click", (event) => {
            if (pointer_down_position !== null
                && Math.hypot(event.clientX - pointer_down_position.x, event.clientY - pointer_down_position.y) > 6) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            handleCanvasClick(worldFromPixel(
                (event.clientX - rect.left) * canvas.width / rect.width,
                (event.clientY - rect.top) * canvas.height / rect.height,
            ));
        });

        document.getElementById("play_pause_button").addEventListener("click", () => {
            if (!is_playing && simulation_time >= SIMULATION_DURATION) {
                simulation_time = 0;
            }
            setPlaying(!is_playing);
        });
        document.getElementById("reset_button").addEventListener("click", () => {
            simulation_time = 0;
            setPlaying(false);
        });
        document.getElementById("step_back_button").addEventListener("click", () => stepTime(-TIME_STEP));
        document.getElementById("step_forward_button").addEventListener("click", () => stepTime(TIME_STEP));
        document.getElementById("timeline").addEventListener("input", (event) => {
            simulation_time = Number(event.target.value);
        });
        document.getElementById("language_toggle").addEventListener("click", () => {
            applyLanguage(current_language === "fr" ? "en" : "fr");
        });

        applyLanguage(current_language);
        fitView();
        requestAnimationFrame(animationFrame);
    }

    /* Game mode hook — remove together with game.js: normalizes the circuit to the
       game rules (sources 9 V, resistors 10 Ω, no capacitors) when the mode starts */
    globalThis.circuit_apply_game_constraints = () => {
        components = components.filter((component) => component.type !== "capacitor");
        for (const component of components) {
            if (component.type === "resistor") {
                component.value = DEFAULT_VALUES.resistor;
            }
            if (component.type === "source") {
                component.value = DEFAULT_VALUES.source;
            }
        }
        selected_id = null;
        rebuildSimulation();
        renderSelectionPanel();
    };

    init();
})();
