import type { Metadata } from "next";
import { PedidosView } from "@/components/pedidos-view";
import { listOrders, listProducts } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Pedidos ML" };

export default async function PedidosPage() {
  const [pedidos, products] = await Promise.all([listOrders(), listProducts()]);

  return <PedidosView pedidos={pedidos} products={products} />;
}
