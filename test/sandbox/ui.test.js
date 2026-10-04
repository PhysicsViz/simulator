/* Exercise UI handlers with a minimal DOM; canvas rendering is stubbed. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = (name) => fs.readFileSync(new URL(`../../src/sandbox/${name}`, import.meta.url), 'utf8');
class Element {
    constructor(tag = 'div') {
        this.tag = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.value = ''; this.min = ''; this.max = ''; this.checked = false;
        this.style = { setProperty() {} }; this.classList = { toggle() {} };
        this.clientWidth = 400; this.clientHeight = 200; this.width = 400; this.height = 200;
    }
    append(...children) { for (const child of children) child.parent = this; this.children.push(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
    getContext() { return new Proxy({}, { get: (_target, key) => key === 'measureText' ? () => ({ width: 20 }) : () => {}, set: () => true }); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute() {}
    descendants() { const walk = (node) => (node.children || []).flatMap((child) => [child, ...walk(child)]); return walk(this); }
    querySelectorAll() { return this.descendants().filter((el) => el.type === 'number'); }
    get elements() { return { namedItem: (name) => this.descendants().find((el) => el.name === name) }; }
    focus() {}
    setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0 }; }
    dispatch(name, event = {}) { this.listeners[name]?.({ preventDefault() {}, ...event }); }
}
function harness(store = new Map()) {
    const elements = {};
    for (const match of source('index.html').matchAll(/id="([^"]+)"/g)) elements[match[1]] = new Element();
    elements.scene.clientWidth = 800; elements.scene.clientHeight = 420;
    elements.scene.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
    elements.connection_mode.value = 'mutual'; elements.speed.value = '1'; elements.gravity.value = '9.81'; elements.graph_window.value = '10';
    elements.properties.children = [elements.fields];
    let world, frame;
    const sandbox = {
        document: { getElementById: (id) => elements[id], createElement: (tag) => new Element(tag), createTextNode: (text) => ({ text }), querySelectorAll: () => [], documentElement: {} },
        localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
        window: { devicePixelRatio: 1, addEventListener() {}, matchMedia() { return { addEventListener() {} }; } },
        requestAnimationFrame: (fn) => { frame = fn; }, getComputedStyle: () => ({ getPropertyValue: () => '#888888' }),
    };
    vm.createContext(sandbox);
    for (const name of ['../assets/js/canvas_draw.js', '../assets/js/graph_plot.js', 'model.js', 'camera.js', 'presets.js']) vm.runInContext(source(name), sandbox);
    const plots = [], drawGraph = sandbox.canvas_graph.drawTimeGraph;
    sandbox.canvas_graph.drawTimeGraph = (canvas, series, options) => { plots.push({ series, options }); drawGraph(canvas, series, options); };
    const original = sandbox.sandbox_model.createWorld;
    sandbox.sandbox_model.createWorld = (...args) => (world = original(...args));
    vm.runInContext(source('main.js'), sandbox);
    return { elements, world, frame: (now) => frame(now), store, plots };
}

test('reset returns to the start after stepping, pausing and editing the simulated scene', () => {
    const { elements: e, world } = harness();
    const startX = world.bodies[1].x, startY = world.bodies[1].y;
    e.step.dispatch('click'); assert.ok(world.bodies[1].y < startY);
    e.scene.dispatch('keydown', { key: 'ArrowRight' });
    e.gravity.value = '0'; e.gravity.dispatch('change');
    e.add_body.dispatch('click'); assert.equal(world.bodies.length, 4);
    e.reset.dispatch('click');
    assert.equal(world.time, 0); assert.equal(world.bodies.length, 3);
    assert.equal(world.bodies[1].x, startX); assert.equal(world.bodies[1].y, startY);
    assert.equal(world.bodies[1].vx, 0); assert.equal(world.bodies[1].vy, 0);
    assert.equal(world.gravity, 9.81); assert.equal(Number(e.gravity.value), 9.81);
    assert.equal(world.bodies[1].trail.length, 0);
    e.step.dispatch('click'); e.clear.dispatch('click'); e.reset.dispatch('click');
    assert.equal(world.bodies.length, 3); assert.equal(world.bodies[1].x, startX);
});

test('reset preserves setup edits before play, and pause/resume does not replace the start', () => {
    const { elements: e, world, frame } = harness();
    e.scene.dispatch('keydown', { key: 'ArrowRight' }); const startX = world.bodies[1].x;
    e.play.dispatch('click'); frame(0); frame(50); e.play.dispatch('click');
    e.scene.dispatch('keydown', { key: 'ArrowRight' });
    e.play.dispatch('click'); frame(100); frame(150);
    e.reset.dispatch('click'); assert.equal(world.bodies[1].x, startX); assert.equal(world.bodies[1].vy, 0);
});

test('current scene can explicitly become the new start', () => {
    const { elements: e, world } = harness();
    e.step.dispatch('click'); e.scene.dispatch('keydown', { key: 'ArrowRight' });
    const x = world.bodies[1].x, y = world.bodies[1].y, vy = world.bodies[1].vy;
    e.set_start.dispatch('click'); assert.equal(world.time, 0);
    e.step.dispatch('click'); e.reset.dispatch('click');
    assert.equal(world.bodies[1].x, x); assert.equal(world.bodies[1].y, y); assert.equal(world.bodies[1].vy, vy);
});

test('named presets persist across reloads, load initial placements, overwrite, and delete', () => {
    const { elements: e, world, store } = harness();
    e.scene.dispatch('keydown', { key: 'ArrowRight' }); const startX = world.bodies[1].x;
    e.step.dispatch('click'); e.scene.dispatch('keydown', { key: 'ArrowRight' });
    e.preset_name.value = 'My pendulum'; e.save_preset.dispatch('submit');
    assert.equal(e.preset_list.value, 'My pendulum');
    const reloaded = harness(store), ui = reloaded.elements;
    assert.equal(ui.preset_list.value, 'My pendulum'); ui.load_preset.dispatch('click');
    assert.equal(reloaded.world.bodies[1].x, startX); assert.equal(reloaded.world.time, 0);
    assert.equal(reloaded.world.bodies[1].vy, 0);
    ui.objects.children[1].dispatch('click'); ui.scene.dispatch('keydown', { key: 'ArrowRight' });
    ui.save_preset.dispatch('submit');
    assert.equal(JSON.parse(store.get('simulator_sandbox_presets_v1')).presets.length, 1);
    ui.clear.dispatch('click'); ui.load_preset.dispatch('click'); assert.equal(reloaded.world.bodies.length, 3);
    ui.delete_preset.dispatch('click'); assert.equal(JSON.parse(store.get('simulator_sandbox_presets_v1')).presets.length, 0);
});

test('each object gets live position and velocity graphs, refreshed on reset and removal', () => {
    const { elements: e, world } = harness();
    assert.equal(e.object_graphs.children.length, 3);
    for (const card of e.object_graphs.children) assert.equal(card.children[1].children.length, 2);
    e.step.dispatch('click');
    const sample = world.bodies[1].history.at(-1);
    assert.equal(sample.time, world.time); assert.equal(sample.y, world.bodies[1].y);
    assert.ok(e.object_graphs.children[1].children[2].textContent.includes('0.02 s'));
    e.reset.dispatch('click');
    assert.equal(world.bodies[1].history.length, 1); assert.equal(world.bodies[1].history[0].time, 0);
    e.add_body.dispatch('click'); assert.equal(e.object_graphs.children.length, 4);
    e.remove.dispatch('click'); assert.equal(e.object_graphs.children.length, 3);
    e.clear.dispatch('click'); assert.equal(e.object_graphs.children.length, 0);
});

test('graph time windows roll forward and resize without resetting physics', () => {
    const { elements: e, world, plots } = harness();
    world.time = 25;
    for (const b of world.bodies) b.history = [0, 16, 20, 25].map((time) => ({ time, x: b.x, y: b.y, vx: b.vx, vy: b.vy }));
    e.graph_window.value = '5'; e.graph_window.dispatch('change');
    assert.equal(plots.at(-1).options.time_min, 20); assert.equal(plots.at(-1).options.time_max, 25);
    assert.ok(plots.at(-1).series[0].points.every(([time]) => time >= 20));
    e.graph_window.value = '20'; e.graph_window.dispatch('change');
    assert.equal(plots.at(-1).options.time_min, 5); assert.equal(plots.at(-1).series[0].points[0][0], 16);
    assert.equal(world.time, 25);
});
