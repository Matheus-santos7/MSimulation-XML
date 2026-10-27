import type { Metadata } from "next";
import { PedidosView } from "@/components/pedidos-view";
import { listMarketplaces, listOrders, listProducts } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Pedidos" };

export default async function PedidosPage() {
  const [pedidos, products, marketplaces] = await Promise.all([
    listOrders(),
    listProducts(),
    listMarketplaces(),
  ]);

  return <PedidosView pedidos={pedidos} products={products} marketplaces={marketplaces} />;
}
