import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import { requireAdminHook } from "../plugins/contexts/guards.js";
import { validateSpreadsheetBuffer } from "../lib/spreadsheet-upload.js";
import { parseMeliUnidadesXlsx } from "../lib/meli-unidade-planilha.js";
import {
  UnidadeLogisticaError,
  UnidadeLogisticaService,
  type UnidadeLogisticaImportRow,
} from "../services/unidade-logistica-service.js";
import { emitirAvancoEntreCds, AvancoCdError } from "../services/avanco-cd-service.js";
import { emitirRemessaManual, RemessaError } from "../services/remessa-service.js";
import { listarMovimentacoesProduto } from "../services/movimentacao-produto-service.js";

const importRowSchema = z.object({
  unidade: z.string().min(1),
  cnpj: z.union([z.string(), z.number()]),
  inscricaoEstadual: z.union([z.string(), z.number()]).optional(),
  logradouro: z.string(),
  numero: z.string(),
  cidade: z.string(),
  uf: z.string().min(2).max(2),
  cep: z.union([z.string(), z.number()]),
});

const unidadesListQuery = z.object({
  ativa: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
  cnpj: z.string().optional(),
});

const movimentacoesQuery = z.object({
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const avancoCdBody = z.object({
  productId: z.string().uuid(),
  quantidade: z.number().int().min(1),
  unidadeOrigemId: z.string().uuid(),
  unidadeDestinoId: z.string().uuid(),
});

const remessaManualBody = z.object({
  productId: z.string().uuid(),
  quantidade: z.number().int().min(1),
  unidadeDestinoId: z.string().uuid(),
});

const unidadeIdParam = z.object({
  id: z.string().uuid("ID de unidade inválido"),
});

const bulkImportJsonBody = z.object({
  rows: z.array(importRowSchema).min(1),
  enrichCep: z.boolean().optional(),
});

function parseEnrichCepField(value: unknown): boolean {
  if (value == null || value === "") return true;
  const s = String(value).trim().toLowerCase();
  return s !== "false" && s !== "0" && s !== "no";
}

async function resolveBulkImportPayload(req: FastifyRequest): Promise<
  | { ok: true; rows: UnidadeLogisticaImportRow[]; enrichCep: boolean; parseErrors: { line: number; message: string }[] }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const contentType = req.headers["content-type"] ?? "";

  if (contentType.includes("multipart/form-data")) {
    let enrichCep = true;
    let fileBuffer: Buffer | null = null;
    let fileName = "";

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname !== "file") continue;
        fileName = part.filename ?? "";
        fileBuffer = await part.toBuffer();
        continue;
      }
      if (part.type === "field" && part.fieldname === "enrichCep") {
        enrichCep = parseEnrichCepField(part.value);
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return { ok: false, status: 400, error: "Envie o arquivo Excel no campo file" };
    }

    const lower = fileName.toLowerCase();
    if (lower && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return { ok: false, status: 400, error: "Formato inválido. Envie um arquivo .xlsx ou .xls" };
    }

    const fileValidation = validateSpreadsheetBuffer(fileBuffer, {
      fileName,
      mimeType: undefined,
    });
    if (!fileValidation.ok) {
      return { ok: false, status: 400, error: fileValidation.error };
    }

    const parsed = parseMeliUnidadesXlsx(fileBuffer);
    if (parsed.rows.length === 0) {
      return {
        ok: false,
        status: 400,
        error: parsed.errors[0]?.message ?? "Nenhuma unidade válida na planilha",
        details: parsed.errors.length > 0 ? { parseErrors: parsed.errors } : undefined,
      };
    }

    return { ok: true, rows: parsed.rows, enrichCep, parseErrors: parsed.errors };
  }

  const body = req.body as { rows?: UnidadeLogisticaImportRow[]; enrichCep?: boolean };
  const parsed = bulkImportJsonBody.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Payload inválido", details: parsed.error.flatten() };
  }

  return {
    ok: true,
    rows: parsed.data.rows,
    enrichCep: parsed.data.enrichCep !== false,
    parseErrors: [],
  };
}

export async function unidadesLogisticasRoutes(app: FastifyInstance) {
  app.get("/unidades-logisticas", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = unidadesListQuery.parse(req.query);
    const service = new UnidadeLogisticaService(app.prisma);
    const ativa = q.ativa === "false" ? false : q.ativa === "true" ? true : undefined;
    return service.list(tenantId, { ativa, q: q.q, cnpj: q.cnpj });
  });

  app.get("/unidades-logisticas/:id", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = unidadeIdParam.parse(req.params);
    const service = new UnidadeLogisticaService(app.prisma);
    const row = await service.getById(tenantId, id);
    if (!row) return reply.status(404).send({ error: "Unidade não encontrada" });
    return row;
  });

  app.post("/unidades-logisticas/bulk-import", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const payload = await resolveBulkImportPayload(req);
    if (!payload.ok) {
      return reply.status(payload.status).send({
        error: payload.error,
        ...(payload.details !== undefined ? { details: payload.details } : {}),
      });
    }

    try {
      const service = new UnidadeLogisticaService(app.prisma);
      const result = await service.bulkImport(tenantId, payload.rows, payload.enrichCep);
      return {
        ...result,
        ...(payload.parseErrors.length > 0 ? { parseErrors: payload.parseErrors } : {}),
      };
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.patch("/unidades-logisticas/:id/padrao", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = unidadeIdParam.parse(req.params);
    try {
      const service = new UnidadeLogisticaService(app.prisma);
      return await service.setPadrao(tenantId, id);
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.post("/movimentacoes/remessa", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = remessaManualBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await emitirRemessaManual(app.prisma, { tenantId, ...parsed.data });
    } catch (e) {
      if (e instanceof RemessaError || e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.post("/movimentacoes/avanco-cd", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = avancoCdBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await emitirAvancoEntreCds(app.prisma, { tenantId, ...parsed.data });
    } catch (e) {
      if (e instanceof AvancoCdError || e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.get("/movimentacoes-produto", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = movimentacoesQuery.parse(req.query);
    return listarMovimentacoesProduto(app.prisma, tenantId, {
      productId: q.productId,
      limit: q.limit,
    });
  });
}
