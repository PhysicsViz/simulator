/* Camera uses CSS pixels, independently of display resolution and physics. */
(() => {
    const create = () => ({ centerX: 8, centerY: 5, scale: 1 });
    function transform(camera, width, height) {
        const { scale, centerX, centerY } = camera;
        return {
            toScreen: (x, y) => [width / 2 + (x - centerX) * scale, height / 2 - (y - centerY) * scale],
            toWorld: (x, y) => ({ x: centerX + (x - width / 2) / scale, y: centerY - (y - height / 2) / scale }),
            left: centerX - width / (2 * scale), right: centerX + width / (2 * scale),
            bottom: centerY - height / (2 * scale), top: centerY + height / (2 * scale),
        };
    }
    function pan(camera, dx, dy) { camera.centerX -= dx / camera.scale; camera.centerY += dy / camera.scale; }
    function zoom(camera, width, height, x, y, factor) {
        const before = transform(camera, width, height).toWorld(x, y);
        camera.scale = Math.max(1e-9, Math.min(1000, camera.scale * factor));
        const after = transform(camera, width, height).toWorld(x, y);
        camera.centerX += before.x - after.x; camera.centerY += before.y - after.y;
    }
    function fit(camera, bodies, width, height) {
        const bounds = bodies.length ? {
            left: Math.min(...bodies.map((b) => b.x - b.radius)) - 1,
            right: Math.max(...bodies.map((b) => b.x + b.radius)) + 1,
            bottom: 0,
            top: Math.max(...bodies.map((b) => b.y + b.radius)) + 1,
        } : { left: 0, right: 16, bottom: 0, top: 10 };
        camera.centerX = (bounds.left + bounds.right) / 2;
        camera.centerY = (bounds.bottom + bounds.top) / 2;
        camera.scale = Math.max(1e-9, Math.min(1000, (width - 36) / (bounds.right - bounds.left), (height - 36) / (bounds.top - bounds.bottom)));
    }
    globalThis.sandbox_camera = { create, transform, pan, zoom, fit };
})();
