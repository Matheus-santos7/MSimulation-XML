/**
 * Regra de camadas: domain/ e application/ não dependem de framework HTTP.
 * O Nest monta os use cases por `useFactory` (`<feature>.module.ts`); o domínio fica puro.
 * Complementa a regra `core-no-nest-layer` do `.dependency-cruiser.js`, que não enxerga node_modules.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));
const MODULES_DIR = join(SRC_DIR, "modules");
const CORE_LAYERS = ["domain", "application"];
const FRAMEWORK_IMPORT = /from\s+["'](@nestjs\/[^"']+|fastify|@fastify\/[^"']+)["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);

    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Arquivos de domain/ e application/ de todas as features (nem toda feature tem as duas). */
function coreLayerFiles(): string[] {
  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((feature) => CORE_LAYERS.map((layer) => join(MODULES_DIR, feature.name, layer)))
    .filter((layerDir) => existsSync(layerDir))
    .flatMap((layerDir) => sourceFiles(layerDir));
}

describe("arquitetura — camadas de domínio sem framework", () => {
  it("domain/ e application/ não importam @nestjs nem fastify", () => {
    const files = coreLayerFiles();
    const offenders = files
      .filter((file) => FRAMEWORK_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC_DIR, file));

    assert.ok(files.length > 0, "nenhum arquivo de domain/application encontrado");
    assert.deepEqual(offenders, []);
  });
});
