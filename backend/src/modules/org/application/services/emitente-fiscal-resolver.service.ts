import type { Tenant } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { EmitenteFiscalConfigError } from "../../domain/errors/emitente-fiscal-config.error.js";
import type { EmitenteEmissaoOverride } from "../../domain/value-objects/emitente-emissao-override.js";
import {
  mapEmitente,
  mapEmitenteFromFilial,
} from "../../infrastructure/fiscal/tenant-emitente.mapper.js";

export type EmitenteFiscalPapel = "principal" | "matriz";

function overrideFromFilial(
  filial: {
    cnpj: string;
    uf: string;
    razaoSocial: string;
    nomeFantasia: string;
    ie: string;
    crt: number;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    codigoMunicipio: string;
    municipio: string;
    cep: string;
    telefone: string | null;
  },
  serie: number,
): EmitenteEmissaoOverride {
  return {
    uf: filial.uf.toUpperCase(),
    cnpj: filial.cnpj.replace(/\D/g, ""),
    serie,
    emitSnapshot: mapEmitenteFromFilial(filial as Parameters<typeof mapEmitenteFromFilial>[0]),
  };
}

function resolveEmitenteId(tenant: Tenant, papel: EmitenteFiscalPapel): string | null {
  return papel === "principal" ? tenant.emitenteRemessaId : tenant.emitenteTransferenciaId;
}

/**
 * Resolve o emitente fiscal por papel dentro do tenant.
 *
 * - **principal**: remessas, vendas e demais NF-e operacionais (`emitenteRemessaId`).
 * - **matriz**: transferência interna para filial (`emitenteTransferenciaId`).
 *
 * `null` ou id da matriz → usa cadastro do tenant.
 */
export async function resolveEmitenteFiscal(
  db: DbClient,
  tenant: Tenant,
  papel: EmitenteFiscalPapel,
): Promise<EmitenteEmissaoOverride> {
  const emitenteId = resolveEmitenteId(tenant, papel);

  if (emitenteId) {
    const filialComPapel = await db.tenantFilial.findFirst({
      where: { id: emitenteId, tenantId: tenant.id },
    });
    if (!filialComPapel) {
      throw new EmitenteFiscalConfigError(
        "Emitente fiscal configurado não encontrado. Revise os papéis em Empresas.",
      );
    }
    const serie =
      papel === "principal"
        ? filialComPapel.serieRemessa
        : (filialComPapel.serieTransferencia ?? tenant.serieTransferencia);
    if (!serie || serie < 1) {
      throw new EmitenteFiscalConfigError(
        papel === "principal"
          ? `Filial "${filialComPapel.nomeFantasia}" sem série de remessa configurada.`
          : `Filial "${filialComPapel.nomeFantasia}" sem série de transferência (defina na filial ou em Configurações fiscais).`,
      );
    }
    return overrideFromFilial(filialComPapel, serie);
  }

  const serie = papel === "principal" ? tenant.serieRemessa : tenant.serieTransferencia;
  if (!serie || serie < 1) {
    throw new EmitenteFiscalConfigError(
      papel === "principal"
        ? "Defina a série de remessa em Configurações fiscais."
        : "Defina a série de transferência em Configurações fiscais.",
    );
  }

  return {
    uf: tenant.uf.toUpperCase(),
    cnpj: tenant.cnpj.replace(/\D/g, ""),
    serie,
    emitSnapshot: mapEmitente(tenant),
  };
}

/** Retorna o id do estabelecimento configurado para transferências (null = matriz). */
export function resolveTransferenciaEmitenteId(tenant: Tenant): string | null {
  return tenant.emitenteTransferenciaId;
}
