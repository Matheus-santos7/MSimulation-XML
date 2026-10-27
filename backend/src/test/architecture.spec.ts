/**
 * Regra de camadas: as regras puras das features (`rules/`) e os tipos (`types/`) não dependem
 * de framework HTTP. Complementa a regra `rules-no-nest-layer` do `.dependency-cruiser.js`, que
 * não enxerga node_modules.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "vitest";
import { fileURLToPath } from "node:url";

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));
const MODULES_DIR = join(SRC_DIR, "modules");
const PURE_FOLDERS = new Set(["rules", "types"]);
const FRAMEWORK_IMPORT = /from\s+["'](@nestjs\/[^"']+|fastify|@fastify\/[^"']+)["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);

    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Arquivos dentro de qualquer pasta `rules/` ou `types/` de `src/modules`. */
function pureFiles(dir: string = MODULES_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "test")
    .flatMap((entry) => {
      const path = join(dir, entry.name);

      return PURE_FOLDERS.has(entry.name) ? sourceFiles(path) : pureFiles(path);
    });
}

describe("arquitetura — regras e tipos sem framework", () => {
  it("rules/ e types/ não importam @nestjs nem fastify", () => {
    const files = pureFiles();
    const offenders = files
      .filter((file) => FRAMEWORK_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC_DIR, file));

    assert.ok(files.length > 0, "nenhum arquivo em rules/ ou types/ encontrado");
    assert.deepEqual(offenders, []);
  });
});
