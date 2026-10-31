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
- [Loop-the-loop (wagon)](src/mechanics/loop-wagon/index.html) — compact,
  one-screen version of the classic circular loop: a roller-coaster wagon
  (point mass, default m = 200 kg) released from rest at height h ≤ 3R on a
  frictionless rail (60° ramp from 3R, fillet of radius R, run-in R, circular
  loop of radius R, default R = 2 m, h = 5,5 m); not held on the rail, it
  leaves it when N = 0 (cos(θ_d) = 2 (R − h)/(3 R)) and falls freely (MRUA)
  back onto the loop. Fixed view (no zoom or pan, the rail scales with R); the
  free space of the canvas holds the free-body diagram, the energy bars
  (E_c, E_p, E_m), a live readout and the legend. Energy, N = m (v²/r + g cos(φ)),
  h_min = 5R/2, speed and reaction at the top, load factor, RK4 motion along
  the rail, one tabbed time graph. One-screen layout from 700 × 540 px
  (header, scene, parameters and graph fill the first view, text never below
  16 px; the formulas start just below the fold), normal scrolling on phones.
  Experimental game: a bucket with water drops (10 by default, a temporary
  input sets more for testing) on a flexible rope at the tip of a 0.9 m bar.
  Everything starts at rest; the only actuator is a motor at the pivot: it
  swings the bar at the pendulum's rhythm, then speeds it up so that the rope,
  pulled by the bar's tip, brings the bucket to the energy ½ v₀², lines the bar
  up with the rope and lets it turn freely — the bucket then passes the bottom
  at v₀. It must go round twice without losing a drop (v₀² ≥ 5 g R) or snapping
  the rope (m (v₀²/R + g) ≤ T_max). Rope = chain of one-sided constraints, water
  = particles, extended position-based dynamics with a direct tridiagonal
  solve; each challenge draws the free variable (v₀, L or m), a place (Moon,
  Mars, Venus, Earth) and is checked solvable by replaying the simulation.

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
    loop-wagon/                      # Looping (wagon), compact one-screen version
test/mechanics/
  projectile-motion/
  pendulum/
  uniform-circular-motion/
  loop-the-loop/                     # main and game tests per simulation
  loop-wagon/
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
