import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  extractCodigoUnidade,
  normalizeCepMeli,
  normalizeCnpjMeli,
  normalizeIeMeli,
  unidadeParaDestinoFiscal,
  type UnidadeDestinoFiscal,
} from "../../lib/logistics/meli-unidade.js";
import type { MeliUnidadeLogistica } from "../../generated/prisma/client.js";
import { lookupCep } from "../lookup/lookup-service.js";

export type UnidadeLogisticaImportRow = {
  unidade: string;
  cnpj: string | number;
  inscricaoEstadual?: string | number;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  cep: string | number;
};

export function mapUnidadeLogistica(
  row: {
    id: string;
    codigo: string;
    nome: string;
    destNomeFiscal: string;
    cnpj: string;
    ie: string | null;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    codigoMunicipio: string;
    codigoPais: number;
    nomePais: string;
    indIeDest: number;
    ativa: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  tenantId: string,
  opts?: { padrao?: boolean },
) {
  return {
    id: row.id,
    tenantId,
    codigo: row.codigo,
    nome: row.nome,
    destNomeFiscal: row.destNomeFiscal,
    cnpj: row.cnpj,
    ie: row.ie ?? undefined,
    endereco: {
      logradouro: row.logradouro,
      numero: row.numero,
      complemento: row.complemento ?? undefined,
      bairro: row.bairro,
      municipio: row.municipio,
      uf: row.uf,
      cep: row.cep,
      codigoMunicipio: row.codigoMunicipio,
    },
    destinatarioFiscal: unidadeParaDestinoFiscal(row),
    ativa: row.ativa,
    padrao: opts?.padrao ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class UnidadeLogisticaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnidadeLogisticaError";
  }
}

/** Unidade ativa do catálogo global (visível a todos os tenants). */
export async function getUnidadeAtivaDoTenant(
  prisma: PrismaClient,
  _tenantId: string,
  unidadeId: string,
): Promise<MeliUnidadeLogistica | null> {
  return prisma.meliUnidadeLogistica.findFirst({
    where: { id: unidadeId, ativa: true },
  });
}

function unidadeSearchFilter(q: string): Prisma.MeliUnidadeLogisticaWhereInput {
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

function unidadeCnpjFilter(cnpj: string): Prisma.MeliUnidadeLogisticaWhereInput | undefined {
  const digits = cnpj.replace(/\D/g, "");
  if (!digits) return undefined;
  return digits.length === 14 ? { cnpj: digits } : { cnpj: { contains: digits } };
}

export class UnidadeLogisticaService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, opts?: { ativa?: boolean; q?: string; cnpj?: string }) {
    const q = opts?.q?.trim();
    const cnpjFilter = opts?.cnpj?.trim() ? unidadeCnpjFilter(opts.cnpj) : undefined;

    const [unidades, links] = await Promise.all([
      this.prisma.meliUnidadeLogistica.findMany({
        where: {
          ...(opts?.ativa !== undefined ? { ativa: opts.ativa } : {}),
          ...(q ? unidadeSearchFilter(q) : {}),
          ...(cnpjFilter ?? {}),
        },
        orderBy: [{ uf: "asc" }, { codigo: "asc" }],
      }),
      this.prisma.tenantUnidadeLogistica.findMany({
        where: { tenantId },
        select: { unidadeId: true, padrao: true },
      }),
    ]);

    const padraoByUnidadeId = new Map(links.map((l) => [l.unidadeId, l.padrao]));
    return unidades.map((u) =>
      mapUnidadeLogistica(u, tenantId, { padrao: padraoByUnidadeId.get(u.id) ?? false }),
    );
  }

  async getById(tenantId: string, id: string) {
    const unidade = await this.prisma.meliUnidadeLogistica.findUnique({ where: { id } });
    if (!unidade) return null;
    const link = await this.prisma.tenantUnidadeLogistica.findFirst({
      where: { tenantId, unidadeId: id },
      select: { padrao: true },
    });
    return mapUnidadeLogistica(unidade, tenantId, { padrao: link?.padrao ?? false });
  }

  /**
   * Resolve CD de destino da remessa: unidade informada ou padrão do tenant.
   * A UF do destino alimenta `resolveTaxRule` e `resolveRemessaCfop`.
   * @see docs/remessa-fisica.md — Fase 2
   */
  async resolveDestinoRemessa(
    tenantId: string,
    unidadeDestinoId?: string,
  ): Promise<{ unidade: MeliUnidadeLogistica | null; destino: UnidadeDestinoFiscal }> {
    if (unidadeDestinoId) {
      const u = await getUnidadeAtivaDoTenant(this.prisma, tenantId, unidadeDestinoId);
      if (!u) throw new UnidadeLogisticaError("Unidade logística de destino não encontrada ou inativa");
      return { unidade: u, destino: unidadeParaDestinoFiscal(u) };
    }

    const padrao = await this.prisma.tenantUnidadeLogistica.findFirst({
      where: { tenantId, padrao: true, unidade: { ativa: true } },
      include: { unidade: true },
    });
    if (padrao?.unidade) {
      return {
        unidade: padrao.unidade,
        destino: unidadeParaDestinoFiscal(padrao.unidade),
      };
    }

    throw new UnidadeLogisticaError(
      "Nenhum CD padrão definido para esta empresa. Selecione uma unidade em Unidades ML.",
    );
  }

  async setPadrao(tenantId: string, unidadeId: string) {
    const unidade = await this.prisma.meliUnidadeLogistica.findFirst({
      where: { id: unidadeId, ativa: true },
    });
    if (!unidade) throw new UnidadeLogisticaError("Unidade não encontrada");

    await this.linkTenantUnidade(tenantId, unidadeId);

    const link = await this.prisma.tenantUnidadeLogistica.findFirstOrThrow({
      where: { tenantId, unidadeId },
      include: { unidade: true },
    });

    await this.prisma.$transaction([
      this.prisma.tenantUnidadeLogistica.updateMany({
        where: { tenantId, padrao: true },
        data: { padrao: false },
      }),
      this.prisma.tenantUnidadeLogistica.update({
        where: { id: link.id },
        data: { padrao: true },
      }),
    ]);

    return mapUnidadeLogistica(link.unidade, tenantId, { padrao: true });
  }

  private async linkTenantUnidade(tenantId: string, unidadeId: string) {
    await this.prisma.tenantUnidadeLogistica.upsert({
      where: { tenantId_unidadeId: { tenantId, unidadeId } },
      create: { tenantId, unidadeId },
      update: {},
    });
  }

  async bulkImport(tenantId: string, rows: UnidadeLogisticaImportRow[], enrichCep = true) {
    const seenCnpj = new Map<string, UnidadeLogisticaImportRow>();
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
            const cepData = await lookupCep(cep);
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

      const existing = await this.prisma.meliUnidadeLogistica.findUnique({
        where: { cnpj },
      });

      if (existing && existing.codigo !== codigo) {
        const conflict = await this.prisma.meliUnidadeLogistica.findUnique({
          where: { codigo },
        });
        if (conflict && conflict.id !== existing.id) {
          codigo = `${codigo}_${cnpj.slice(-4)}`;
        }
      }

      const data: Prisma.MeliUnidadeLogisticaCreateInput = {
        codigo,
        nome,
        cnpj,
        ie: normalizeIeMeli(raw.inscricaoEstadual),
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

      let unidadeId: string;
      if (existing) {
        await this.prisma.meliUnidadeLogistica.update({
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
            ativa: true,
          },
        });
        unidadeId = existing.id;
        updated++;
      } else {
        const conflictCodigo = await this.prisma.meliUnidadeLogistica.findUnique({
          where: { codigo },
        });
        if (conflictCodigo) {
          codigo = `${codigo}_${cnpj.slice(-4)}`;
          data.codigo = codigo;
        }
        const createdRow = await this.prisma.meliUnidadeLogistica.create({ data });
        unidadeId = createdRow.id;
        created++;
      }

      await this.linkTenantUnidade(tenantId, unidadeId);
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
}
