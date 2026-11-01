import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/index.ts",
  output: { file: "dist/immergas-hub-cards.js", format: "es", inlineDynamicImports: true },
  plugins: [resolve(), typescript(), terser({ format: { comments: false } })],
};
