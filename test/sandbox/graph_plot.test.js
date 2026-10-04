import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/assets/js/canvas_draw.js';
import '../../src/assets/js/graph_plot.js';

function plot(points, options) {
    const labels = [], dots = [], lines = [];
    const context = new Proxy({}, {
        get: (_target, key) => {
            if (key === 'fillText') return (text, x, y) => labels.push({ text, x, y });
            if (key === 'arc') return (x, y) => dots.push({ x, y });
            if (key === 'moveTo' || key === 'lineTo') return (x, y) => lines.push({ x, y });
            if (key === 'measureText') return () => ({ width: 10 });
            return () => {};
        }, set: () => true,
    });
    const canvas = { width: 400, height: 200, clientWidth: 400, clientHeight: 200, getContext: () => context };
    globalThis.canvas_graph.drawTimeGraph(canvas, [{ label: 'x', color: 'blue', points }], options);
    return { labels, dots, lines };
}

test('rolling graph axes label absolute times and sample irregular timestamps correctly', () => {
    const { labels, dots } = plot([[0, 10000], [20, 2], [23, 3], [30, 4]], { time_min: 20, time_max: 30, cursor_time: 23 });
    const ticks = labels.filter((label) => label.y === 179 && label.text !== 't (s)');
    assert.equal(ticks[0].text, '20'); assert.equal(ticks[0].x, 46);
    assert.equal(ticks.at(-1).text, '30'); assert.equal(ticks.at(-1).x, 388);
    assert.equal(dots.length, 1);
    assert.ok(Math.abs(dots[0].x - (46 + .3 * 342)) < 1e-8);
    // The old outlier is excluded from y scaling, and the dot uses the sample at 23.
    assert.ok(Math.abs(dots[0].y - (20 + (1 - 3.32 / 4.64) * 154)) < 1e-8);
});

test('existing graphs still start at zero when no window is requested', () => {
    const { labels } = plot([[0, 1], [10, 2]], {});
    const ticks = labels.filter((label) => label.y === 179 && label.text !== 't (s)');
    assert.equal(ticks[0].text, '0'); assert.equal(ticks.at(-1).text, '10');
});
