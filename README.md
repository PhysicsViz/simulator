# Physics Simulator

Interactive physics simulations for first-year civil-engineering students
(Physics 1, BAC1), built with plain HTML, CSS, and JavaScript.

## Available simulations

- [Projectile motion](src/mechanics/projectile-motion/index.html) — parabolic
  trajectory, vectors, time graphs, and an experimental basketball game.
- [Pendulum](src/mechanics/pendulum/index.html) — nonlinear motion, energy,
  tension, time graphs, and an experimental challenge mode.
- [Uniform circular motion](src/mechanics/uniform-circular-motion/index.html) —
  angular velocity, period, centripetal acceleration and force (no game mode
  for now).
- [Loop-the-loop](src/mechanics/loop-the-loop/index.html) — ball released from
  rest at height h on a frictionless rail (60° arc ramp, run-in of length R),
  through a circular loop of radius R or a clothoid loop of the same height
  2R; the ball is not held and leaves the rail when N = 0, then falls freely
  (MRUA) until it touches the rail again. Energy conservation, normal reaction
  N = m (v²/r + g cos(φ)), minimum height (5R/2 for the circle, lower for the
  clothoid, whose critical point lies just before the top), load factor, RK4
  motion along the rail. Experimental "water bucket" game: the teacher swings a
  bucket in a vertical circle (R = arm + rope, pivot at the shoulder) and, after
  a back-and-forth wind-up, it passes the horizontal position with speed v₀;
  T = m (v₀²/R + 3 g cos(θ)) must stay between 0 and T_max. Each challenge
  draws the one free variable (v₀, R, or m — fill at least 90 % of the largest
  mass the rope holds), a place (Europa, Moon, Mars, Venus, Earth) and the
  other quantities; the last value used never wins the next challenge. Spilled water and a snapped bucket follow real
  free-fall trajectories (with an unlucky bounce onto the head).

Each simulation includes editable parameters, animated canvas rendering,
free-body diagrams, formula panels, playback controls, and French/English UI.

## Getting started

Open `index.html` directly, or run a local static server:

```bash
npx serve .
```

Then open the URL printed by `serve` (normally `http://localhost:3000`).

See [TESTING.md](TESTING.md) for what each test suite checks, how it works and how to write new tests.

Run the unit tests with Node.js 20 or newer:

```bash
npm test
```

Run the integration tests (Playwright, every page opened over `file://` on
PC, tablet and phone profiles, portrait and landscape, Chromium/WebKit/Firefox):

```bash
npm install
npx playwright install chromium webkit firefox
npm run test:integration
```

To watch the key tests run (visible PC, iPad and iPhone windows, slowed down,
recorded on video, HTML report at the end), or to pick tests interactively:

```bash
npm run test:integration:visual
npm run test:integration:ui
```

## Project structure

```
index.html
styles.css
package.json
playwright.config.js               # integration test device profiles
playwright.visual.config.js        # watchable run of the @important tests
src/
  assets/js/                         # shared drawing, camera, and graph helpers
  mechanics/
    projectile-motion/              # Tir parabolique
    pendulum/                        # Pendule
    uniform-circular-motion/         # MCU
    loop-the-loop/                   # Looping
      index.html                     # simulation page
      calcul.js                      # physics calculations
      main.js                        # UI, rendering, and controls
      game.js                        # experimental game mode
test/mechanics/
  projectile-motion/
  pendulum/
  uniform-circular-motion/
  loop-the-loop/                     # main and game tests per simulation
integration/
  exercise_suite.js                  # shared page checks for every device
  home.spec.js                       # root page
  mechanics/<exercise>/main.spec.js  # one spec per simulation
.github/workflows/ci.yml
```

Physics calculations remain self-contained within each simulation. Shared
visual helpers live in `src/assets/js/`. Classic scripts are used so the site
works both through a static server and directly over `file://`.

## License

Educational project — Arnaud Gheysens.
