import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/", "**/dist/", "**/.verify/", "**/.superpowers/"],
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
);
