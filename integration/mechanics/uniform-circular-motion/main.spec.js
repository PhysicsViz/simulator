/*
 * main.spec.js — Integration tests of the uniform circular motion page on every device
 * project (PC, tablet, phone), through the shared exercise suite.
 */
import { describeExercisePage } from "../../exercise_suite.js";

describeExercisePage({
    page_path: "src/mechanics/uniform-circular-motion/index.html",
    parameter_key: "radius",
    parameter_value: 2,
    formula_id: "v",
});
