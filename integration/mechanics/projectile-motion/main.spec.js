/*
 * main.spec.js — Integration tests of the projectile-motion page on every device
 * project (PC, tablet, phone), through the shared exercise suite.
 */
import { describeExercisePage } from "../../exercise_suite.js";

describeExercisePage({
    page_path: "src/mechanics/projectile-motion/index.html",
    parameter_key: "launch_angle_degrees",
    parameter_value: 30,
    formula_id: "u0",
});
