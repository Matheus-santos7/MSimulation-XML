/**
 * Árvore de decisão de CFOP (saídas) — simulador ML Full / estoque próprio.
 *
 * Fontes fiscais (validação 2026-07-23):
 * - Prefixo 5/6: MOC / tabela CFOP (intra vs interestadual).
 * - 5105/6105 e 5106/6106: “venda … que não deva por ele transitar” (armazém geral / Full).
 * - 5101/5102, 6101/6102: produção própria vs mercadoria de terceiros (estoque próprio).
 * - 6107/6108: venda interestadual destinada a **não contribuinte**
 *   (Receita Federal / Confaz — não confundir com ZFM: 6109/6110).
 * - 5405 / 6403 / 6404: operações com ST.
 * - 5905 / 6905: remessa para depósito fechado / armazém (tabela CFOP).
 *   Nota: Portaria CAT 31/2019 no projeto usa frequentemente 5949 para remessa
 *   a depósito temporário — ver spec `sale-fulfillment-cfop-matrix.md`.
 */

export type CfopOperacaoTipo = "remessa_armazenagem" | "venda";

export type CfopLogistica = "armazem_geral" | "estoque_proprio";

export type CfopPerfilVendedor = "industria" | "comercio";

export type CfopPerfilComprador = "contribuinte" | "consumidor_final";

/** Interesseadual ST: protocolo (6403) vs imposto já retido (6404). */
export type CfopStInterestadualMode = "protocolo" | "imposto_retido";

export type CfopRoutingInput = {
  ufOrigem: string;
  ufDestino: string;
  operacaoTipo: CfopOperacaoTipo;
  /** Obrigatório quando `operacaoTipo === "venda"`. */
  logistica?: CfopLogistica;
  perfilVendedor?: CfopPerfilVendedor;
  perfilComprador?: CfopPerfilComprador;
  produtoSt?: boolean;
  /** Só usado em venda + estoque_proprio + ST + interestadual. Default: imposto_retido → 6404. */
  stInterestadualMode?: CfopStInterestadualMode;
};

export type CfopRoutingResult = {
  cfop: string;
  prefixo: "5" | "6";
  intraestadual: boolean;
  regra: string;
};

export class CfopRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CfopRoutingError";
  }
}

function normalizeUf(uf: string): string {
  return uf.trim().toUpperCase();
}

function assertUf(uf: string, label: string): string {
  const n = normalizeUf(uf);
  if (!/^[A-Z]{2}$/.test(n)) {
    throw new CfopRoutingError(`${label} inválida: "${uf}"`);
  }
  return n;
}

/**
 * Resolve CFOP de saída pela árvore de decisão do simulador.
 */
export function resolveCfopByDecisionTree(input: CfopRoutingInput): CfopRoutingResult {
  const ufOrigem = assertUf(input.ufOrigem, "uf_origem");
  const ufDestino = assertUf(input.ufDestino, "uf_destino");
  const intraestadual = ufOrigem === ufDestino;
  const prefixo: "5" | "6" = intraestadual ? "5" : "6";

  if (input.operacaoTipo === "remessa_armazenagem") {
    const cfop = intraestadual ? "5905" : "6905";
    return {
      cfop,
      prefixo,
      intraestadual,
      regra: "remessa_armazenagem → 5905/6905",
    };
  }

  if (input.operacaoTipo !== "venda") {
    throw new CfopRoutingError(`operacao_tipo não suportado: ${String(input.operacaoTipo)}`);
  }

  const logistica = input.logistica;
  if (!logistica) {
    throw new CfopRoutingError('venda exige logistica ("armazem_geral" | "estoque_proprio")');
  }

  const perfilVendedor = input.perfilVendedor ?? "comercio";
  const perfilComprador = input.perfilComprador ?? "consumidor_final";
  const produtoSt = input.produtoSt === true;

  if (logistica === "armazem_geral") {
    if (produtoSt) {
      throw new CfopRoutingError(
        "venda via armazem_geral com produto_st=true não está na árvore; use estoque_proprio + ST ou defina regra dedicada",
      );
    }
    const cfop =
      perfilVendedor === "industria"
        ? intraestadual
          ? "5105"
          : "6105"
        : intraestadual
          ? "5106"
          : "6106";
    return {
      cfop,
      prefixo,
      intraestadual,
      regra: `venda + armazem_geral + ${perfilVendedor} → ${cfop}`,
    };
  }

  // estoque_proprio
  if (produtoSt) {
    if (intraestadual) {
      return {
        cfop: "5405",
        prefixo,
        intraestadual,
        regra: "venda + estoque_proprio + ST intra → 5405",
      };
    }
    const mode = input.stInterestadualMode ?? "imposto_retido";
    const cfop = mode === "protocolo" ? "6403" : "6404";
    return {
      cfop,
      prefixo,
      intraestadual,
      regra: `venda + estoque_proprio + ST inter (${mode}) → ${cfop}`,
    };
  }

  if (perfilVendedor === "comercio") {
    if (intraestadual) {
      return {
        cfop: "5102",
        prefixo,
        intraestadual,
        regra: "venda + estoque_proprio + comercio intra → 5102",
      };
    }
    const cfop = perfilComprador === "contribuinte" ? "6102" : "6108";
    return {
      cfop,
      prefixo,
      intraestadual,
      regra: `venda + estoque_proprio + comercio inter + ${perfilComprador} → ${cfop}`,
    };
  }

  // industria
  if (intraestadual) {
    return {
      cfop: "5101",
      prefixo,
      intraestadual,
      regra: "venda + estoque_proprio + industria intra → 5101",
    };
  }
  const cfop = perfilComprador === "contribuinte" ? "6101" : "6107";
  return {
    cfop,
    prefixo,
    intraestadual,
    regra: `venda + estoque_proprio + industria inter + ${perfilComprador} → ${cfop}`,
  };
}

/** Mapeia customerType do domínio tax → perfil comprador da árvore. */
export function customerTypeToPerfilComprador(
  customerType: "taxpayer" | "non_taxpayer",
): CfopPerfilComprador {
  return customerType === "taxpayer" ? "contribuinte" : "consumidor_final";
}
