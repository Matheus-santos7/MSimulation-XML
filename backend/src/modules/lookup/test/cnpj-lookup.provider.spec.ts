import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CepLookupProvider } from "../providers/cep-lookup.provider.js";
import { CnpjLookupProvider } from "../providers/cnpj-lookup.provider.js";

const TAX_ID = "11222333000181";

describe("CnpjLookupProvider", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let provider: CnpjLookupProvider;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    provider = new CnpjLookupProvider({
      lookup: vi.fn().mockRejectedValue(new Error("sem CEP")),
    } as unknown as CepLookupProvider);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should fall back to OpenCNPJ when BrasilAPI times out (P-7)", async () => {
    // Arrange
    fetchMock
      .mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cnpj: TAX_ID, razao_social: "Empresa Teste" }), {
          status: 200,
        }),
      );

    // Act
    const result = await provider.lookup(TAX_ID);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("opencnpj");
    expect(result.razaoSocial).toBe("Empresa Teste");
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
