import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LookupError } from "../errors/lookup.errors.js";
import { LookupService } from "../lookup.service.js";
import type { CepLookupProvider } from "../providers/cep-lookup.provider.js";
import type { CnpjLookupProvider } from "../providers/cnpj-lookup.provider.js";

const VALID_CNPJ = "12345678000199";
const VALID_CEP = "01001000";

describe("LookupService", () => {
  let cnpjProvider: { lookup: ReturnType<typeof vi.fn> };
  let cepProvider: { lookup: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };
  let service: LookupService;

  beforeEach(() => {
    cnpjProvider = { lookup: vi.fn() };
    cepProvider = { lookup: vi.fn() };
    logger = { error: vi.fn() };
    service = new LookupService(
      cnpjProvider as unknown as CnpjLookupProvider,
      cepProvider as unknown as CepLookupProvider,
      logger as unknown as FastifyBaseLogger,
    );
  });

  it("should return what the providers return", async () => {
    // Arrange
    cnpjProvider.lookup.mockResolvedValue({ cnpj: VALID_CNPJ });
    cepProvider.lookup.mockResolvedValue({ cep: VALID_CEP });

    // Act
    const cnpj = await service.lookupCnpj(VALID_CNPJ);
    const cep = await service.lookupCep(VALID_CEP);

    // Assert
    expect(cnpj).toEqual({ cnpj: VALID_CNPJ });
    expect(cep).toEqual({ cep: VALID_CEP });
  });

  it("should reject a malformed parameter with a fixed message without calling the provider", () => {
    // Act / Assert
    expect(() => service.lookupCnpj("1")).toThrow(new LookupError.Invalid("CNPJ inválido"));
    expect(() => service.lookupCep("1")).toThrow(new LookupError.Invalid("CEP inválido"));
    expect(cnpjProvider.lookup).not.toHaveBeenCalled();
    expect(cepProvider.lookup).not.toHaveBeenCalled();
  });

  it("should keep 404 and 400 errors from the providers", async () => {
    // Arrange
    cnpjProvider.lookup.mockRejectedValue(new LookupError.NotFound("CNPJ não encontrado"));
    cepProvider.lookup.mockRejectedValue(new LookupError.Invalid("CEP deve ter 8 dígitos"));

    // Act / Assert
    await expect(service.lookupCnpj(VALID_CNPJ)).rejects.toMatchObject({
      message: "CNPJ não encontrado",
      status: 404,
    });
    await expect(service.lookupCep(VALID_CEP)).rejects.toMatchObject({
      message: "CEP deve ter 8 dígitos",
      status: 400,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should answer 502 with the original message and log when the external API fails", async () => {
    // Arrange
    const upstream = new Error("timeout na BrasilAPI");
    cnpjProvider.lookup.mockRejectedValue(upstream);

    // Act
    const result = service.lookupCnpj(VALID_CNPJ);

    // Assert
    await expect(result).rejects.toMatchObject({ message: "timeout na BrasilAPI", status: 502 });
    expect(logger.error).toHaveBeenCalledWith(upstream);
  });

  it("should use the fallback message when the failure is not an Error", async () => {
    // Arrange
    cepProvider.lookup.mockRejectedValue("boom");

    // Act / Assert
    await expect(service.lookupCep(VALID_CEP)).rejects.toMatchObject({
      message: "Falha ao consultar CEP",
      status: 502,
    });
  });
});
