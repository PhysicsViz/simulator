# Physics Sandbox

A professional, extensible JavaScript physics sandbox for introductory physics education. This first version focuses on units, vectors and kinematics: position, velocity, acceleration, displacement, MRU, MRUA, projectile motion and force-vector visualization for point-mass objects.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Then open the Vite URL shown in the terminal.

## Project Goal

This project supports a master thesis about AI-assisted development of interactive JavaScript animations for introductory physics education. The app is designed to look and behave like a small educational simulation tool rather than a raw canvas prototype.

All physical quantities use SI units internally:

- position: meters
- velocity: meters per second
- acceleration: meters per second squared
- mass: kilograms
- force: newtons

Every simulated object is a physical point mass. Its rendered radius and color are visual metadata only and do not affect the physics.

## Architecture

The code is organized around explicit boundaries:

- `src/core/math`: vector math primitives.
- `src/core/physics`: point bodies, forces, integrators and the physics world.
- `src/rendering`: canvas renderer, camera and drawer classes.
- `src/animation`: requestAnimationFrame loop and time stepping.
- `src/ui`: sidebar controllers and live value panel.
- `src/input`: mouse selection, dragging, panning and zooming.
- `src/scenes`: reusable scene factory functions.

Physics code does not import rendering code. Rendering reads the world but does not mutate it. UI and input controllers are the only layers that intentionally modify bodies or world settings.

## Why Separate Physics and Rendering?

The physics model should remain testable, reusable and independent from the way it is displayed. A point mass can be rendered as a glowing circle, a sprite or a 3D object later without changing the equations of motion. This separation also makes it easier to add new renderers, graph panels or export tools while preserving the same core simulation.

## Current Features

- Vite + vanilla JavaScript ES modules.
- HTML Canvas renderer with dark theme, subtle grid and axes.
- Point-mass bodies with position, velocity, acceleration, mass and trajectory.
- Constant-acceleration integrator for MRUA/projectile motion.
- Euler integrator included for comparison and future teaching modes.
- Constant force and gravity force classes.
- Optional `a = ΣF / m` force-based acceleration mode.
- Position, velocity, acceleration and force vector arrows with labels.
- Initial projectile example loaded on startup.
- MRU, free fall and projectile scene presets.
- Play, pause, reset, clear and step once controls.
- Object creation, selection and inspector editing.
- Paused body dragging in physical meters.
- Camera pan and zoom.
- Live selected-object values for `t`, `x(t)`, `y(t)`, `vx(t)`, `vy(t)`, `ax(t)`, `ay(t)`, `|v|` and `|a|`.

## Future Extensions

- Real-time plotted graphs.
- Collisions.
- Friction and drag.
- Circular motion.
- Electric forces.
- Circuits.
- Export/import scenes.
- Additional teaching presets and guided activities.
