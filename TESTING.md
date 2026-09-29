# Testing guide

The project has two kinds of tests. They answer different questions and use
different tools.

| | Unit tests | Integration tests |
|---|---|---|
| Question | Are the physics and the game rules correct? | Does the real page work on a phone, a tablet and a PC? |
| Location | `test/<theme>/<exercise>/*.test.js` | `integration/…/*.spec.js` |
| Tool | Node's built-in runner (`node:test`), nothing to install | [Playwright](https://playwright.dev) drives real browsers |
| What runs | Only `calcul.js` and the pure part of `game.js`, without a browser | The full page (`index.html` + every script), opened over `file://` |
| Speed | < 1 s | ≈ 7 min for the whole device matrix |
| Command | `npm test` | `npm run test:integration` |

Both suites run on GitHub on every push and pull request
(`.github/workflows/ci.yml`, two jobs: `test` and `integration`).

---

## 1. Unit tests

### Run them

```bash
npm test                                             # everything (same as: node --test)
node --test test/mechanics/pendulum/                 # one exercise
node --test test/mechanics/pendulum/main.test.js     # one file
node --test --test-name-pattern="flightTime"         # only tests whose title matches
node --test --watch                                  # rerun on every file save
```

A passing run ends with `ℹ fail 0`. A failure prints the test title, the
expected and the received value, and the file and line.

### What they check

- `main.test.js`: every function of the exercise's `calcul.js`, checked against
  values computed by hand from the closed-form equations. The numbers are
  chosen to be simple (g = 10, angles of 30/45/60/90°) so the expected
  results are exact. Degenerate cases are covered too (zero speed, vertical
  launch, …).
- `game.test.js`: the pure game logic, meaning target generation, scoring and
  milestones. The Monte-Carlo tests generate thousands of random situations
  and check that each one can be solved.

### How they work

Each `calcul.js` is a classic browser script, not an ES module, because the
site must work over `file://`. The script therefore does not `export`
anything. Instead it stores its functions on one global object:

```js
// src/mechanics/projectile-motion/calcul.js (end of file)
globalThis.projectile_calcul = { degToRad, flightTime, maxHeight, /* … */ };
```

The test imports the file once, which runs it and creates the global. It then
reads the functions from that global:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/projectile-motion/calcul.js";   // runs the script

const { flightTime } = globalThis.projectile_calcul;           // grab its functions

test("a ball dropped from 20 m with g = 10 m/s² falls for 2 s", () => {
    assert.equal(flightTime(20, 0, 0, 10), 2);                  // flightTime(h0, v0, angle, g)
});
```

`game.js` works the same way (`globalThis.projectile_game`). Its drawing and
DOM code sits behind `if (typeof document === "undefined") return;`, so
under Node, where `document` does not exist, only the pure logic runs.

### Write your own

1. Open or create `test/<theme>/<exercise>/main.test.js`. Node finds every
   `*.test.js` file automatically.
2. Import the `calcul.js` file and destructure the global, as in the example
   above.
3. For each formula, choose inputs whose result you can compute by hand, then
   compare:
   - `assert.equal(a, b)` for exact values;
   - a tolerance for floating-point results. The existing files define
     `assertClose(actual, expected, message)` with `EPSILON = 1e-9`.
4. Put the physical meaning in the test title and the message, for example
   `"apex"` or `"vertical launch"`. The message is what you read when the test
   fails.
5. Run `node --test test/<theme>/<exercise>/`.

Good unit tests for a physics formula check:
- a textbook value;
- a limiting case (θ = 0°, θ = 90°, v₀ = 0);
- a symmetry or conservation law, for example the same range at 30° and 60°,
  or constant energy in the pendulum.

---

## 2. Integration tests

### Run them

First time on a machine only:

```bash
npm install                                          # installs @playwright/test
npx playwright install chromium webkit firefox       # downloads the browsers (~500 MB)
```

Then:

```bash
npm run test:integration                             # everything, every device, invisible (headless)
npm run test:integration:visual                      # WATCH the @important tests (see below)
npm run test:integration:ui                          # interactive runner: pick a test, step through it
npm run test:integration:report                      # reopen the last visual report

npx playwright test integration/mechanics/pendulum   # one exercise
npx playwright test --project=phone-iphone           # one device
npx playwright test --project="phone-*"              # every phone profile
npx playwright test -g "game mode"                   # tests whose title matches
npx playwright test --headed --project=tablet-ipad   # any run, with visible windows
```

Always write `--project=name`, with the `=` sign. The form `--project name path`
reads the path as a second project name.

### Watching tests run

- **`npm run test:integration:visual`** plays the tests tagged `@important`
  in visible browser windows: a PC, an iPad and an iPhone, one after the
  other. Each action is slowed down to 400 ms, so you can follow the taps, the
  sliders moving and the formulas updating. At the end, an HTML report opens
  with a video of each test and a step-by-step trace. The settings are in
  `playwright.visual.config.js`.
- **`npm run test:integration:ui`** opens Playwright's own window. On the
  left, you choose any test and any device and click ▶. After the run, you
  can click each action in the timeline to see a snapshot of the page at that
  moment, with the element that was acted on highlighted. This is the best
  tool for understanding why a test fails.

### What they check

A test runs on 9 device profiles, defined in `playwright.config.js`:

| Project | Emulates | Engine |
|---|---|---|
| `pc-chromium` | desktop 1440×900 | Chromium (Chrome, Edge) |
| `pc-firefox` | desktop 1280×800 | Firefox |
| `pc-small` | small laptop 1024×640 | Chromium |
| `tablet-ipad`, `tablet-ipad-landscape` | iPad, portrait / landscape | WebKit (Safari) |
| `tablet-android` | Galaxy Tab S4 | Chromium |
| `phone-iphone`, `phone-iphone-landscape` | iPhone 13, portrait / landscape | WebKit (Safari) |
| `phone-android` | Pixel 7 | Chromium |

"Emulates" means the browser takes that device's screen size, pixel density,
user agent and touch support. On tablets and phones, the tests *tap*; on PCs
they *click*.

On every exercise page and every device, the shared suite checks the
following (⭐ marks the `@important` tests):

- ⭐ the layout fits the screen width (no horizontal scroll) and every panel
  is visible;
- the scene canvas has the resolution of its displayed size and is not
  blank;
- ⭐ the slider and the number field stay synchronized, and the formulas
  update;
- ⭐ play makes time advance, pause freezes it, and reset goes back to t = 0;
- the timeline scrubber and the step buttons move through time;
- the zoom buttons redraw the scene, and "fit" restores the view;
- the FR → EN toggle translates the page and is remembered after a reload;
- on touch screens, every button, slider and link is at least 24×24 px
  (WCAG 2.2);
- ⭐ the game mode hides formulas and graphs, and shows the stats panel;
- on every test, the page raises no JavaScript error and every file loads
  (this catches broken relative paths).

The home page (`home.spec.js`) loads without errors, fits the screen, and ⭐
every exercise card opens its simulation.

### How the files fit together

```
playwright.config.js            the 9 device profiles + global options
playwright.visual.config.js     reuses it: visible windows, slowed down, @important only
integration/
  exercise_suite.js             the shared checks, as a function + helper functions
  home.spec.js                  root page
  mechanics/pendulum/main.spec.js   ← a few lines: calls the shared suite
```

An exercise spec contains no checks of its own. It gives the shared suite the
few facts that differ between pages:

```js
import { describeExercisePage } from "../../exercise_suite.js";

describeExercisePage({
    page_path: "src/mechanics/pendulum/index.html",
    parameter_key: "initial_angle_degrees",   // parameter the test changes (#slider_… / #number_…)
    parameter_value: 45,                      // value it is set to
    formula_id: "x",                          // formula that must react (#sub_x)
});
```

`describeExercisePage` then registers all the tests listed above for that
page. Playwright runs each of them once per device.

### Anatomy of a Playwright test

```js
import { test, expect } from "@playwright/test";
import { fileUrl } from "./exercise_suite.js";

test("a zero-speed launch from the ground has zero flight time", async ({ page }) => {
    await page.goto(fileUrl("src/mechanics/projectile-motion/index.html"));   // 1. open the page
    await page.locator("#number_initial_speed").fill("0");                    // 2. act like a student
    await expect(page.locator("#res_flight_time")).toHaveText("0,00 s");      // 3. check the result
});
```

- `page` is a fresh browser tab. Each test starts from a clean browser, with
  no memory of other tests, including `localStorage`.
- `fileUrl(path)` converts a path relative to the repository into a
  `file:///C:/…` URL, which is exactly how a student opens the site.
- `page.locator("#id")` points to an element, using CSS selectors.
  - Actions: `.click()`, `.tap()`, `.fill("value")`, `.press("Enter")`.
  - `press(locator, hasTouch)` from `exercise_suite.js` taps on touch devices
    and clicks elsewhere.
- `expect(locator).toHaveText(…)`, `.toBeVisible()`, `.toHaveValue(…)`,
  `.toHaveClass(…)` **retry for up to 5 s** until the condition holds. You
  never need to add pauses: the test waits for the page's animation loop
  automatically. Never use `page.waitForTimeout`.
- `page.evaluate(() => …)` runs code inside the page. It is useful for values
  that no locator gives, for example
  `document.documentElement.scrollWidth` or the canvas pixels.
- The expected text uses French formatting (`0,00 s`) because every test
  starts with the page in French (the `fr-BE` locale).

### Write your own

**A. A new exercise.** Copy an existing `integration/mechanics/<x>/main.spec.js`
into `integration/<theme>/<new-exercise>/main.spec.js` and change the four
values. The new page then gets every shared check on every device.

**B. A check specific to one exercise.** Add `test(...)` blocks below the
`describeExercisePage(...)` call in that exercise's spec, as in the anatomy
example. Typical ideas:
- after setting v₀ = 0 and h₀ = 0, the flight time shows 0;
- in the pendulum, after a full period T₀ the angle is back to θ₀;
- after entering game mode, the h₀ slider max equals the hoop height.

Tag the test with `{ tag: "@important" }` to include it in the visual run:

```js
test("my check", { tag: "@important" }, async ({ page, hasTouch }) => { … });
```

**C. A check for every page.** Add it inside `describeExercisePage` in
`exercise_suite.js`. Do not copy it into several specs.

**D. Let Playwright write it for you.** Run:

```bash
npx playwright codegen "file:///C:/Users/…/simulator/src/mechanics/pendulum/index.html"
```

A browser opens. Every click and every field you type into is written
as test code in a side window. Copy that code into a spec, then add
`expect(...)` lines for what should be true afterwards. You can emulate a phone
with `--device="iPhone 13"`.

Then run your test on one device first, then on all of them:

```bash
npx playwright test integration/mechanics/pendulum --project=pc-chromium --headed
npx playwright test integration/mechanics/pendulum
```

### When a test fails

The terminal shows the failing assertion, the expected and the received
values, and a folder in `test-results/`. That folder contains a screenshot
at the moment of failure and a `trace.zip`. Open the trace with
`npx playwright show-trace test-results/<folder>/trace.zip`, or rerun the
test in `npm run test:integration:ui`.

Then decide what kind of failure it is:
- **Fails only on `phone-*` or `tablet-*`**: usually a real layout problem
  (overflow, element too small). Fix the page's CSS.
- **Fails only on WebKit or Firefox**: a browser difference. Fix it in the
  page with a standard web API.
- **Wrong selector, or the page's text changed**: fix the test.
- **Timeout while closing the browser, and the test passes when rerun
  alone**: machine overload, most often Firefox on Windows. This is not a
  bug. CI retries once automatically.

**Green on your PC but red on GitHub?** GitHub runs the tests on Linux, where
the default font (DejaVu Sans) is wider than the Windows fonts, so a layout that
fits exactly on Windows can overflow by 1–2 px there. Reproduce the runner with
Docker (Git Bash):

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/work" -w /work -e CI=1 mcr.microsoft.com/playwright:v1.63.0-noble bash -c "apt-get update -qq && apt-get install -y -qq fonts-dejavu-core && npx playwright test --project=phone-iphone --workers=1"
```

Never loosen a check just to get green. A failure that appears only on
phones is exactly the kind of problem these tests are meant to catch.
