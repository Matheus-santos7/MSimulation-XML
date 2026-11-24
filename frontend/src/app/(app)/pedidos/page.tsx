import type { Metadata } from "next";
import { ListPager } from "@/components/list-pager";
import { PedidosView } from "@/components/pedidos-view";
import { listMarketplaces, listOrdersPage, listProducts } from "@/lib/fiscal-api";
import { PAGE_PARAM, fetchPageWithin, parsePageParam } from "@/lib/paginate";

export const metadata: Metadata = { title: "Pedidos" };

const ORDERS_PER_PAGE = 25;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PedidosPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  // O assistente de pedido escolhe entre todos os produtos: essa lista continua inteira.
  const [page, products, marketplaces] = await Promise.all([
    fetchPageWithin(parsePageParam(params[PAGE_PARAM]), (n) => listOrdersPage(n, ORDERS_PER_PAGE)),
    listProducts(),
    listMarketplaces(),
  ]);

  return (
    <>
      <PedidosView
        pedidos={page.data}
        totalPedidos={page.total}
        products={products}
        marketplaces={marketplaces}
      />
      {page.totalPages > 1 ? (
        <div className="px-6 pb-6">
          <ListPager
            pathname="/pedidos"
            query={{}}
            page={page.page}
            totalPages={page.totalPages}
            totalItems={page.total}
            itemLabel="pedidos"
          />
        </div>
      ) : null}
    </>
  );
}
