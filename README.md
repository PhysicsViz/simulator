# Physics Simulator

Interactive physics simulations for first-year civil-engineering students
(Physics 1, BAC1), built with plain HTML, CSS, and JavaScript.

## Available simulations

- [Projectile motion](src/mechanics/projectile-motion/index.html) — parabolic
  trajectory, vectors, time graphs, and an experimental basketball game.
- [Pendulum](src/mechanics/pendulum/index.html) — nonlinear motion, energy,
  tension, time graphs, and an experimental challenge mode.
- [Uniform circular motion](src/mechanics/uniform-circular-motion/index.html) —
  angular velocity, period, centripetal acceleration, force, and a vertical
  bucket challenge.

Each simulation includes editable parameters, animated canvas rendering,
free-body diagrams, formula panels, playback controls, and French/English UI.

## Getting started

Open `index.html` directly, or run a local static server:

```bash
npx serve .
```

Then open the URL printed by `serve` (normally `http://localhost:3000`).

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
      index.html                     # simulation page
      calcul.js                      # physics calculations
      main.js                        # UI, rendering, and controls
      game.js                        # experimental game mode
test/mechanics/
  projectile-motion/
  pendulum/
  uniform-circular-motion/           # main and game tests per simulation
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
