import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["node_modules/**"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      curly: "error",
      eqeqeq: "error",
      "no-console": "warn",
      "prefer-const": "error",
    },
  },
]);
