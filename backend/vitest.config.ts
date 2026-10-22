import { defineConfig } from "vitest/config";

/**
 * Specs no padrão novo (`*.spec.ts`). Os testes `*.test.ts` continuam no `node:test`
 * até cada módulo ser convertido (ver `.claude/ARCHITECTURE.md`, seção 12).
 */
export default defineConfig({
  // O tsconfig.json exclui os specs; os decorators legados (Nest, class-validator) vêm daqui.
  oxc: { decorator: { legacy: true } },
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
    globals: false,
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.module.ts",
        "src/**/index.ts",
        "src/**/*.spec.ts",
        "src/**/*.test.ts",
        "src/generated/**",
      ],
    },
  },
});
