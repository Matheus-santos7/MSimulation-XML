import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/fiscal-ui";
import { FiscalSettingsRow, FiscalSettingsSection } from "@/components/fiscal-settings-row";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";
import {
  calculoDifalHint,
  composicaoBaseHint,
  cstDevolucaoHint,
  modalidadeFreteHint,
  prazoCancelamentoHint,
} from "@/lib/fiscal-settings-hints";

export const metadata: Metadata = { title: "Configurações fiscais" };

export default async function ConfiguracoesFiscaisPage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = await getFiscalEmitterSettings();

  const forma =
    cfg?.settings.basic.formaFaturamento === "EMISSOR_ML"
      ? "Emissor do Mercado Livre"
      : "Emissor próprio";

  const taxRulesHint =
    cfg && cfg.taxRulesCount > 0
      ? `Você possui ${cfg.taxRulesCount} regra(s) configurada(s)`
      : "Nenhuma regra importada ainda";

  const gnreHint =
    cfg && cfg.settings.taxes.emissaoGnre.estadosComIe.length > 0
      ? `IE em ${cfg.settings.taxes.emissaoGnre.estadosComIe.length} estado(s)`
      : "Nenhum estado com inscrição estadual marcado";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Configurações fiscais"
        subtitle="Parâmetros gerais do emissor de NF-e, no mesmo espírito do painel do Mercado Livre"
      />

      <FiscalSettingsSection title="Configurações básicas">
        <FiscalSettingsRow label="Forma de Faturamento" hint={forma} href="/configuracoes-fiscais/forma-faturamento" />
        <FiscalSettingsRow
          label="Dados fiscais dos anúncios"
          hint={
            cfg?.settings.basic.dadosFiscaisAnunciosOk
              ? "Dados fiscais dos anúncios configurados"
              : "Configure os dados fiscais dos seus anúncios"
          }
          href="/configuracoes-fiscais/dados-anuncios"
        />
        <FiscalSettingsRow label="Regras tributárias" hint={taxRulesHint} href="/regras" />
      </FiscalSettingsSection>

      <FiscalSettingsSection title="Configurações de impostos">
        <FiscalSettingsRow
          label="CST da Nota de Devolução"
          hint={cstDevolucaoHint(cfg)}
          href="/configuracoes-fiscais/cst-devolucao"
        />
        <FiscalSettingsRow
          label="Composição da Base de Cálculo"
          hint={composicaoBaseHint(cfg)}
          href="/configuracoes-fiscais/composicao-base-calculo"
        />
        <FiscalSettingsRow
          label="Cálculo DIFAL"
          hint={calculoDifalHint(cfg)}
          href="/configuracoes-fiscais/calculo-difal"
        />
        <FiscalSettingsRow
          label="Modalidade de Frete"
          hint={modalidadeFreteHint(cfg)}
          href="/configuracoes-fiscais/modalidade-frete"
        />
        <FiscalSettingsRow label="Emissão da GNRE" hint={gnreHint} href="/configuracoes-fiscais/emissao-gnre" />
      </FiscalSettingsSection>

      <FiscalSettingsSection title="Configurações de dados da NF-e">
        <FiscalSettingsRow
          label="Numeração e Série da NF-e"
          hint={cfg ? `NF-e série ${cfg.serieRemessa} (todas) · CT-e série ${cfg.serieCte}` : "—"}
          href="/configuracoes-fiscais/serie-nfe"
        />
        <FiscalSettingsRow
          label="Mensagem na NF-e"
          hint={
            cfg?.settings.nfe.mensagemNfeOk
              ? "Mensagens configuradas"
              : "Configure mensagens com informações obrigatórias, benefícios e isenções"
          }
          href="/configuracoes-fiscais/mensagem-nfe"
        />
        <FiscalSettingsRow
          label="Acréscimo no preço do produto"
          hint={
            cfg?.settings.nfe.acrescimoPrecoProduto
              ? "Sim, incluir acréscimo no preço do produto na NF-e"
              : "Não, não incluir acréscimo no preço do produto na NF-e"
          }
          href="/configuracoes-fiscais/acrescimo-preco"
        />
        <FiscalSettingsRow
          label="Frete de NF-e"
          hint={
            cfg?.settings.nfe.freteNoCalculo
              ? "Sim, lançar o frete no cálculo da NF-e"
              : "Não lançar o frete no cálculo da NF-e"
          }
          href="/configuracoes-fiscais/frete-nfe"
        />
        <FiscalSettingsRow
          label="Prazo para cancelamento"
          hint={prazoCancelamentoHint(cfg)}
          href="/configuracoes-fiscais/prazo-cancelamento"
        />
        <FiscalSettingsRow
          label="Acesso externo a NF-e"
          hint={
            cfg && cfg.settings.nfe.acessoExternoContatos > 0
              ? `${cfg.settings.nfe.acessoExternoContatos} contato(s) cadastrado(s) para acesso na Sefaz`
              : "Cadastre contatos para acesso externo às NF-es"
          }
          href="/configuracoes-fiscais/acesso-externo"
        />
      </FiscalSettingsSection>

      <p className="text-center text-[13px] text-muted-foreground">
        <Link href="/regras" className="text-accent hover:underline">
          Ir para planilha de regras tributárias
        </Link>
      </p>
    </div>
  );
}
