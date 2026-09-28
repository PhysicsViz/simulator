/*
 * main.spec.js — Integration tests of the pendulum page on every device
 * project (PC, tablet, phone), through the shared exercise suite.
 */
import { describeExercisePage } from "../../exercise_suite.js";

describeExercisePage({
    page_path: "src/mechanics/pendulum/index.html",
    parameter_key: "initial_angle_degrees",
    parameter_value: 45,
    formula_id: "x",
});
