import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist", "node_modules", "generated", "**/*.test.ts", "*.test.ts", "**/*.spec.ts", "vitest.config.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Erros nomeados do módulo: `export namespace <Feature>Error { ... }` (.claude/rules/error-handling.md).
    files: ["src/**/errors/*.errors.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
];
