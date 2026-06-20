import { NfeValidationStatus, Prisma } from "../../../../generated/prisma/client.js";
import type { FiscalValidatorPort } from "../../domain/ports/fiscal-validator.port.js";

type ValidationConfig = { enabled: boolean };

/**
 * Resolves Prisma update fields for MCP validation audit on NF-e persist.
 * Never throws — invalid XML or unreachable validator still persist the document.
 */
export async function resolveNfeValidationUpdate(
  validator: FiscalValidatorPort,
  xml: string,
  config: ValidationConfig,
): Promise<Pick<Prisma.NFeUpdateInput, "statusValidacao" | "mensagemValidacao" | "errosValidacao">> {
  if (!config.enabled) {
    return {
      statusValidacao: NfeValidationStatus.PENDING,
      mensagemValidacao: "Validação desabilitada",
      errosValidacao: Prisma.DbNull,
    };
  }

  try {
    const result = await validator.validateNfe(xml);
    return {
      statusValidacao: result.isValid ? NfeValidationStatus.APPROVED : NfeValidationStatus.REJECTED,
      mensagemValidacao: result.message,
      errosValidacao: result.errors.length > 0 ? result.errors : Prisma.DbNull,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      statusValidacao: NfeValidationStatus.PENDING,
      mensagemValidacao: `Validador indisponível: ${detail}`,
      errosValidacao: Prisma.DbNull,
    };
  }
}
