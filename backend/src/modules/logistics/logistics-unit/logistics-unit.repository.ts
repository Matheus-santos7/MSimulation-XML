import { Inject, Injectable } from "@nestjs/common";
import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { Prisma } from "../../../generated/prisma/client.js";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { CepLookupProvider } from "../../lookup/index.js";
import { LogisticsUnitError } from "../errors/logistics.errors.js";
import {
  extractCodigoUnidade,
  normalizeCepMeli,
  normalizeCnpjMeli,
  normalizeIdCadIntTran,
  normalizeIeMeli,
} from "./adapters/mercado-livre/ml-unidade.normalize.js";
import { mapLogisticsUnitFromPrisma } from "./logistics-unit.mapper.js";
import { unidadeParaDestinoFiscal } from "./rules/destino-fiscal.js";
import type { LogisticsUnitImportRow } from "./types/logistics-unit-import-row.types.js";
import type {
  BulkImportLogisticsUnitsResult,
  ListLogisticsUnitsFilter,
  ShipmentDestinationResolution,
} from "./types/logistics-unit-query.types.js";

function unitSearchFilter(q: string): Prisma.UnidadeLogisticaWhereInput {
  const cnpjDigits = q.replace(/\D/g, "");
  return {
    OR: [
      { codigo: { contains: q, mode: "insensitive" } },
      { nome: { contains: q, mode: "insensitive" } },
      { municipio: { contains: q, mode: "insensitive" } },
      { uf: { equals: q.toUpperCase(), mode: "insensitive" } },
      ...(cnpjDigits.length >= 4 ? [{ cnpj: { contains: cnpjDigits } }] : []),
    ],
  };
}

function unitCnpjFilter(cnpj: string): Prisma.UnidadeLogisticaWhereInput | undefined {
  const digits = cnpj.replace(/\D/g, "");
  if (!digits) return undefined;
  return digits.length === 14 ? { cnpj: digits } : { cnpj: { contains: digits } };
}

/**
 * Unidades logísticas (CDs). O catálogo `unidades_logisticas` é global, com código e CNPJ únicos
 * por marketplace; o vínculo com a empresa e o CD padrão ficam em `tenant_unidades_logisticas`.
 */
@Injectable()
export class LogisticsUnitRepository {
  private get db() {
    return getDbClient();
  }

  constructor(@Inject(CepLookupProvider) private readonly cepLookup: CepLookupProvider) {}

  async listByTenant(tenantId: string, filter?: ListLogisticsUnitsFilter) {
    const q = filter?.q?.trim();
    const cnpjFilter = filter?.cnpj?.trim() ? unitCnpjFilter(filter.cnpj) : undefined;

    const [units, links] = await Promise.all([
      this.db.unidadeLogistica.findMany({
        where: {
          ...(filter?.ativa !== undefined ? { ativa: filter.ativa } : {}),
          ...(filter?.marketplace ? { marketplace: filter.marketplace } : {}),
          ...(q ? unitSearchFilter(q) : {}),
          ...(cnpjFilter ?? {}),
        },
        orderBy: [{ uf: "asc" }, { codigo: "asc" }],
      }),
      this.db.tenantUnidadeLogistica.findMany({
        where: { tenantId },
        select: { unidadeId: true, padrao: true },
      }),
    ]);

    const defaultByUnitId = new Map(links.map((l) => [l.unidadeId, l.padrao]));
    return units.map((u) =>
      mapLogisticsUnitFromPrisma(u, tenantId, { padrao: defaultByUnitId.get(u.id) ?? false }),
    );
  }

  async findByIdForTenant(tenantId: string, id: string) {
    const unit = await this.db.unidadeLogistica.findUnique({ where: { id } });
    if (!unit) return null;
    const link = await this.db.tenantUnidadeLogistica.findFirst({
      where: { tenantId, unidadeId: id },
      select: { padrao: true },
    });
    return mapLogisticsUnitFromPrisma(unit, tenantId, { padrao: link?.padrao ?? false });
  }

  async findActiveById(unitId: string) {
    const row = await this.db.unidadeLogistica.findFirst({
      where: { id: unitId, ativa: true },
      select: { id: true, codigo: true, uf: true, nome: true, ativa: true },
    });
    return row;
  }

  async findActiveByCode(code: string) {
    const norm = code.trim().toUpperCase();
    if (!norm) return null;
    return this.db.unidadeLogistica.findFirst({
      where: { codigo: norm, ativa: true },
      select: { id: true, codigo: true, uf: true, nome: true, ativa: true },
    });
  }

  async resolveShipmentDestination(
    tenantId: string,
    destinationUnitId?: string,
  ): Promise<ShipmentDestinationResolution> {
    if (destinationUnitId) {
      const unit = await this.findActiveById(destinationUnitId);
      if (!unit) {
        throw new LogisticsUnitError("Unidade logística de destino não encontrada ou inativa");
      }
      const full = await this.db.unidadeLogistica.findUniqueOrThrow({
        where: { id: unit.id },
      });
      return {
        unitId: full.id,
        codigo: full.codigo,
        uf: full.uf,
        nome: full.nome,
        idCadIntTran: full.idCadIntTran ?? undefined,
        destinatarioFiscal: unidadeParaDestinoFiscal(full),
      };
    }

    const defaultLink = await this.db.tenantUnidadeLogistica.findFirst({
      where: { tenantId, padrao: true, unidade: { ativa: true } },
      include: { unidade: true },
    });
    if (defaultLink?.unidade) {
      const u = defaultLink.unidade;
      return {
        unitId: u.id,
        codigo: u.codigo,
        uf: u.uf,
        nome: u.nome,
        idCadIntTran: u.idCadIntTran ?? undefined,
        destinatarioFiscal: unidadeParaDestinoFiscal(u),
      };
    }

    throw new LogisticsUnitError(
      "Nenhum CD padrão definido para esta empresa. Cadastre unidades em Unidades ML, vincule à empresa e defina uma como padrão — ou selecione o CD de destino ao emitir a remessa.",
    );
  }

  async setDefaultUnit(tenantId: string, unitId: string) {
    const unit = await this.db.unidadeLogistica.findFirst({
      where: { id: unitId, ativa: true },
    });
    if (!unit) throw new LogisticsUnitError("Unidade não encontrada");

    await this.linkTenantUnit(tenantId, unitId);

    const link = await this.db.tenantUnidadeLogistica.findFirstOrThrow({
      where: { tenantId, unidadeId: unitId },
      include: { unidade: true },
    });

    await runInTransaction(this.db, async (tx) => {
      await tx.tenantUnidadeLogistica.updateMany({
        where: { tenantId, padrao: true },
        data: { padrao: false },
      });
      await tx.tenantUnidadeLogistica.update({
        where: { id: link.id },
        data: { padrao: true },
      });
    });

    return mapLogisticsUnitFromPrisma(link.unidade, tenantId, { padrao: true });
  }

  /** Importa CDs de um marketplace (linhas já normalizadas pelo adapter do formato da planilha). */
  async bulkImport(
    tenantId: string,
    marketplace: MarketplaceCode,
    rows: LogisticsUnitImportRow[],
    enrichCep: boolean,
  ): Promise<BulkImportLogisticsUnitsResult> {
    const seenCnpj = new Map<string, LogisticsUnitImportRow>();
    const errors: { line: number; message: string }[] = [];
    let line = 0;

    for (const raw of rows) {
      line++;
      const cnpj = normalizeCnpjMeli(raw.cnpj);
      if (!cnpj) {
        errors.push({ line, message: `CNPJ inválido: ${raw.cnpj}` });
        continue;
      }
      if (!raw.unidade?.trim()) {
        errors.push({ line, message: "Nome da unidade obrigatório" });
        continue;
      }
      if (!seenCnpj.has(cnpj)) {
        seenCnpj.set(cnpj, raw);
      }
    }

    let created = 0;
    let updated = 0;
    const cepCache = new Map<string, { bairro: string; codigoMunicipio: string }>();

    for (const raw of seenCnpj.values()) {
      const cnpj = normalizeCnpjMeli(raw.cnpj)!;
      const nome = raw.unidade.trim();
      let codigo = extractCodigoUnidade(nome);
      const cep = normalizeCepMeli(raw.cep);
      let bairro = "";
      let codigoMunicipio = "";

      if (enrichCep && cep.length === 8) {
        if (!cepCache.has(cep)) {
          try {
            const cepData = await this.cepLookup.lookup(cep);
            cepCache.set(cep, {
              bairro: cepData.bairro ?? "",
              codigoMunicipio: cepData.codigoMunicipio ?? "",
            });
          } catch {
            cepCache.set(cep, { bairro: "", codigoMunicipio: "" });
          }
        }
        const cached = cepCache.get(cep)!;
        bairro = cached.bairro;
        codigoMunicipio = cached.codigoMunicipio;
      }

      const existing = await this.db.unidadeLogistica.findUnique({
        where: { marketplace_cnpj: { marketplace, cnpj } },
      });

      if (existing && existing.codigo !== codigo) {
        const conflict = await this.db.unidadeLogistica.findUnique({
          where: { marketplace_codigo: { marketplace, codigo } },
        });
        if (conflict && conflict.id !== existing.id) {
          codigo = `${codigo}_${cnpj.slice(-4)}`;
        }
      }

      const idCadIntTran =
        raw.idCadIntTran !== undefined ? normalizeIdCadIntTran(raw.idCadIntTran) : undefined;

      const data: Prisma.UnidadeLogisticaCreateInput = {
        marketplace,
        codigo,
        nome,
        cnpj,
        ie: normalizeIeMeli(raw.inscricaoEstadual),
        ...(idCadIntTran !== undefined ? { idCadIntTran } : {}),
        logradouro: raw.logradouro?.trim() || "—",
        numero: raw.numero?.trim() || "SN",
        municipio: raw.cidade?.trim() || "",
        uf: (raw.uf ?? "").trim().toUpperCase().slice(0, 2),
        cep,
        bairro,
        codigoMunicipio,
        indIeDest: normalizeIeMeli(raw.inscricaoEstadual) ? 1 : 9,
        ativa: true,
      };

      let unitId: string;
      if (existing) {
        await this.db.unidadeLogistica.update({
          where: { id: existing.id },
          data: {
            codigo: data.codigo,
            nome: data.nome,
            ie: data.ie,
            logradouro: data.logradouro,
            numero: data.numero,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            bairro: bairro || existing.bairro,
            codigoMunicipio: codigoMunicipio || existing.codigoMunicipio,
            indIeDest: data.indIeDest,
            ...(idCadIntTran !== undefined ? { idCadIntTran } : {}),
            ativa: true,
          },
        });
        unitId = existing.id;
        updated++;
      } else {
        const conflictCodigo = await this.db.unidadeLogistica.findUnique({
          where: { marketplace_codigo: { marketplace, codigo } },
        });
        if (conflictCodigo) {
          codigo = `${codigo}_${cnpj.slice(-4)}`;
          data.codigo = codigo;
        }
        const createdRow = await this.db.unidadeLogistica.create({ data });
        unitId = createdRow.id;
        created++;
      }

      await this.linkTenantUnit(tenantId, unitId);
    }

    return {
      totalPlanilha: rows.length,
      unicos: seenCnpj.size,
      created,
      updated,
      skipped: rows.length - seenCnpj.size,
      errors,
    };
  }

  private async linkTenantUnit(tenantId: string, unitId: string) {
    await this.db.tenantUnidadeLogistica.upsert({
      where: { tenantId_unidadeId: { tenantId, unidadeId: unitId } },
      create: { tenantId, unidadeId: unitId },
      update: {},
    });
  }
}
