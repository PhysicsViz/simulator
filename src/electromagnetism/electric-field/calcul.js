/*
 * calcul.js — Electric field of the three canonical sources from the course
 * formulary, and their superposition.
 * Sources (2D cross-section, SI units, k = 1/(4πε₀) = 8.988×10⁹ N·m²/C²):
 *   - point charge q:        E = k·q/r², radial;
 *   - infinite charged line: E = λ/(2πε₀·r) = 2·k·λ/r, radial from the line
 *     (drawn along its orientation, the field is perpendicular to it);
 *   - infinite charged plate: E = σ/(2·ε₀), uniform, perpendicular to the
 *     plate, pointing away when σ > 0.
 * Distances are clamped to MIN_DISTANCE so fields stay finite at the sources.
 * Elements: { type: "charge"|"line"|"plate", x, y, orientation, value } with
 * SI values (C, C/m, C/m²); other types (e.g. the probe) are ignored.
 * Classic script (works via file://); exposes globalThis.electric_field_calcul.
 */
(() => {
    const COULOMB_CONSTANT = 8.988e9;
    const VACUUM_PERMITTIVITY = 8.854e-12;
    const MIN_DISTANCE = 0.05;

    /* pointChargeField: E = k·q/r² directed away from (toward) a positive (negative) charge */
    function pointChargeField(charge, source_x, source_y, x, y) {
        const delta_x = x - source_x;
        const delta_y = y - source_y;
        const distance = Math.hypot(delta_x, delta_y);
        if (distance < 1e-12) {
            return { x: 0, y: 0 };
        }
        const clamped = Math.max(distance, MIN_DISTANCE);
        const magnitude = COULOMB_CONSTANT * charge / (clamped * clamped);
        return { x: magnitude * delta_x / distance, y: magnitude * delta_y / distance };
    }

    /* lineChargeField: E = 2·k·λ/d perpendicular to the infinite line */
    function lineChargeField(linear_density, source_x, source_y, orientation, x, y) {
        const offset = orientation === "vertical" ? x - source_x : y - source_y;
        const distance = Math.max(Math.abs(offset), MIN_DISTANCE);
        const direction = offset >= 0 ? 1 : -1;
        const magnitude = 2 * COULOMB_CONSTANT * linear_density / distance;
        return orientation === "vertical"
            ? { x: magnitude * direction, y: 0 }
            : { x: 0, y: magnitude * direction };
    }

    /* plateField: E = σ/(2·ε₀), uniform, away from the plate when σ > 0 */
    function plateField(surface_density, source_x, source_y, orientation, x, y) {
        const offset = orientation === "vertical" ? x - source_x : y - source_y;
        const direction = offset >= 0 ? 1 : -1;
        const magnitude = surface_density / (2 * VACUUM_PERMITTIVITY);
        return orientation === "vertical"
            ? { x: magnitude * direction, y: 0 }
            : { x: 0, y: magnitude * direction };
    }

    /* totalField: superposition of every field-creating element at (x, y) */
    function totalField(elements, x, y) {
        const field = { x: 0, y: 0 };
        for (const element of elements) {
            let contribution = null;
            if (element.type === "charge") {
                contribution = pointChargeField(element.value, element.x, element.y, x, y);
            } else if (element.type === "line") {
                contribution = lineChargeField(element.value, element.x, element.y, element.orientation, x, y);
            } else if (element.type === "plate") {
                contribution = plateField(element.value, element.x, element.y, element.orientation, x, y);
            }
            if (contribution !== null) {
                field.x += contribution.x;
                field.y += contribution.y;
            }
        }
        return field;
    }

    /* fieldMagnitude: |E| */
    function fieldMagnitude(field) {
        return Math.hypot(field.x, field.y);
    }

    globalThis.electric_field_calcul = {
        COULOMB_CONSTANT,
        VACUUM_PERMITTIVITY,
        MIN_DISTANCE,
        pointChargeField,
        lineChargeField,
        plateField,
        totalField,
        fieldMagnitude,
    };
})();
