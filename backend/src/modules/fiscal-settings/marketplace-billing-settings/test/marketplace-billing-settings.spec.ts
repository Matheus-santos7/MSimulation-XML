import { describe, expect, it, vi } from "vitest";
import { loadEmitterSettings } from "../../billing-settings/effective-billing-settings.js";
import type { EmitterSettingsService } from "../../emitter-settings/emitter-settings.service.js";
import { DEFAULT_FISCAL_EMITTER_SETTINGS } from "../../emitter-settings/rules/fiscal-emitter-settings-defaults.js";
import type { MarketplaceBillingSettingsRepository } from "../marketplace-billing-settings.repository.js";
import { MarketplaceBillingSettingsService } from "../marketplace-billing-settings.service.js";
import {
  applyMarketplaceOverrides,
  parseMarketplaceOverrides,
} from "../rules/apply-marketplace-overrides.js";

describe("applyMarketplaceOverrides", () => {
  it("should keep the tenant defaults where the marketplace does not override", () => {
    // Act
    const effective = applyMarketplaceOverrides(DEFAULT_FISCAL_EMITTER_SETTINGS, {});

    // Assert
    expect(effective).toEqual(DEFAULT_FISCAL_EMITTER_SETTINGS);
  });

  it("should replace only the overridden fields, deep in nested sections", () => {
    // Act
    const effective = applyMarketplaceOverrides(DEFAULT_FISCAL_EMITTER_SETTINGS, {
      basic: { logisticaPadrao: "estoque_proprio" },
      nfe: { mensagemPadrao: "Venda Shopee", prazoCancelamento: { horas: 48 } },
    });

    // Assert
    expect(effective.basic.logisticaPadrao).toBe("estoque_proprio");
    expect(effective.basic.perfilVendedor).toBe(
      DEFAULT_FISCAL_EMITTER_SETTINGS.basic.perfilVendedor,
    );
    expect(effective.nfe.mensagemPadrao).toBe("Venda Shopee");
    expect(effective.nfe.prazoCancelamento).toEqual({
      ...DEFAULT_FISCAL_EMITTER_SETTINGS.nfe.prazoCancelamento,
      horas: 48,
    });
    expect(effective.taxes).toEqual(DEFAULT_FISCAL_EMITTER_SETTINGS.taxes);
  });
});

describe("parseMarketplaceOverrides", () => {
  it.each([null, undefined, "x", [], 1])("should read %j as no override", (raw) => {
    expect(parseMarketplaceOverrides(raw)).toEqual({});
  });

  it("should keep only the known sections", () => {
    expect(parseMarketplaceOverrides({ basic: { a: 1 }, nfe: [], extra: { b: 2 } })).toEqual({
      basic: { a: 1 },
    });
  });
});

describe("loadEmitterSettings", () => {
  const tenantSettings = { basic: { logisticaPadrao: "armazem_geral" } };

  function fakeDb(overrides: unknown) {
    return {
      fiscalEmitterSettings: {
        findUnique: vi.fn().mockResolvedValue({ settings: tenantSettings }),
      },
      marketplaceBillingSettings: {
        findUnique: vi.fn().mockResolvedValue(overrides ? { overrides } : null),
      },
    };
  }

  it("should return the tenant defaults without marketplace", async () => {
    // Arrange
    const db = fakeDb({ basic: { logisticaPadrao: "estoque_proprio" } });

    // Act
    const settings = await loadEmitterSettings(db, "tenant-1");

    // Assert
    expect(settings.basic.logisticaPadrao).toBe("armazem_geral");
    expect(db.marketplaceBillingSettings.findUnique).not.toHaveBeenCalled();
  });

  it("should apply the marketplace override on top of the tenant defaults", async () => {
    // Arrange
    const db = fakeDb({ basic: { logisticaPadrao: "estoque_proprio" } });

    // Act
    const settings = await loadEmitterSettings(db, "tenant-1", "SHOPEE");

    // Assert
    expect(settings.basic.logisticaPadrao).toBe("estoque_proprio");
    expect(db.marketplaceBillingSettings.findUnique).toHaveBeenCalledWith({
      where: { tenantId_marketplace: { tenantId: "tenant-1", marketplace: "SHOPEE" } },
    });
  });

  it("should read the legacy EMISSOR_ML as EMISSOR_MARKETPLACE", async () => {
    // Arrange
    const db = {
      fiscalEmitterSettings: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ settings: { basic: { formaFaturamento: "EMISSOR_ML" } } }),
      },
      marketplaceBillingSettings: { findUnique: vi.fn() },
    };

    // Act
    const settings = await loadEmitterSettings(db, "tenant-1");

    // Assert
    expect(settings.basic.formaFaturamento).toBe("EMISSOR_MARKETPLACE");
  });
});

describe("MarketplaceBillingSettingsService", () => {
  it("should save the override and answer the effective settings", async () => {
    // Arrange
    const repository = { saveOverrides: vi.fn(), findOverrides: vi.fn() };
    const emitterSettings = {
      get: vi.fn().mockResolvedValue({ settings: DEFAULT_FISCAL_EMITTER_SETTINGS }),
    };
    const service = new MarketplaceBillingSettingsService(
      repository as unknown as MarketplaceBillingSettingsRepository,
      emitterSettings as unknown as EmitterSettingsService,
    );

    // Act
    const view = await service.replace("tenant-1", "AMAZON", { nfe: { mensagemPadrao: "Amazon" } });

    // Assert
    expect(repository.saveOverrides).toHaveBeenCalledWith("tenant-1", "AMAZON", {
      nfe: { mensagemPadrao: "Amazon" },
    });
    expect(view.marketplace).toBe("AMAZON");
    expect(view.effective.nfe.mensagemPadrao).toBe("Amazon");
  });
});
