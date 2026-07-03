# Physics Simulator

Interactive physics simulations for teaching, built as a static site with plain HTML, CSS, and JavaScript — no framework, no build step, no external dependency.

Developed as the practical part of a master's thesis on physics teaching, targeting **first-year civil-engineering students (Physics 1, BAC1)**. Each exercise renders a physical phenomenon on an animated canvas with a free-body diagram showing every applied force, full time control (play/pause, speed, scrubbing), editable parameters, and formulas displayed with their current numeric values substituted. UI is in French with an English toggle.

## Live Site

Deployed via GitHub Pages. Open `index.html` for the exercise list.

## Exercises

### Mechanics

| Exercise | Description | Concepts |
|---|---|---|
| [Projectile motion](src/mechanics/projectile-motion/index.html) (Tir parabolique) | A point mass launched from height h₀ with speed v₀ at angle θ (−90° to 90°), under uniform gravity (fixed mass m = 1 kg), air resistance neglected. Animated trajectory with free-body diagram, weight/velocity/acceleration vectors, camera zoom/pan, time scrubbing and playback speed; adjustable v₀, θ, h₀, g. Formulas shown in generic uniformly-accelerated form (y₀, v₀ₓ, v₀y, a = −g). Includes an experimental game mode: shoot a basketball into a hoop of random distance, height and rim size — formulas and predicted path hidden, parameter changes reset the shot, progress through milestone tiers (1–100 baskets) with a stats panel. | Kinematics, parabolic trajectory, flight time, range, maximum height, weight P = m·g |

## Getting Started

Open `index.html` directly in a browser — no server, no install. Pages use classic scripts (no ES modules), so everything works over `file://`.

```bash
# Optional: serve locally instead
npx serve .

# Run the test suite
node --test
```

**Requirements:** Node.js ≥ 20 (tests only; the site itself runs in any modern browser).

## Project Structure

```
src/
  assets/
    images/          # shared images
    graphs/          # shared graphs
    js/              # shared visual/rendering code (canvas helpers, vectors, grid)
  <theme>/
    <exercise>/
      index.html     # exercise page (layout + styles)
      main.js        # rendering, camera, controls, formula panel, FR/EN strings
      calcul.js      # pure physics — self-contained per exercise, never shared
      game.js        # optional, experimental game mode — isolated, trivially removable
test/
  <theme>/
    <exercise>/
      main.test.js   # unit tests for calcul.js
.github/workflows/
  ci.yml             # runs node --test on every push and pull request
```

Design rules:
- **Physics is never shared.** Each `calcul.js` is self-contained and auditable in isolation, even at the cost of duplication.
- **Visual code is shared.** Canvas drawing helpers live in `src/assets/js/` and are loaded by exercise pages.
- **Computations are explicit.** No physics-engine library; every formula is implemented and unit-tested.
- **Works from `file://`.** Browser JS uses classic `<script>` tags (no ES modules); each file exposes one namespaced global (e.g. `projectile_calcul`, `canvas_draw`), which Node tests read after a side-effect import.

## Testing

Unit tests use Node's built-in test runner (`node:test`, no dependency). Every exercise tests its `calcul.js` against analytically known values. CI runs the full suite on push and pull request.

## Vector Color Convention

Consistent across all exercises:

| Vector | Color |
|---|---|
| Weight / gravity (P, Fg) | Red |
| Normal force (N) | Green |
| Friction (f) | Orange |
| Applied force (F) | Blue |
| Tension (T) | Purple |
| Velocity (v) | Black, dashed |
| Acceleration (a) | Black, dotted |
| Net force (ΣF) | Thick black |

## License

Educational project — Arnaud Gheysens.
