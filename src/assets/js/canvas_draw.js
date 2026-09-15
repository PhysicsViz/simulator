/*
 * canvas_draw.js — Shared canvas rendering helpers (visual code only, no physics).
 * Imported by: mechanics/projectile-motion.
 * Provides vector arrows with labels, a scaled metric grid with axes, and a
 * "nice" step chooser for grid spacing. All drawing happens in screen pixels;
 * callers pass world→screen conversion functions where needed.
 * Classic script (no ES module exports) so pages work when opened via file://.
 * Exposes globalThis.canvas_draw.
 */
(() => {
    /* niceStep: pick a 1/2/5×10^n step so the axis shows a readable number of ticks */
    function niceStep(world_span, target_tick_count = 8) {
        const raw_step = world_span / target_tick_count;
        const magnitude = Math.pow(10, Math.floor(Math.log10(raw_step)));
        const normalized = raw_step / magnitude;
        let factor;
        if (normalized <= 1) {
            factor = 1;
        } else if (normalized <= 2) {
            factor = 2;
        } else if (normalized <= 5) {
            factor = 5;
        } else {
            factor = 10;
        }
        return factor * magnitude;
    }

    /* formatTick: compact numeric label for grid ticks */
    function formatTick(value) {
        return Number(value.toFixed(2)).toString();
    }

    /* drawGrid: metric grid filling the whole canvas for the visible world rectangle
       world_bounds = { left, right, bottom, top } in meters; tick labels hug the
       axes when visible and clamp to the canvas edges otherwise */
    function drawGrid(context, toScreenX, toScreenY, world_bounds, options = {}) {
        const {
            grid_color = "rgba(120, 130, 145, 0.18)",
            axis_color = "rgba(120, 130, 145, 0.55)",
            label_color = "#7a8494",
            font = "11px system-ui, sans-serif",
        } = options;
        const canvas_width = context.canvas.width;
        const canvas_height = context.canvas.height;
        const step = niceStep(Math.max(world_bounds.right - world_bounds.left, world_bounds.top - world_bounds.bottom));
        const label_y = Math.min(Math.max(toScreenY(0) + 6, 6), canvas_height - 15);
        const label_x = Math.min(Math.max(toScreenX(0) - 8, 34), canvas_width - 6);

        context.save();
        context.lineWidth = 1;
        context.font = font;
        context.fillStyle = label_color;

        context.strokeStyle = grid_color;
        context.beginPath();
        for (let k = Math.ceil(world_bounds.left / step); k * step <= world_bounds.right + 1e-9; k++) {
            context.moveTo(toScreenX(k * step), 0);
            context.lineTo(toScreenX(k * step), canvas_height);
        }
        for (let k = Math.ceil(world_bounds.bottom / step); k * step <= world_bounds.top + 1e-9; k++) {
            context.moveTo(0, toScreenY(k * step));
            context.lineTo(canvas_width, toScreenY(k * step));
        }
        context.stroke();

        context.textAlign = "center";
        context.textBaseline = "top";
        for (let k = Math.ceil(world_bounds.left / step); k * step <= world_bounds.right + 1e-9; k++) {
            context.fillText(formatTick(k * step), toScreenX(k * step), label_y);
        }
        context.textAlign = "right";
        context.textBaseline = "middle";
        for (let k = Math.ceil(world_bounds.bottom / step); k * step <= world_bounds.top + 1e-9; k++) {
            if (k !== 0) {
                context.fillText(formatTick(k * step), label_x, toScreenY(k * step));
            }
        }

        context.strokeStyle = axis_color;
        context.beginPath();
        if (world_bounds.bottom <= 0 && world_bounds.top >= 0) {
            context.moveTo(0, toScreenY(0));
            context.lineTo(canvas_width, toScreenY(0));
        }
        if (world_bounds.left <= 0 && world_bounds.right >= 0) {
            context.moveTo(toScreenX(0), 0);
            context.lineTo(toScreenX(0), canvas_height);
        }
        context.stroke();

        context.restore();
    }

    /* drawVector: arrow from (start_x, start_y) along (delta_x, delta_y), in screen pixels */
    function drawVector(context, start_x, start_y, delta_x, delta_y, options = {}) {
        const {
            color = "#000000",
            line_width = 2.5,
            dash = [],
            label = "",
            font = "bold 13px system-ui, sans-serif",
        } = options;
        const length = Math.hypot(delta_x, delta_y);
        if (length < 1) {
            return;
        }
        const end_x = start_x + delta_x;
        const end_y = start_y + delta_y;
        const head_size = Math.min(10, 4 + length * 0.06);
        const angle = Math.atan2(delta_y, delta_x);

        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = line_width;
        context.setLineDash(dash);
        context.beginPath();
        context.moveTo(start_x, start_y);
        context.lineTo(end_x - head_size * 0.6 * Math.cos(angle), end_y - head_size * 0.6 * Math.sin(angle));
        context.stroke();

        context.setLineDash([]);
        context.beginPath();
        context.moveTo(end_x, end_y);
        context.lineTo(end_x - head_size * Math.cos(angle - 0.42), end_y - head_size * Math.sin(angle - 0.42));
        context.lineTo(end_x - head_size * Math.cos(angle + 0.42), end_y - head_size * Math.sin(angle + 0.42));
        context.closePath();
        context.fill();

        if (label !== "") {
            const offset = 14;
            context.font = font;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(label, end_x + offset * Math.cos(angle), end_y + offset * Math.sin(angle));
        }
        context.restore();
    }

    globalThis.canvas_draw = { niceStep, drawGrid, drawVector };
})();
