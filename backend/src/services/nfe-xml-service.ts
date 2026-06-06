/**
 * XML autorizado da NF-e: geração na emissão e leitura via API.
 *
 * Persistência na emissão: todos os tipos de NF-e do domínio fulfillment.
 * Notas antigas sem `xml_autorizado` são regeradas no GET quando o tipo é suportado.
 */
import {
  buildNFeXML,
  isNfeXmlPersistSupported,
  nfeProcXmlFilename,
  UnsupportedNfeXmlTipoError,
} from "@msimulation-xml/nfe-xml";
import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import type { NFeTipo, Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { PrismaTx } from "../lib/db/prisma-tx.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { mapProduct, type ProductDto } from "../lib/product-mapper.js";
import { mapEmitente } from "../lib/tenant-mapper.js";
import { loadEmitterSettings } from "../lib/fiscal-emitter-runtime.js";
import type { Product, Tenant } from "../generated/prisma/client.js";
/** Cliente Prisma dentro de transação de emissão. */
export type NfeXmlPersistTx = PrismaTx;

export type NfeXmlResult = {
  xml: string;
  filename: string;
  source: "stored" | "regenerated";
};

type NfeRowForMap = Parameters<typeof mapNfe>[0];

export function buildNfeXmlAutorizado(
  nfe: ReturnType<typeof mapNfe>,
  tenant: Tenant,
  product: ProductDto | undefined,
  settings: FiscalEmitterSettingsData | null,
): string {
  if (!isNfeXmlPersistSupported(nfe.tipo)) {
    throw new UnsupportedNfeXmlTipoError(nfe.tipo);
  }
  return buildNFeXML(nfe, mapEmitente(tenant), product, settings);
}

/** Grava `xmlAutorizado` na mesma transação da emissão. */
export async function persistNfeXmlAutorizado(
  tx: NfeXmlPersistTx,
  args: {
    nfeId: string;
    tenant: Tenant;
    nfeRow: NfeRowForMap;
    nfeReferenciaChave?: string;
    product?: Product | null;
    settings: FiscalEmitterSettingsData;
  },
): Promise<void> {
  if (!isNfeXmlPersistSupported(args.nfeRow.tipo)) return;

  const dto = mapNfe(args.nfeRow, args.nfeReferenciaChave);
  const xml = buildNfeXmlAutorizado(
    dto,
    args.tenant,
    args.product ? mapProduct(args.product) : undefined,
    args.settings,
  );

  await tx.nFe.update({
    where: { id: args.nfeId },
    data: { xmlAutorizado: xml },
  });
}

/**
 * Persiste XML após `nfe.create` — recarrega linha e produto no banco (evita DTO incompleto).
 */
export async function persistNfeXmlFromEmission(
  tx: NfeXmlPersistTx,
  args: {
    nfeId: string;
    tenant: Tenant;
    productId: string;
    settings: FiscalEmitterSettingsData;
    nfeReferenciaChave?: string;
  },
): Promise<void> {
  const nfeRow = await tx.nFe.findUniqueOrThrow({ where: { id: args.nfeId } });
  if (!isNfeXmlPersistSupported(nfeRow.tipo)) return;

  const product = await tx.product.findFirst({
    where: { id: args.productId, tenantId: args.tenant.id },
  });

  await persistNfeXmlAutorizado(tx, {
    nfeId: args.nfeId,
    tenant: args.tenant,
    nfeRow,
    nfeReferenciaChave: args.nfeReferenciaChave,
    product,
    settings: args.settings,
  });
}

export async function resolveNfeXml(
  prisma: PrismaClient,
  tenantId: string,
  chave: string,
): Promise<NfeXmlResult | null> {
  const row = await prisma.nFe.findFirst({
    where: { chave, tenantId, deletedAt: null },
    include: {
      nfeReferencia: { select: { chave: true } },
      tenant: true,
      product: true,
    },
  });
  if (!row) return null;

  const filename = nfeProcXmlFilename(row.numero, row.serie);

  if (row.xmlAutorizado?.trim()) {
    return { xml: row.xmlAutorizado, filename, source: "stored" };
  }

  if (!isNfeXmlPersistSupported(row.tipo)) {
    return null;
  }

  const settings = await loadEmitterSettings(prisma, tenantId);
  const dto = mapNfe(row, row.nfeReferencia?.chave);
  const xml = buildNfeXmlAutorizado(
    dto,
    row.tenant,
    row.product ? mapProduct(row.product) : undefined,
    settings,
  );

  return { xml, filename, source: "regenerated" };
}

export class NfeXmlUnavailableError extends Error {
  readonly tipo: NFeTipo;

  constructor(tipo: NFeTipo) {
    super(`XML persistido indisponível para NF-e tipo ${tipo}`);
    this.name = "NfeXmlUnavailableError";
    this.tipo = tipo;
  }
}
