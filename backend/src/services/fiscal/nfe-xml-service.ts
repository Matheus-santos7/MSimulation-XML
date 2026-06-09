/**
 * XML autorizado da NF-e: geração na emissão e leitura via API.
 */
import {
  buildNFeXML,
  isNfeXmlPersistSupported,
  nfeProcXmlFilename,
  UnsupportedNfeXmlTipoError,
} from "@msimulation-xml/nfe-xml";
import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import type { NFeTipo, Prisma, PrismaClient, Product } from "../../generated/prisma/client.js";
import type { PrismaTx } from "../../lib/db/prisma-tx.js";
import { mapNfe } from "../../lib/fiscal/fiscal-mappers.js";
import { mapProduct, type ProductDto } from "../../lib/catalog/product-mapper.js";
import { mapEmitente } from "../../lib/org/tenant-mapper.js";
import { loadEmitterSettings } from "../../lib/fiscal/fiscal-emitter-runtime.js";
import type { Product as ProductModel, Tenant } from "../../generated/prisma/client.js";

export type NfeXmlPersistTx = PrismaTx;

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
  return buildNFeXML(nfe, mapEmitente(tenant), product, settings, products);
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

  await tx.nFe.update({
    where: { id: args.nfeId },
    data: { xmlAutorizado: xml },
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
      itens: { include: { product: true }, orderBy: { numeroItem: "asc" } },
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
  const dto = mapNfe(row, row.nfeReferencia?.chave, row.itens);
  const products = row.itens.length
    ? row.itens.map((i) => mapProduct(i.product))
    : row.product
      ? [mapProduct(row.product)]
      : undefined;
  const xml = buildNfeXmlAutorizado(
    dto,
    row.tenant,
    row.product ? mapProduct(row.product) : products?.[0],
    settings,
    products,
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
