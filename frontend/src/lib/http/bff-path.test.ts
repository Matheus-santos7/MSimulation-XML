import { describe, expect, it } from "vitest";
import { assertAllowedBffPath, toBffPath } from "./bff-path";

describe("toBffPath", () => {
  it("converte caminho da API fiscal para o BFF", () => {
    expect(toBffPath("/api/nfes/123/xml")).toBe("/api/bff/nfes/123/xml");
    expect(toBffPath("/api/nfes/123/xml?download=1")).toBe("/api/bff/nfes/123/xml?download=1");
    expect(toBffPath("/api/fiscal-settings/nfe-numeracao?serie=5&numeroInicial=1")).toBe(
      "/api/bff/fiscal-settings/nfe-numeracao?serie=5&numeroInicial=1",
    );
  });

  it("rejeita caminhos fora da allowlist", () => {
    expect(() => toBffPath("/api/users/1")).toThrow("Caminho de API não permitido.");
  });
});

describe("assertAllowedBffPath", () => {
  it("permite downloads de planilha", () => {
    expect(() => assertAllowedBffPath("products/spreadsheet/export")).not.toThrow();
    expect(() => assertAllowedBffPath("timeline/spreadsheet/export")).not.toThrow();
  });
});
