# Physics Simulator

Interactive physics simulations for first-year civil-engineering students
(Physics 1, BAC1), built with plain HTML, CSS, and JavaScript.

## Available simulations

- [Physics sandbox](src/sandbox/index.html) — drag and configure bodies in a
  shared 2D world. Explore gravity, momentum transfer through collisions,
  fixed anchors, and rods connecting bodies (pendulums and chains).
  Includes playback, editable position/velocity/mass/radius/restitution,
  trails, and French/English controls.
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

Run the tests with Node.js 20 or newer:

```bash
npm test
```

## Project structure

```
index.html
styles.css
package.json
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
.github/workflows/ci.yml
```

Physics calculations remain self-contained within each simulation. Shared
visual helpers live in `src/assets/js/`. Classic scripts are used so the site
works both through a static server and directly over `file://`.

The sandbox uses a numerical world in `src/sandbox/model.js` so objects can
exchange momentum instead of following independent prescribed trajectories.
It uses small adaptive substeps, frictionless circle contacts, and an iterative
rigid-rod solver. Constraint integration is approximate; long-running motion
can lose energy. The original course simulations retain their analytical/RK4
models. `registerForce(world, (world, addForce) => { ... })` allows future force
providers to apply forces in newtons to bodies by ID (for example, springs or
electric interactions). Rod endpoints also reference body IDs, allowing moving
endpoints and linked chains. Springs and charges are not implemented yet.

Sandbox edits pause playback. Edits before the first Play or Step define the
starting setup. Reset restores that setup (positions, velocities, properties,
gravity, objects and connections), clears trails, and returns time to zero.
Pausing, resuming, or editing during a run does not replace the starting setup.
“Use current scene as start” explicitly adopts the current arrangement as a new
starting setup. Dragging a rod endpoint changes its rest length. Objects can also
be selected from the list and positioned through inputs or the canvas arrow keys.

Named scene presets are saved in browser localStorage and persist across page
reloads. “Save starting setup” stores the starting scene and current camera
view; saving with the same name replaces the existing preset. Load restores the
scene paused at time zero and establishes its reset setup. Presets can also be
deleted. To save placements reached during playback, adopt them with “Use current
scene as start” first. Presets are local to this browser and site origin. Storage
errors are shown in the UI, and versioned saved data is validated before loading.

The sandbox has no side walls or ceiling; its floor remains at y = 0 across
all horizontal positions. Position inputs allow negative x and arbitrary
heights above the floor. Drag the background (or Shift-drag over an object)
to pan, and use the wheel or zoom buttons to zoom. Shift + arrow keys pans
the camera. “Fit objects and floor” recovers objects that have left the view.
New objects are placed at the current view centre, above the floor. Camera
movement does not pause playback or change the reset setup.

Each object has collapsible live graphs for x/y position and vx/vy/speed versus
simulation time, plus numeric readings. Fixed anchors are included. Pause stops
graph updates; Step advances them with the physics. Reset, loading a preset,
and adopting a new starting setup clear the graph history. Histories are omitted
from presets and retain at most the last 60 seconds and 2,000 samples per body.
Choose a rolling window of 5, 10 (default), 20, or 60 seconds; axes show absolute
simulation times and scroll forward as the simulation runs. Changing the window
does not reset playback. Graphs redraw at most ten times per second during
playback using the shared graph renderer.

Each rod can use mutual interaction (the default), or a moving-anchor mode in
either direction. In moving-anchor mode only the follower receives the rod's
position and velocity corrections; the anchor still moves under gravity,
external forces, and its other connections. Direct collisions between that
rod's endpoints are disabled to avoid feedback; collisions with other bodies
remain active. This is a driven constraint and does not conserve the pair's
momentum or energy. Choose the mode before connecting objects, or change it
under “Connections for this object” after selecting either endpoint. Dashed
arrows show the direction from anchor to follower. Reset preserves the mode.

## License

Educational project — Arnaud Gheysens.
