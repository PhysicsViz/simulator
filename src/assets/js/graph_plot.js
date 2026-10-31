/*
 * graph_plot.js — Shared time-graph renderer (visual code only, no physics).
 * Imported by: mechanics/projectile-motion, mechanics/pendulum.
 * Draws one quantity-versus-time graph per canvas: auto-scaled axes with nice
 * ticks, one or more series as polylines, a live time cursor with value dots,
 * and colored series labels. Uses canvas_draw.niceStep for tick spacing.
 * Classic script; exposes globalThis.canvas_graph.
 */
(() => {
    const MARGIN_LEFT = 46;
    const MARGIN_RIGHT = 12;
    const MARGIN_TOP = 20;
    const MARGIN_BOTTOM = 26;

    /* drawTimeGraph: render series = [{label, color, points: [[t, value], ...]}]
       options = { cursor_time, unit, x_label, scale } — the x axis is time by
       default but any abscissa works (e.g. a distance profile with x_label:
       "d (m)"); scale (default 1) enlarges text and margins for large canvases */
    function drawTimeGraph(canvas, series, options = {}) {
        const scale = options.scale || 1;
        const margin_left = MARGIN_LEFT * scale;
        const margin_right = MARGIN_RIGHT * scale;
        const margin_top = MARGIN_TOP * scale;
        const margin_bottom = MARGIN_BOTTOM * scale;
        const context = canvas.getContext("2d");
        const client_width = Math.round(canvas.clientWidth);
        const client_height = Math.round(canvas.clientHeight);
        if (client_width > 0 && (canvas.width !== client_width || canvas.height !== client_height)) {
            canvas.width = client_width;
            canvas.height = client_height;
        }

        let time_max = 1e-9;
        let value_min = Infinity;
        let value_max = -Infinity;
        for (const single_series of series) {
            for (const [time, value] of single_series.points) {
                time_max = Math.max(time_max, time);
                value_min = Math.min(value_min, value);
                value_max = Math.max(value_max, value);
            }
        }
        value_min = Math.min(value_min, 0);
        value_max = Math.max(value_max, 0);
        if (value_max - value_min < 1e-9) {
            value_min -= 1;
            value_max += 1;
        }
        const value_pad = (value_max - value_min) * 0.08;
        value_min -= value_pad;
        value_max += value_pad;

        const plot_width = canvas.width - margin_left - margin_right;
        const plot_height = canvas.height - margin_top - margin_bottom;
        const toX = (time) => margin_left + (time / time_max) * plot_width;
        const toY = (value) => margin_top + (1 - (value - value_min) / (value_max - value_min)) * plot_height;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.font = `${Math.round(10 * scale)}px system-ui, sans-serif`;
        context.lineWidth = 1;

        const value_step = globalThis.canvas_draw.niceStep(value_max - value_min, 5);
        context.strokeStyle = "rgba(120, 130, 145, 0.18)";
        context.fillStyle = "#7a8494";
        context.beginPath();
        context.textAlign = "right";
        context.textBaseline = "middle";
        for (let k = Math.ceil(value_min / value_step); k * value_step <= value_max + 1e-9; k++) {
            context.moveTo(margin_left, toY(k * value_step));
            context.lineTo(canvas.width - margin_right, toY(k * value_step));
            context.fillText(formatTick(k * value_step), margin_left - 5 * scale, toY(k * value_step));
        }
        context.stroke();

        const time_step = globalThis.canvas_draw.niceStep(time_max, 6);
        context.beginPath();
        context.textAlign = "center";
        context.textBaseline = "top";
        for (let k = 0; k * time_step <= time_max + 1e-9; k++) {
            context.moveTo(toX(k * time_step), margin_top);
            context.lineTo(toX(k * time_step), canvas.height - margin_bottom);
            context.fillText(formatTick(k * time_step), toX(k * time_step), canvas.height - margin_bottom + 5 * scale);
        }
        context.stroke();

        context.strokeStyle = "rgba(120, 130, 145, 0.55)";
        context.beginPath();
        context.moveTo(margin_left, toY(0));
        context.lineTo(canvas.width - margin_right, toY(0));
        context.moveTo(margin_left, margin_top);
        context.lineTo(margin_left, canvas.height - margin_bottom);
        context.stroke();

        context.textAlign = "left";
        context.textBaseline = "top";
        if (options.unit) {
            context.fillText(options.unit, 4 * scale, 4 * scale);
        }
        context.textAlign = "right";
        context.fillText(options.x_label || "t (s)", canvas.width - margin_right, canvas.height - margin_bottom + 5 * scale);

        for (const single_series of series) {
            context.strokeStyle = single_series.color;
            context.lineWidth = 1.8 * scale;
            context.beginPath();
            single_series.points.forEach(([time, value], index) => {
                if (index === 0) {
                    context.moveTo(toX(time), toY(value));
                } else {
                    context.lineTo(toX(time), toY(value));
                }
            });
            context.stroke();
        }

        if (typeof options.cursor_time === "number") {
            const cursor_x = toX(Math.min(options.cursor_time, time_max));
            context.strokeStyle = "rgba(120, 130, 145, 0.7)";
            context.lineWidth = 1;
            context.setLineDash([3, 3]);
            context.beginPath();
            context.moveTo(cursor_x, margin_top);
            context.lineTo(cursor_x, canvas.height - margin_bottom);
            context.stroke();
            context.setLineDash([]);
            for (const single_series of series) {
                const value = sampleAt(single_series.points, options.cursor_time);
                if (value !== null) {
                    context.fillStyle = single_series.color;
                    context.beginPath();
                    context.arc(cursor_x, toY(value), 3.5 * scale, 0, 2 * Math.PI);
                    context.fill();
                }
            }
        }

        context.font = `bold ${Math.round(11 * scale)}px system-ui, sans-serif`;
        context.textAlign = "right";
        context.textBaseline = "top";
        let label_x = canvas.width - margin_right - 2 * scale;
        for (let i = series.length - 1; i >= 0; i--) {
            context.fillStyle = series[i].color;
            context.fillText(series[i].label, label_x, 4 * scale);
            label_x -= context.measureText(series[i].label).width + 12 * scale;
        }
        context.restore();
    }

    /* sampleAt: nearest-sample value of a points array at a given time */
    function sampleAt(points, time) {
        if (points.length === 0) {
            return null;
        }
        const last_time = points[points.length - 1][0];
        const ratio = last_time > 0 ? Math.min(Math.max(time / last_time, 0), 1) : 0;
        return points[Math.round(ratio * (points.length - 1))][1];
    }

    /* formatTick: compact numeric label for graph ticks */
    function formatTick(value) {
        return Number(value.toFixed(2)).toString();
    }

    globalThis.canvas_graph = { drawTimeGraph };
})();
