/**
 * Release entry point. The Illustrata release builder imports exactly two
 * names from here: `Calculator` and `CALCULATOR_CSS`. Keep both.
 */
export { default, default as Calculator, CALCULATOR_CSS } from "./Calculator";
export type { CalculatorProps } from "./Calculator";
export type { ProductModule, ProductScreenProps } from "./template/module";
