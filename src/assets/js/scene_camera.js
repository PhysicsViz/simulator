/*
 * scene_camera.js — Shared pan/zoom camera for exercise scene canvases (visual
 * code only, no physics). Imported by: mechanics/projectile-motion, mechanics/pendulum.
 * Provides a world(meters)→screen(pixels) transform, fit-to-rectangle framing,
 * zoom buttons + wheel zoom toward the cursor, drag panning, and a "touched"
 * flag: manual camera actions freeze auto-follow until the next fit.
 * Classic script; exposes globalThis.scene_camera.
 */
(() => {
    const MIN_PIXELS_PER_METER = 2;
    const MAX_PIXELS_PER_METER = 400;
    const ZOOM_BUTTON_FACTOR = 1.25;
    const ZOOM_WHEEL_FACTOR = 1.15;
    const FIT_MARGIN_X = 150;
    const FIT_MARGIN_Y = 120;

    /* createCamera: camera state + interactions for one scene canvas */
    function createCamera(canvas) {
        const state = { pixels_per_meter: 30, center_x: 0, center_y: 0, touched: false };
        let pan_pointer = null;

        /* clampZoom: keep the zoom level within usable limits */
        function clampZoom(pixels_per_meter) {
            return Math.min(Math.max(pixels_per_meter, MIN_PIXELS_PER_METER), MAX_PIXELS_PER_METER);
        }

        /* transform: current world→screen mapping and visible world bounds */
        function transform() {
            const scale = state.pixels_per_meter;
            return {
                toScreenX: (x) => canvas.width / 2 + (x - state.center_x) * scale,
                toScreenY: (y) => canvas.height / 2 - (y - state.center_y) * scale,
                bounds: {
                    left: state.center_x - canvas.width / 2 / scale,
                    right: state.center_x + canvas.width / 2 / scale,
                    bottom: state.center_y - canvas.height / 2 / scale,
                    top: state.center_y + canvas.height / 2 / scale,
                },
            };
        }

        /* fitTo: frame a world rectangle with comfortable margins; re-enables auto-follow */
        function fitTo(rect) {
            const width = Math.max(rect.right - rect.left, 0.1);
            const height = Math.max(rect.top - rect.bottom, 0.1);
            state.pixels_per_meter = clampZoom(Math.min(
                (canvas.width - FIT_MARGIN_X) / width,
                (canvas.height - FIT_MARGIN_Y) / height,
            ));
            state.center_x = (rect.left + rect.right) / 2;
            state.center_y = (rect.bottom + rect.top) / 2;
            state.touched = false;
        }

        /* zoomAt: multiply the zoom, keeping the world point under (screen_x, screen_y) fixed */
        function zoomAt(screen_x, screen_y, factor) {
            state.touched = true;
            const world_x = state.center_x + (screen_x - canvas.width / 2) / state.pixels_per_meter;
            const world_y = state.center_y - (screen_y - canvas.height / 2) / state.pixels_per_meter;
            state.pixels_per_meter = clampZoom(state.pixels_per_meter * factor);
            state.center_x = world_x - (screen_x - canvas.width / 2) / state.pixels_per_meter;
            state.center_y = world_y + (screen_y - canvas.height / 2) / state.pixels_per_meter;
        }

        /* syncSize: match the internal resolution to the displayed size; true when it changed */
        function syncSize() {
            const width = Math.round(canvas.clientWidth);
            const height = Math.round(canvas.clientHeight);
            if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
                canvas.width = width;
                canvas.height = height;
                return true;
            }
            return false;
        }

        /* bind: attach zoom buttons, wheel zoom and drag panning; onFit refits the view */
        function bind({ zoom_in_id, zoom_out_id, zoom_fit_id, onFit }) {
            document.getElementById(zoom_in_id).addEventListener("click", () => {
                zoomAt(canvas.width / 2, canvas.height / 2, ZOOM_BUTTON_FACTOR);
            });
            document.getElementById(zoom_out_id).addEventListener("click", () => {
                zoomAt(canvas.width / 2, canvas.height / 2, 1 / ZOOM_BUTTON_FACTOR);
            });
            document.getElementById(zoom_fit_id).addEventListener("click", onFit);

            canvas.addEventListener("wheel", (event) => {
                event.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const pixel_x = (event.clientX - rect.left) * canvas.width / rect.width;
                const pixel_y = (event.clientY - rect.top) * canvas.height / rect.height;
                zoomAt(pixel_x, pixel_y, event.deltaY < 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR);
            }, { passive: false });

            canvas.addEventListener("pointerdown", (event) => {
                pan_pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
                canvas.setPointerCapture(event.pointerId);
            });
            canvas.addEventListener("pointermove", (event) => {
                if (pan_pointer === null || event.pointerId !== pan_pointer.id) {
                    return;
                }
                if (event.clientX !== pan_pointer.x || event.clientY !== pan_pointer.y) {
                    state.touched = true;
                }
                const pixel_ratio = canvas.width / canvas.getBoundingClientRect().width;
                state.center_x -= (event.clientX - pan_pointer.x) * pixel_ratio / state.pixels_per_meter;
                state.center_y += (event.clientY - pan_pointer.y) * pixel_ratio / state.pixels_per_meter;
                pan_pointer.x = event.clientX;
                pan_pointer.y = event.clientY;
            });
            for (const event_name of ["pointerup", "pointercancel"]) {
                canvas.addEventListener(event_name, () => {
                    pan_pointer = null;
                });
            }
        }

        return { transform, fitTo, zoomAt, syncSize, bind, isTouched: () => state.touched };
    }

    globalThis.scene_camera = { createCamera };
})();
