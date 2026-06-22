/**
 * XML autorizado da NF-e: geração na emissão e leitura via API.
 *
 * Geração via Factory + Serializer (`createNFeBuilder` → `buildXml()` em @msimulation-xml/nfe-xml).
 * Remessa física: `persistNfeXmlAutorizado` → `buildNfeXmlAutorizado` → `buildNFeXmlFromBuilder`.
 * @see docs/remessa-fisica.md — Fase 8
 */
import { fiscalXmlDownloadFilename, simulationNProt } from "@msimulation-xml/fiscal-core";
import {
  buildNFeXmlFromBuilder,
  buildProcEventoCancelamentoXML,
  isNfeXmlPersistSupported,
  UnsupportedNfeXmlTipoError,
  type EmitenteXml,
  type NFeFactoryInput,
} from "@msimulation-xml/nfe-xml";
import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import {
  FiscalStatus,
  type Product,
  type Tenant,
} from "../../../../generated/prisma/client.js";
import type { DbClient, PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../presentation/mappers/fiscal-mappers.js";
import { mapProduct, type ProductDto } from "../../../catalog/index.js";
import { mapEmitente } from "../../../org/infrastructure/fiscal/tenant-emitente.mapper.js";
import { loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { createFiscalValidationModule } from "../../../fiscal-validation/infrastructure/factory/fiscal-validation-module.factory.js";
import { toPrismaNfeValidationUpdate } from "../../../fiscal-validation/infrastructure/prisma/nfe-validation-persistence.mapper.js";

export type NfeXmlPersistTx = PrismaTx;

/** XML persistido com defeitos conhecidos — força regeneração na leitura. */
function hasKnownNfeXmlDefect(xml: string): boolean {
  return /<dhSaiEnt>[\s\S]*?<\/dhEmi>/.test(xml);
}

export type NfeXmlResult = {
  xml: string;
  filename: string;
  source: "stored" | "regenerated";
};

type NfeRowForMap = Parameters<typeof mapNfe>[0];
type NfeItemRowForMap = NonNullable<Parameters<typeof mapNfe>[2]>[number];

function mapProductsForXml(products: (Product | ProductDto)[]): ProductDto[] {
  return products.map((p) =>
    "preco" in p && typeof p.preco === "number" ? (p as ProductDto) : mapProduct(p as Product),
  );
}

export function buildNfeXmlAutorizado(
  nfe: ReturnType<typeof mapNfe>,
  tenant: Tenant,
  product: ProductDto | undefined,
  settings: FiscalEmitterSettingsData | null,
  products?: ProductDto[],
): string {
  if (!isNfeXmlPersistSupported(nfe.tipo)) {
    throw new UnsupportedNfeXmlTipoError(nfe.tipo);
  }
  const fiscalPayload = (nfe.fiscalPayload ?? {}) as Record<string, unknown>;
  const emitSnapshot = fiscalPayload.emitSnapshot as EmitenteXml | undefined;
  const emit = emitSnapshot ?? mapEmitente(tenant);
  const input: NFeFactoryInput = { nfe, emit, product, emitterSettings: settings, products };
  // XML gerado via Factory Strategy + XmlSerializer (sem template strings).
  return buildNFeXmlFromBuilder(input);
}

export async function persistNfeXmlAutorizado(
  tx: NfeXmlPersistTx,
  args: {
    nfeId: string;
    tenant: Tenant;
    nfeRow: NfeRowForMap;
    nfeReferenciaChave?: string;
    product?: Product | null;
    products?: Product[];
    itemRows?: NfeItemRowForMap[];
    settings: FiscalEmitterSettingsData;
  },
): Promise<void> {
  if (!isNfeXmlPersistSupported(args.nfeRow.tipo)) return;

  const dto = mapNfe(args.nfeRow, args.nfeReferenciaChave, args.itemRows);
  const primaryProduct = args.product ? mapProduct(args.product) : undefined;
  const allProducts = args.products?.length
    ? mapProductsForXml(args.products)
    : primaryProduct
      ? [primaryProduct]
      : undefined;

  const xml = buildNfeXmlAutorizado(
    dto,
    args.tenant,
    primaryProduct,
    args.settings,
    allProducts,
  );

  const fiscalValidation = createFiscalValidationModule();
  const outcome = await fiscalValidation.validateNfeXml.execute(xml);
  const validationUpdate = toPrismaNfeValidationUpdate(outcome);

  await tx.nFe.update({
    where: { id: args.nfeId },
    data: {
      xmlAutorizado: xml,
      ...validationUpdate,
    },
  });
}

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

  const [product, itemRows] = await Promise.all([
    tx.product.findFirst({
      where: { id: args.productId, tenantId: args.tenant.id },
    }),
    tx.nfeItem.findMany({
      where: { nfeId: args.nfeId },
      include: { product: true },
      orderBy: { numeroItem: "asc" },
    }),
  ]);

  await persistNfeXmlAutorizado(tx, {
    nfeId: args.nfeId,
    tenant: args.tenant,
    nfeRow,
    nfeReferenciaChave: args.nfeReferenciaChave,
    product,
    products: itemRows.map((i) => i.product),
    itemRows,
    settings: args.settings,
  });
}

export type NfeRowForXmlResolution = Parameters<typeof mapNfe>[0] & {
  xmlAutorizado: string | null;
  nfeReferencia: { chave: string } | null;
  tenant: Tenant;
  product: Product | null;
  itens: Array<NonNullable<Parameters<typeof mapNfe>[2]>[number] & { product: Product }>;
};

/**
 * Resolves NF-e XML from persisted storage or regenerates it when missing or defective.
 */
export async function resolveNfeXmlStringFromLoadedRow(
  db: DbClient,
  tenantId: string,
  row: NfeRowForXmlResolution,
): Promise<string | null> {
  const stored = row.xmlAutorizado?.trim();
  if (stored && !hasKnownNfeXmlDefect(stored)) {
    return stored;
  }

  if (!isNfeXmlPersistSupported(row.tipo)) {
    return null;
  }

  const settings = await loadEmitterSettings(db, tenantId);
  const dto = mapNfe(row, row.nfeReferencia?.chave, row.itens);
  const products = row.itens.length
    ? row.itens.map((i) => mapProduct(i.product))
    : row.product
      ? [mapProduct(row.product)]
      : undefined;

  return buildNfeXmlAutorizado(
    dto,
    row.tenant,
    row.product ? mapProduct(row.product) : products?.[0],
    settings,
    products,
  );
}

export async function resolveNfeXml(
  db: DbClient,
  tenantId: string,
  chave: string,
): Promise<NfeXmlResult | null> {
  const row = await db.nFe.findFirst({
    where: { chave, tenantId, deletedAt: null },
    include: {
      nfeReferencia: { select: { chave: true } },
      tenant: true,
      product: true,
      itens: { include: { product: true }, orderBy: { numeroItem: "asc" } },
    },
  });
  if (!row) return null;

  const filename = fiscalXmlDownloadFilename("NFe", chave);
  const stored = row.xmlAutorizado?.trim();
  const source = stored && !hasKnownNfeXmlDefect(stored) ? "stored" : "regenerated";
  const xml = await resolveNfeXmlStringFromLoadedRow(db, tenantId, row);
  if (!xml) return null;

  return { xml, filename, source };
}

export async function resolveNfeCancelamentoEventoXml(
  db: DbClient,
  tenantId: string,
  chave: string,
): Promise<NfeXmlResult | null> {
  const row = await db.nFe.findFirst({
    where: { chave, tenantId, deletedAt: null },
    include: {
      tenant: true,
      nfeReferencia: { select: { chave: true } },
      itens: { include: { product: true }, orderBy: { numeroItem: "asc" } },
      fiscalEvents: {
        where: { tipo: "110111" },
        orderBy: { ocorridoEm: "desc" },
        take: 1,
      },
    },
  });
  if (!row) return null;

  const cancelamento = row.fiscalEvents[0];
  if (!cancelamento && row.status !== FiscalStatus.CANCELADA) return null;

  const dto = mapNfe(row, row.nfeReferencia?.chave, row.itens);
  const emit = mapEmitente(row.tenant);
  const evento = cancelamento
    ? {
        protocolo: cancelamento.protocolo,
        ocorridoEm: cancelamento.ocorridoEm.toISOString(),
        xJust: cancelamento.xJust ?? undefined,
      }
    : {
        protocolo: simulationNProt(row.numero, "141260056230"),
        ocorridoEm: new Date().toISOString(),
        xJust: "Cancelamento solicitado pelo emissor",
      };

  const xml = buildProcEventoCancelamentoXML(dto, emit, evento);
  const filename = fiscalXmlDownloadFilename("Canc", chave);
  return { xml, filename, source: "regenerated" };
}
