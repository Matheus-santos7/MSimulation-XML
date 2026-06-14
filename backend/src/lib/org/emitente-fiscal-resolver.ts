import type { Tenant } from "../../generated/prisma/client.js";
import type { DbClient } from "../db/prisma-tx.js";
import { mapEmitente } from "./tenant-mapper.js";
import { mapEmitenteFromFilial } from "./tenant-filial-mapper.js";
import type { EmitenteEmissaoOverride } from "../../modules/remessas/infrastructure/fiscal/emitente-emissao-override.js";

export type EmitenteFiscalPapel = "principal" | "matriz";

export class EmitenteFiscalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmitenteFiscalConfigError";
  }
}

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

/**
 * Resolve o emitente fiscal por papel dentro do tenant.
 *
 * - **principal**: remessas, vendas e demais NF-e operacionais.
 * - **matriz**: apenas transferência interna para filial.
 *
 * Prioridade: filial com flag do papel → cadastro do tenant com flag.
 */
export async function resolveEmitenteFiscal(
  db: DbClient,
  tenant: Tenant,
  papel: EmitenteFiscalPapel,
): Promise<EmitenteEmissaoOverride> {
  const filialComPapel = await db.tenantFilial.findFirst({
    where: {
      tenantId: tenant.id,
      ...(papel === "principal"
        ? { emitenteFiscalPrincipal: true }
        : { emitenteFiscalMatriz: true }),
    },
  });

  if (filialComPapel) {
    const serie =
      papel === "principal"
        ? filialComPapel.serieRemessa
        : (filialComPapel.serieTransferencia ?? tenant.serieTransferencia);
    if (!serie || serie < 1) {
      throw new EmitenteFiscalConfigError(
        papel === "principal"
          ? `Filial "${filialComPapel.nomeFantasia}" sem série de remessa configurada.`
          : `Filial matriz "${filialComPapel.nomeFantasia}" sem série de transferência (defina na filial ou em Configurações fiscais).`,
      );
    }
    return overrideFromFilial(filialComPapel, serie);
  }

  const tenantAtivo =
    papel === "principal" ? tenant.emitenteFiscalPrincipal : tenant.emitenteFiscalMatriz;

  if (!tenantAtivo) {
    const label = papel === "principal" ? "emitente fiscal principal" : "emitente fiscal matriz";
    throw new EmitenteFiscalConfigError(
      `Nenhum ${label} configurado. Marque o tenant em Empresas ou uma filial em Empresas → Filiais.`,
    );
  }

  const serie = papel === "principal" ? tenant.serieRemessa : tenant.serieTransferencia;
  if (!serie || serie < 1) {
    throw new EmitenteFiscalConfigError(
      papel === "principal"
        ? "Defina a série de remessa em Configurações fiscais."
        : "Defina a série de transferência em Configurações fiscais.",
    );
  }

  const emitSnapshot = mapEmitente(tenant);
  return {
    uf: tenant.uf.toUpperCase(),
    cnpj: tenant.cnpj.replace(/\D/g, ""),
    serie,
    emitSnapshot,
  };
}
