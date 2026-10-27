import { defineConfig } from "vitest/config";

/** Suíte do backend: specs `*.spec.ts` em `test/` ao lado do que testam. */
export default defineConfig({
  // O tsconfig.json exclui os specs; os decorators legados do Nest vêm daqui.
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
        "src/generated/**",
      ],
    },
  },
});
