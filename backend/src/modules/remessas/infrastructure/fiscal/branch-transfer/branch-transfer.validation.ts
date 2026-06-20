import type { Tenant, TenantFilial } from "../../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../../lib/db/prisma-tx.js";
import { resolveTaxRule } from "../../../../tax/index.js";
import { createLogisticsModule } from "../../../../logistics/index.js";
import { productUnitPrice } from "@msimulation-xml/fiscal-core";
import { resolveTransferenciaEmitenteId, type EmitenteEmissaoOverride } from "../../../../org/index.js";
import { filialParaDestinoFiscal } from "../helpers/transferencia-filial-dest.js";
import { BranchTransferError } from "./branch-transfer.errors.js";
import type { BranchTransferLineInput } from "./branch-transfer.types.js";

/**
 * Load branch (filial) entity and validate it exists.
 */
export async function loadBranch(
  db: DbClient,
  tenantId: string,
  filialId: string,
): Promise<TenantFilial> {
  const filial = await db.tenantFilial.findFirst({
    where: { id: filialId, tenantId },
  });
  if (!filial) {
    throw new BranchTransferError("Filial não encontrada. Cadastre a filial em Empresas → Filiais.");
  }
  return filial;
}

/**
 * Resolve the default warehouse (CD) for the given branch.
 * Falls back to tenant-level default destination if branch has no explicit default.
 */
export async function resolveDefaultWarehouseForBranch(
  db: DbClient,
  tenantId: string,
  filial: TenantFilial,
): Promise<string> {
  if (filial.unidadeLogisticaPadraoId) {
    const link = await db.tenantUnidadeLogistica.findFirst({
      where: {
        tenantId,
        unidadeId: filial.unidadeLogisticaPadraoId,
        unidade: { ativa: true },
      },
    });
    if (!link) {
      throw new BranchTransferError(
        "CD padrão da filial não está vinculado à matriz. Revise o cadastro da filial ou defina o CD padrão em Unidades ML.",
      );
    }
    return filial.unidadeLogisticaPadraoId;
  }

  const logistics = createLogisticsModule();
  const destino = await logistics.resolveShipmentDestination.execute(tenantId);
  return destino.unitId;
}

/**
 * Validate product has a tax rule for the given origin → destination UF.
 */
export async function validateProductTaxRule(
  db: DbClient,
  tenantId: string,
  product: { sku: string; taxRuleBaseId?: string | null },
  originUf: string,
  destinationUf: string,
  contexto: string,
): Promise<NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>>> {
  const ruleBaseId = product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new BranchTransferError(
      `Produto "${product.sku}" sem regra fiscal. Edite o cadastro e selecione a regra da planilha.`,
    );
  }

  const rule = await resolveTaxRule(db, tenantId, {
    originUf,
    destinationUf,
    transactionType: "inbound",
    customerType: "taxpayer",
    ruleBaseId,
  });
  if (!rule) {
    throw new BranchTransferError(
      `Regra "${ruleBaseId}" sem linha inbound (${contexto}) para ${originUf} → ${destinationUf} no produto "${product.sku}". Importe ou revise a planilha.`,
    );
  }
  return rule;
}

/**
 * Validate that the branch destination is not the same as the transfer emitter (matrix).
 */
export async function validateMatrixDistinctFromBranch(
  tenant: Tenant,
  filialDestino: TenantFilial,
  matrizEmitente: EmitenteEmissaoOverride,
): Promise<void> {
  const transferenciaEmitenteId = resolveTransferenciaEmitenteId(tenant);
  if (transferenciaEmitenteId && transferenciaEmitenteId === filialDestino.id) {
    throw new BranchTransferError(
      `A filial "${filialDestino.nomeFantasia}" é o emitente de transferências e não pode ser destino. Selecione a filial operacional que receberá o estoque.`,
    );
  }

  const matrizCnpj = matrizEmitente.cnpj.replace(/\D/g, "");
  const destCnpj = filialDestino.cnpj.replace(/\D/g, "");
  if (matrizCnpj === destCnpj) {
    throw new BranchTransferError(
      `O emitente de transferência (CNPJ ${matrizCnpj}) coincide com a filial destino "${filialDestino.nomeFantasia}". Selecione outra filial ou revise os papéis em Empresas.`,
    );
  }
}

/**
 * Validate all branch transfer prerequisites:
 * - Branch has shipment series configured
 * - All products have cost price > 0
 * - Tax rules exist for matrix → branch and branch → CD
 */
export async function validateBranchTransferPrerequisites(
  db: DbClient,
  tenant: Tenant,
  filial: TenantFilial,
  linhas: BranchTransferLineInput[],
  unidadeDestinoId: string,
  cdUf: string,
  matrizUf: string,
): Promise<void> {
  if (!filial.serieRemessa || filial.serieRemessa < 1) {
    throw new BranchTransferError(
      `Filial "${filial.nomeFantasia}" sem série de remessa configurada. Edite o cadastro da filial.`,
    );
  }

  const destinoFilial = filialParaDestinoFiscal(filial);

  for (const linha of linhas) {
    const unitCusto = productUnitPrice(linha.product, "REMESSA");
    if (unitCusto <= 0) {
      throw new BranchTransferError(
        `Preço de custo não informado ou zero para "${linha.product.sku}". Informe o custo no cadastro do produto.`,
      );
    }
    await validateProductTaxRule(
      db,
      tenant.id,
      linha.product,
      matrizUf,
      destinoFilial.uf,
      "transferência matriz → filial",
    );
    await validateProductTaxRule(
      db,
      tenant.id,
      linha.product,
      filial.uf,
      cdUf,
      "remessa filial → CD",
    );
  }
}
