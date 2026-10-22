import { describe, expect, it } from "vitest";
import { MarketplaceService } from "../marketplace.service.js";

describe("MarketplaceService", () => {
  it("should list every marketplace and only Mercado Livre as billable", () => {
    // Act
    const marketplaces = new MarketplaceService().list();

    // Assert
    expect(marketplaces).toEqual([
      {
        code: "MERCADO_LIVRE",
        nome: "Mercado Livre",
        status: "ATIVO",
        faturamentoDisponivel: true,
      },
      {
        code: "SHOPEE",
        nome: "Shopee",
        status: "PENDENTE_CONFIGURACAO",
        faturamentoDisponivel: false,
      },
      {
        code: "AMAZON",
        nome: "Amazon",
        status: "PENDENTE_CONFIGURACAO",
        faturamentoDisponivel: false,
      },
      {
        code: "MAGALU",
        nome: "Magalu",
        status: "PENDENTE_CONFIGURACAO",
        faturamentoDisponivel: false,
      },
    ]);
  });
});
