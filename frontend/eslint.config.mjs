import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Official Next.js 16 flat config (ESLint CLI — `next lint` removed).
// Source: https://nextjs.org/docs/app/api-reference/config/eslint
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Stricter react-hooks rules from eslint-config-next 16 surface many
    // pre-existing app + shadcn patterns. Keep as warnings until cleaned up.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
