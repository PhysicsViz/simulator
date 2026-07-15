/*
 * calcul.js — DC/transient circuit solver (modified nodal analysis).
 * A circuit is a list of components, each on an edge between two grid nodes:
 * { id, type: "wire"|"resistor"|"source"|"switch"|"capacitor"|"ammeter",
 *   nodes: [node_a, node_b], value, closed }.
 * Kirchhoff's laws (sum of currents at each node = 0, sum of voltages around
 * each loop = 0) are solved simultaneously: resistors stamp conductances,
 * ideal voltage sources add a branch-current unknown (V_a − V_b = value),
 * capacitors use the backward-Euler companion model (G = C/dt plus a current
 * source remembering the previous voltage), wires / ammeters / closed switches
 * are tiny contact resistances, open switches conduct nothing. A small leak
 * conductance to ground keeps floating sub-circuits solvable. All quantities
 * in SI units; branch conventions: u = V_a − V_b, i flows from node_a to
 * node_b, P = u·i. Classic script (works via file://); exposes
 * globalThis.circuit_calcul.
 */
(() => {
    const CONTACT_RESISTANCE = 0.001;
    const LEAK_CONDUCTANCE = 1e-9;

    /* solveLinearSystem: Gaussian elimination with partial pivoting; returns x of A·x = z */
    function solveLinearSystem(matrix, vector) {
        const size = vector.length;
        const a = matrix.map((row, i) => [...row, vector[i]]);
        for (let column = 0; column < size; column++) {
            let pivot_row = column;
            for (let row = column + 1; row < size; row++) {
                if (Math.abs(a[row][column]) > Math.abs(a[pivot_row][column])) {
                    pivot_row = row;
                }
            }
            [a[column], a[pivot_row]] = [a[pivot_row], a[column]];
            const pivot = a[column][column];
            if (Math.abs(pivot) < 1e-15) {
                continue;
            }
            for (let row = 0; row < size; row++) {
                if (row === column) {
                    continue;
                }
                const factor = a[row][column] / pivot;
                for (let k = column; k <= size; k++) {
                    a[row][k] -= factor * a[column][k];
                }
            }
        }
        return a.map((row, i) => (Math.abs(row[i]) < 1e-15 ? 0 : row[size] / row[i]));
    }

    /* conductingResistance: ohmic resistance of a component, null when it does not conduct ohmically */
    function conductingResistance(component) {
        switch (component.type) {
            case "resistor":
                return Math.max(component.value, CONTACT_RESISTANCE);
            case "wire":
            case "ammeter":
                return CONTACT_RESISTANCE;
            case "switch":
                return component.closed ? CONTACT_RESISTANCE : null;
            default:
                return null;
        }
    }

    /* solveCircuit: one nodal solve; capacitor_voltages is a Map(id → previous u).
       Returns { voltages: Map(node → V), branches: Map(id → {voltage, current, power}),
       capacitor_voltages: Map(id → new u), node_count } */
    function solveCircuit(components, dt, capacitor_voltages = new Map()) {
        const node_ids = [...new Set(components.flatMap((component) => component.nodes))];
        const branches = new Map();
        const new_capacitor_voltages = new Map();
        if (node_ids.length === 0) {
            return { voltages: new Map(), branches, capacitor_voltages: new_capacitor_voltages, node_count: 0 };
        }
        const ground = node_ids[0];
        const index = new Map(node_ids.map((id, i) => [id, i - 1]));
        const node_unknowns = node_ids.length - 1;
        const sources = components.filter((component) => component.type === "source");
        const size = node_unknowns + sources.length;
        const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
        const vector = new Array(size).fill(0);

        /* stampConductance / stampCurrent: MNA stamps skipping the ground node (index −1) */
        function stampConductance(a, b, conductance) {
            if (a >= 0) {
                matrix[a][a] += conductance;
            }
            if (b >= 0) {
                matrix[b][b] += conductance;
            }
            if (a >= 0 && b >= 0) {
                matrix[a][b] -= conductance;
                matrix[b][a] -= conductance;
            }
        }
        function stampCurrent(node, current) {
            if (node >= 0) {
                vector[node] += current;
            }
        }

        for (let i = 0; i < node_unknowns; i++) {
            matrix[i][i] += LEAK_CONDUCTANCE;
        }
        for (const component of components) {
            const [a, b] = component.nodes.map((id) => index.get(id));
            const resistance = conductingResistance(component);
            if (resistance !== null) {
                stampConductance(a, b, 1 / resistance);
            } else if (component.type === "capacitor") {
                const conductance = component.value / dt;
                const previous_voltage = capacitor_voltages.get(component.id) || 0;
                stampConductance(a, b, conductance);
                stampCurrent(a, conductance * previous_voltage);
                stampCurrent(b, -conductance * previous_voltage);
            }
        }
        sources.forEach((source, k) => {
            const [a, b] = source.nodes.map((id) => index.get(id));
            const row = node_unknowns + k;
            if (a >= 0) {
                matrix[row][a] = 1;
                matrix[a][row] = 1;
            }
            if (b >= 0) {
                matrix[row][b] = -1;
                matrix[b][row] = -1;
            }
            vector[row] = source.value;
        });

        const solution = solveLinearSystem(matrix, vector);
        const voltages = new Map(node_ids.map((id) => {
            const i = index.get(id);
            return [id, i < 0 ? 0 : solution[i]];
        }));

        let source_number = 0;
        for (const component of components) {
            const voltage = voltages.get(component.nodes[0]) - voltages.get(component.nodes[1]);
            let current = 0;
            const resistance = conductingResistance(component);
            if (resistance !== null) {
                current = voltage / resistance;
            } else if (component.type === "capacitor") {
                const conductance = component.value / dt;
                current = conductance * (voltage - (capacitor_voltages.get(component.id) || 0));
                new_capacitor_voltages.set(component.id, voltage);
            } else if (component.type === "source") {
                current = solution[node_unknowns + source_number];
                source_number += 1;
            }
            branches.set(component.id, { voltage, current, power: voltage * current });
        }
        return { voltages, branches, capacitor_voltages: new_capacitor_voltages, node_count: node_ids.length };
    }

    /* simulate: march the capacitor states over `steps` backward-Euler steps of dt,
       starting from uncharged capacitors; returns one snapshot per step */
    function simulate(components, dt, steps) {
        let capacitor_voltages = new Map();
        const frames = [];
        for (let step = 0; step <= steps; step++) {
            const solved = solveCircuit(components, dt, capacitor_voltages);
            capacitor_voltages = solved.capacitor_voltages;
            frames.push({ time: step * dt, branches: solved.branches, node_count: solved.node_count });
        }
        return frames;
    }

    globalThis.circuit_calcul = {
        CONTACT_RESISTANCE,
        solveLinearSystem,
        conductingResistance,
        solveCircuit,
        simulate,
    };
})();
