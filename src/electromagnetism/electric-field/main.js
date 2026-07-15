/*
 * main.js — Electric field map page logic: free-placement editor (drop point
 * charges, infinite charged lines and plates anywhere, drag them around, edit
 * their values and orientations), a draggable field probe with a live readout,
 * a superposed field-arrow grid over the whole visible area (log-scaled
 * lengths), formula cards following the course formulary (k = 1/(4πε₀),
 * E = k·q/r², E = λ/(2πε₀·r), E = σ/(2·ε₀), superposition) and a field-profile
 * graph |E|(d) along the ray from the selected source through the probe —
 * showing the 1/r², 1/r and constant laws. Static fields: no transport panel;
 * the graph plots a distance profile instead of time. Classic script (works
 * via file://); reads the globals of calcul.js, canvas_draw.js,
 * scene_camera.js, graph_plot.js.
 */
(() => {
    const calc = globalThis.electric_field_calcul;
    const draw = globalThis.canvas_draw;
    const graph = globalThis.canvas_graph;

    const strings = {
        page_title: { fr: "Champ électrique", en: "Electric field" },
        assumption: {
            fr: "Hypothèses : sources idéales en coupe 2D — charge ponctuelle (E = k·q/r²), ligne infinie uniformément chargée (E = λ/(2πε₀·r)) et plaque infinie uniformément chargée (E = σ/(2ε₀), uniforme). Champ total par superposition. Choisissez un outil et cliquez pour placer librement ; glissez un élément pour le déplacer ; la sonde dorée mesure E⃗ à sa position.",
            en: "Assumptions: ideal sources in a 2D cross-section — point charge (E = k·q/r²), uniformly charged infinite line (E = λ/(2πε₀·r)) and uniformly charged infinite plate (E = σ/(2ε₀), uniform). Total field by superposition. Pick a tool and click to place freely; drag an element to move it; the golden probe measures E⃗ at its position.",
        },
        controls_title: { fr: "Éléments", en: "Elements" },
        selection_title: { fr: "Sélection", en: "Selection" },
        formulas_title: { fr: "Formules", en: "Formulas" },
        graphs_title: { fr: "Profil du champ", en: "Field profile" },
        graph_profile: {
            fr: "|E| en fonction de la distance d à la source sélectionnée (vers la sonde)",
            en: "|E| versus the distance d from the selected source (toward the probe)",
        },
        zoom_fit_hint: { fr: "Recentrer la vue", en: "Recenter the view" },
        tool_select: { fr: "Sélection / déplacer", en: "Select / move" },
        tool_charge: { fr: "Charge ponctuelle", en: "Point charge" },
        tool_line: { fr: "Ligne chargée", en: "Charged line" },
        tool_plate: { fr: "Plaque chargée", en: "Charged plate" },
        tool_probe: { fr: "Sonde", en: "Probe" },
        tool_delete: { fr: "Supprimer", en: "Delete" },
        selection_none: { fr: "Cliquez un élément pour l'éditer.", en: "Click an element to edit it." },
        selection_delete: { fr: "Supprimer cet élément", en: "Delete this element" },
        orientation_horizontal: { fr: "Orientation : horizontale (cliquer pour changer)", en: "Orientation: horizontal (click to change)" },
        orientation_vertical: { fr: "Orientation : verticale (cliquer pour changer)", en: "Orientation: vertical (click to change)" },
        type_charge: { fr: "Charge ponctuelle q", en: "Point charge q" },
        type_line: { fr: "Ligne chargée λ", en: "Charged line λ" },
        type_plate: { fr: "Plaque chargée σ", en: "Charged plate σ" },
        type_probe: { fr: "Sonde de champ", en: "Field probe" },
        formula_constant: { fr: "Constante de Coulomb", en: "Coulomb constant" },
        formula_point: { fr: "Charge ponctuelle", en: "Point charge" },
        formula_line: { fr: "Ligne infinie", en: "Infinite line" },
        formula_plate: { fr: "Plaque infinie", en: "Infinite plate" },
        formula_superposition: { fr: "Superposition", en: "Superposition" },
        formula_ex: { fr: "Composante Eₓ à la sonde", en: "Eₓ component at the probe" },
        formula_ey: { fr: "Composante E_y à la sonde", en: "E_y component at the probe" },
        formula_magnitude: { fr: "Norme à la sonde", en: "Magnitude at the probe" },
        elements_count: { fr: "éléments", en: "elements" },
        no_component: { fr: "—", en: "—" },
        series_total: { fr: "total", en: "total" },
        series_selected: { fr: "source seule", en: "source alone" },
    };

    const SNAP = 0.1;
    const DEFAULT_VALUES = { charge: 3e-6, line: 1e-6, plate: 0.5e-6 };

    const canvas = document.getElementById("simulation_canvas");
    const context = canvas.getContext("2d");
    const camera = globalThis.scene_camera.createCamera(canvas);
    const number_formatters = {
        fr: new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };

    let current_language = localStorage.getItem("simulator_language") || "fr";
    let component_counter = 0;
    let elements = [];
    let selected_id = null;
    let active_tool = "select";
    let dragged_id = null;
    let pointer_down_position = null;

    /* Game mode hook — game.js sets the "game-mode" body class; without game.js
       this is always false and the editor behaves normally */
    function gameLocked() {
        return document.body.classList.contains("game-mode");
    }

    /* formatNumber: locale-aware number with 2 decimals (comma in FR, dot in EN) */
    function formatNumber(value) {
        return number_formatters[current_language].format(value);
    }

    /* formatField: adaptive field unit (V/m below 1000, kV/m above) */
    function formatField(value) {
        return Math.abs(value) >= 1000
            ? `${formatNumber(value / 1000)} kV/m`
            : `${formatNumber(value)} V/m`;
    }

    /* newElement: create an element with the type's default value */
    function newElement(type, x, y) {
        component_counter += 1;
        return {
            id: `element_${component_counter}`,
            type,
            x,
            y,
            orientation: "vertical",
            value: DEFAULT_VALUES[type] || 0,
        };
    }

    /* buildDefaultScene: a dipole and the probe */
    function buildDefaultScene() {
        const positive = newElement("charge", -2, 0);
        const negative = newElement("charge", 2, 0);
        negative.value = -3e-6;
        const probe = newElement("probe", 0, 1.5);
        elements = [positive, negative, probe];
    }

    /* probeElement: the (single) probe, or null */
    function probeElement() {
        return elements.find((element) => element.type === "probe") || null;
    }

    /* selectedElement / selectedSource: current selection helpers */
    function selectedElement() {
        return elements.find((element) => element.id === selected_id) || null;
    }
    function selectedSource() {
        const selected = selectedElement();
        if (selected && selected.type !== "probe") {
            return selected;
        }
        return elements.find((element) => element.type !== "probe") || null;
    }

    /* totalFieldAt: superposed field of the placed elements (plus the game's
       hidden source, when the game mode provides one) */
    function totalFieldAt(x, y) {
        const field = calc.totalField(elements, x, y);
        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.electric_field_game_extra_field === "function") {
            const extra = globalThis.electric_field_game_extra_field(x, y);
            if (extra !== null) {
                field.x += extra.x;
                field.y += extra.y;
            }
        }
        return field;
    }

    /* inkColor: foreground color matching the light/dark scheme, for canvas strokes */
    function inkColor() {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "#e8ecf3" : "#1c2026";
    }

    /* fitView: frame the working area */
    function fitView() {
        camera.fitTo({ left: -5.5, right: 5.5, bottom: -3.4, top: 3.4 });
    }

    /* worldFromPixel: inverse camera mapping for pointer interactions */
    function worldFromPixel(pixel_x, pixel_y) {
        const bounds = camera.transform().bounds;
        return {
            x: bounds.left + (pixel_x / canvas.width) * (bounds.right - bounds.left),
            y: bounds.top - (pixel_y / canvas.height) * (bounds.top - bounds.bottom),
        };
    }

    /* pixelFromEvent: pointer event → internal canvas pixels */
    function pixelFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * canvas.width / rect.width,
            y: (event.clientY - rect.top) * canvas.height / rect.height,
        };
    }

    /* elementAt: element under the point — discs by distance, infinite lines and
       plates by perpendicular distance to their axis */
    function elementAt(world) {
        let best = null;
        let best_distance = 0.4;
        for (const element of elements) {
            let distance;
            if (element.type === "line" || element.type === "plate") {
                distance = element.orientation === "vertical"
                    ? Math.abs(world.x - element.x)
                    : Math.abs(world.y - element.y);
                distance += 0.1;
            } else {
                distance = Math.hypot(world.x - element.x, world.y - element.y);
            }
            if (distance < best_distance) {
                best = element;
                best_distance = distance;
            }
        }
        return best;
    }

    /* snap: free placement on a fine 0.1 m grid (only to keep readouts tidy) */
    function snap(value) {
        return Math.round(value / SNAP) * SNAP;
    }

    /* handleCanvasClick: place with the active tool, or select/delete */
    function handleCanvasClick(world) {
        if (active_tool === "select") {
            const element = elementAt(world);
            selected_id = element ? element.id : null;
            renderSelectionPanel();
            return;
        }
        if (active_tool === "delete") {
            const element = elementAt(world);
            if (element) {
                elements = elements.filter((other) => other.id !== element.id);
                if (selected_id === element.id) {
                    selected_id = null;
                }
                renderSelectionPanel();
            }
            return;
        }
        if (gameLocked()) {
            return;
        }
        if (active_tool === "probe") {
            const existing = probeElement();
            if (existing) {
                existing.x = snap(world.x);
                existing.y = snap(world.y);
                selected_id = existing.id;
                renderSelectionPanel();
                return;
            }
        }
        const element = newElement(active_tool, snap(world.x), snap(world.y));
        elements.push(element);
        selected_id = element.id;
        renderSelectionPanel();
    }

    /* drawFieldArrows: log-scaled arrows of the total field across the view */
    function drawFieldArrows(transform) {
        /* Game mode hook — the field map would give the hidden charge away */
        if (gameLocked()) {
            return;
        }
        const bounds = transform.bounds;
        const step = Math.max((bounds.right - bounds.left) / 18, 0.3);
        for (let x = Math.ceil(bounds.left / step) * step; x <= bounds.right; x += step) {
            for (let y = Math.ceil(bounds.bottom / step) * step; y <= bounds.top; y += step) {
                const field = totalFieldAt(x, y);
                const magnitude = calc.fieldMagnitude(field);
                if (magnitude < 1) {
                    continue;
                }
                const length = Math.min(6 + 9 * Math.log10(1 + magnitude / 100), 34);
                draw.drawVector(
                    context,
                    transform.toScreenX(x) - (field.x / magnitude) * length / 2,
                    transform.toScreenY(y) + (field.y / magnitude) * length / 2,
                    (field.x / magnitude) * length,
                    -(field.y / magnitude) * length,
                    { color: "rgba(38, 166, 154, 0.55)", line_width: 1.5 },
                );
            }
        }
    }

    /* drawElement: charge disc, infinite line, plate slab or the probe */
    function drawElement(element, transform, ink) {
        const selected = element.id === selected_id;
        const screen_x = transform.toScreenX(element.x);
        const screen_y = transform.toScreenY(element.y);
        context.save();
        if (element.type === "charge") {
            context.fillStyle = element.value >= 0 ? "#d32f2f" : "#1976d2";
            context.strokeStyle = selected ? "#fbc02d" : "#ffffff";
            context.lineWidth = selected ? 3 : 2;
            context.beginPath();
            context.arc(screen_x, screen_y, 11, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
            context.fillStyle = "#ffffff";
            context.font = "bold 14px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(element.value >= 0 ? "+" : "−", screen_x, screen_y);
            context.fillStyle = ink;
            context.font = "11px system-ui, sans-serif";
            context.textBaseline = "top";
            context.fillText(`${formatNumber(element.value * 1e6)} µC`, screen_x, screen_y + 15);
        } else if (element.type === "line" || element.type === "plate") {
            const positive = element.value >= 0;
            context.strokeStyle = positive ? "#d32f2f" : "#1976d2";
            context.lineWidth = element.type === "plate" ? 7 : 2.5;
            if (element.type === "line") {
                context.setLineDash([9, 5]);
            }
            if (selected) {
                context.shadowColor = "#fbc02d";
                context.shadowBlur = 8;
            }
            context.beginPath();
            if (element.orientation === "vertical") {
                context.moveTo(screen_x, 0);
                context.lineTo(screen_x, canvas.height);
            } else {
                context.moveTo(0, screen_y);
                context.lineTo(canvas.width, screen_y);
            }
            context.stroke();
            context.setLineDash([]);
            context.shadowBlur = 0;
            context.fillStyle = positive ? "#d32f2f" : "#1976d2";
            context.font = "11px system-ui, sans-serif";
            context.textAlign = "left";
            context.textBaseline = "bottom";
            const unit = element.type === "line" ? "µC/m" : "µC/m²";
            const symbol = element.type === "line" ? "λ" : "σ";
            const label = `${symbol} = ${formatNumber(element.value * 1e6)} ${unit}`;
            if (element.orientation === "vertical") {
                context.fillText(label, screen_x + 8, 18);
            } else {
                context.fillText(label, 8, screen_y - 8);
            }
        } else if (element.type === "probe") {
            const field = totalFieldAt(element.x, element.y);
            const magnitude = calc.fieldMagnitude(field);
            if (magnitude > 1e-9) {
                const length = Math.min(18 + 12 * Math.log10(1 + magnitude / 100), 70);
                draw.drawVector(
                    context,
                    screen_x,
                    screen_y,
                    (field.x / magnitude) * length,
                    -(field.y / magnitude) * length,
                    { color: "#b8860b", line_width: 3, label: "E" },
                );
            }
            context.strokeStyle = "#b8860b";
            context.fillStyle = "rgba(251, 192, 45, 0.35)";
            context.lineWidth = selected ? 3.5 : 2.5;
            context.beginPath();
            context.arc(screen_x, screen_y, 8, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
            context.fillStyle = "#b8860b";
            context.font = "bold 12px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(`|E| = ${formatField(magnitude)}`, screen_x, screen_y + 13);
        }
        context.restore();
    }

    /* drawScene: grid, field arrows, elements and the game overlay */
    function drawScene(transform) {
        const ink = inkColor();
        context.clearRect(0, 0, canvas.width, canvas.height);
        draw.drawGrid(context, transform.toScreenX, transform.toScreenY, transform.bounds);
        drawFieldArrows(transform);
        for (const element of elements) {
            if (element.type !== "probe") {
                drawElement(element, transform, ink);
            }
        }
        const probe = probeElement();
        if (probe) {
            drawElement(probe, transform, ink);
        }

        /* Game mode hook — remove together with game.js */
        if (typeof globalThis.electric_field_game_overlay === "function") {
            const field = probe ? totalFieldAt(probe.x, probe.y) : { x: 0, y: 0 };
            globalThis.electric_field_game_overlay(context, transform, {
                probe_x: probe ? probe.x : null,
                probe_y: probe ? probe.y : null,
                field,
            });
        }
    }

    /* updateFormulas: refresh every formula card */
    function updateFormulas() {
        const none = strings.no_component[current_language];
        const probe = probeElement();
        const field = probe ? totalFieldAt(probe.x, probe.y) : { x: 0, y: 0 };
        const first_charge = elements.find((element) => element.type === "charge") || null;
        const first_line = elements.find((element) => element.type === "line") || null;
        const first_plate = elements.find((element) => element.type === "plate") || null;

        let point_card = { substitution: none, result: none };
        if (first_charge && probe) {
            const distance = Math.max(Math.hypot(probe.x - first_charge.x, probe.y - first_charge.y), calc.MIN_DISTANCE);
            point_card = {
                substitution: `8,99×10⁹ × (${formatNumber(first_charge.value * 1e6)} × 10⁻⁶) / ${formatNumber(distance)}²`,
                result: formatField(calc.COULOMB_CONSTANT * Math.abs(first_charge.value) / (distance * distance)),
            };
        }
        let line_card = { substitution: none, result: none };
        if (first_line && probe) {
            const distance = Math.max(
                first_line.orientation === "vertical" ? Math.abs(probe.x - first_line.x) : Math.abs(probe.y - first_line.y),
                calc.MIN_DISTANCE,
            );
            line_card = {
                substitution: `2 × 8,99×10⁹ × (${formatNumber(first_line.value * 1e6)} × 10⁻⁶) / ${formatNumber(distance)}`,
                result: formatField(2 * calc.COULOMB_CONSTANT * Math.abs(first_line.value) / distance),
            };
        }
        let plate_card = { substitution: none, result: none };
        if (first_plate) {
            plate_card = {
                substitution: `(${formatNumber(first_plate.value * 1e6)} × 10⁻⁶) / (2 × 8,854×10⁻¹²)`,
                result: formatField(Math.abs(first_plate.value) / (2 * calc.VACUUM_PERMITTIVITY)),
            };
        }
        const source_count = elements.filter((element) => element.type !== "probe").length;
        const cards = {
            constant: {
                substitution: "1 / (4π × 8,854×10⁻¹²)",
                result: "8,99×10⁹ N·m²/C²",
            },
            point: point_card,
            line: line_card,
            plate: plate_card,
            superposition: {
                substitution: `E⃗ = Σ E⃗ᵢ`,
                result: `${source_count} ${strings.elements_count[current_language]}`,
            },
            ex: {
                substitution: probe ? `x = ${formatNumber(probe.x)} m` : none,
                result: probe ? formatField(field.x) : none,
            },
            ey: {
                substitution: probe ? `y = ${formatNumber(probe.y)} m` : none,
                result: probe ? formatField(field.y) : none,
            },
            magnitude: {
                substitution: probe ? `√(Eₓ² + E_y²)` : none,
                result: probe ? formatField(calc.fieldMagnitude(field)) : none,
            },
        };
        for (const [key, content] of Object.entries(cards)) {
            document.getElementById(`sub_${key}`).textContent = content.substitution;
            document.getElementById(`res_${key}`).textContent = content.result;
        }
    }

    /* drawProfileGraph: |E|(d) along the ray from the selected source to the probe */
    function drawProfileGraph() {
        const source = selectedSource();
        const probe = probeElement();
        const total_points = [];
        const source_points = [];
        if (source && probe) {
            let direction_x = probe.x - source.x;
            let direction_y = probe.y - source.y;
            const probe_distance = Math.hypot(direction_x, direction_y);
            if (probe_distance < 1e-6) {
                direction_x = 1;
                direction_y = 0;
            } else {
                direction_x /= probe_distance;
                direction_y /= probe_distance;
            }
            const max_distance = Math.max(2 * probe_distance, 4);
            for (let i = 1; i <= 120; i++) {
                const distance = (max_distance * i) / 120;
                const x = source.x + direction_x * distance;
                const y = source.y + direction_y * distance;
                total_points.push([distance, calc.fieldMagnitude(totalFieldAt(x, y))]);
                source_points.push([distance, calc.fieldMagnitude(calc.totalField([source], x, y))]);
            }
            graph.drawTimeGraph(document.getElementById("graph_profile"), [
                { label: strings.series_total[current_language], color: "#1976d2", points: total_points },
                { label: strings.series_selected[current_language], color: "#d32f2f", points: source_points },
            ], { cursor_time: probe_distance, unit: "V/m", x_label: "d (m)" });
        }
    }

    /* render: scene + formulas + profile graph */
    function render() {
        if (camera.syncSize() && !camera.isTouched()) {
            fitView();
        }
        drawScene(camera.transform());
        updateFormulas();
        if (!gameLocked()) {
            drawProfileGraph();
        }
    }

    /* animationFrame: continuous redraw (drag, camera, game effects) */
    function animationFrame() {
        render();
        requestAnimationFrame(animationFrame);
    }

    /* buildToolButtons: one button per editor tool */
    function buildToolButtons() {
        const container = document.getElementById("tool_buttons");
        const tools = ["select", "charge", "line", "plate", "probe", "delete"];
        for (const tool of tools) {
            const button = document.createElement("button");
            button.type = "button";
            button.id = `tool_${tool}`;
            button.dataset.i18n = `tool_${tool}`;
            button.classList.toggle("active", tool === active_tool);
            button.addEventListener("click", () => {
                active_tool = tool;
                for (const sibling of container.children) {
                    sibling.classList.toggle("active", sibling === button);
                }
            });
            container.append(button);
        }
    }

    /* renderSelectionPanel: value editor for the selected element */
    function renderSelectionPanel() {
        const container = document.getElementById("selection_rows");
        container.textContent = "";
        const element = selectedElement();
        if (!element) {
            const hint = document.createElement("p");
            hint.className = "selection-hint";
            hint.textContent = strings.selection_none[current_language];
            container.append(hint);
            return;
        }
        const title = document.createElement("p");
        title.className = "selection-type";
        title.textContent = strings[`type_${element.type}`][current_language];
        container.append(title);

        const ranges = {
            charge: { min: -10, max: 10, step: 0.1, unit: "µC", scale: 1e6 },
            line: { min: -5, max: 5, step: 0.1, unit: "µC/m", scale: 1e6 },
            plate: { min: -2, max: 2, step: 0.05, unit: "µC/m²", scale: 1e6 },
        };
        const range = ranges[element.type];
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
                input.value = Math.round(element.value * range.scale * 100) / 100;
                input.disabled = gameLocked();
            }
            const apply = (raw_value, mirror) => {
                const value = Number(raw_value);
                if (!Number.isFinite(value)) {
                    return;
                }
                element.value = value / range.scale;
                mirror.value = raw_value;
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
        if (element.type === "line" || element.type === "plate") {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.textContent = element.orientation === "horizontal"
                ? strings.orientation_horizontal[current_language]
                : strings.orientation_vertical[current_language];
            toggle.addEventListener("click", () => {
                element.orientation = element.orientation === "horizontal" ? "vertical" : "horizontal";
                renderSelectionPanel();
            });
            container.append(toggle);
        }
        if (element.type !== "probe") {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "selection-delete";
            remove.textContent = strings.selection_delete[current_language];
            remove.addEventListener("click", () => {
                elements = elements.filter((other) => other.id !== element.id);
                selected_id = null;
                renderSelectionPanel();
            });
            container.append(remove);
        }
    }

    /* bindPointer: element dragging (captures before the camera's pan) + placement clicks */
    function bindPointer() {
        canvas.addEventListener("pointerdown", (event) => {
            pointer_down_position = { x: event.clientX, y: event.clientY };
            if (active_tool !== "select") {
                return;
            }
            const pixel = pixelFromEvent(event);
            const element = elementAt(worldFromPixel(pixel.x, pixel.y));
            if (element) {
                dragged_id = element.id;
                selected_id = element.id;
                renderSelectionPanel();
                event.stopImmediatePropagation();
                canvas.setPointerCapture(event.pointerId);
            }
        });
        canvas.addEventListener("pointermove", (event) => {
            if (dragged_id === null) {
                return;
            }
            const element = elements.find((other) => other.id === dragged_id);
            if (!element || (gameLocked() && element.type !== "probe")) {
                return;
            }
            const pixel = pixelFromEvent(event);
            const world = worldFromPixel(pixel.x, pixel.y);
            element.x = snap(world.x);
            element.y = snap(world.y);
            event.stopImmediatePropagation();
        });
        for (const event_name of ["pointerup", "pointercancel"]) {
            canvas.addEventListener(event_name, () => {
                dragged_id = null;
            });
        }
        canvas.addEventListener("click", (event) => {
            if (pointer_down_position !== null
                && Math.hypot(event.clientX - pointer_down_position.x, event.clientY - pointer_down_position.y) > 6) {
                return;
            }
            if (active_tool === "select" && dragged_id !== null) {
                return;
            }
            const pixel = pixelFromEvent(event);
            handleCanvasClick(worldFromPixel(pixel.x, pixel.y));
        });
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
        document.getElementById("zoom_fit_button").title = strings.zoom_fit_hint[language];
        document.getElementById("language_toggle").textContent = language === "fr" ? "EN" : "FR";
        renderSelectionPanel();
    }

    /* init: build the scene and controls, bind everything, start the render loop */
    function init() {
        buildDefaultScene();
        buildToolButtons();
        bindPointer();
        camera.bind({
            zoom_in_id: "zoom_in_button",
            zoom_out_id: "zoom_out_button",
            zoom_fit_id: "zoom_fit_button",
            onFit: fitView,
        });
        document.getElementById("language_toggle").addEventListener("click", () => {
            applyLanguage(current_language === "fr" ? "en" : "fr");
        });
        applyLanguage(current_language);
        fitView();
        requestAnimationFrame(animationFrame);
    }

    /* Game mode hook — remove together with game.js: clears the sources (the probe
       stays), blocks placement and value edits while the game runs */
    globalThis.electric_field_apply_game_constraints = () => {
        elements = elements.filter((element) => element.type === "probe");
        selected_id = null;
        active_tool = "select";
        for (const button of document.querySelectorAll("#tool_buttons button")) {
            button.classList.toggle("active", button.id === "tool_select");
        }
        renderSelectionPanel();
    };

    init();
})();
