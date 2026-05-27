/**
 * Mock fiscal data for simulation. All CNPJs, chaves de acesso, NCMs, CFOPs
 * and inscrições estaduais here are illustrative — NOT VALID FOR REAL FISCAL USE.
 *
 * Designed to mirror the shape of a real NFe v4.00 issuance scenario inside
 * the Mercado Livre Full fulfillment operation.
 */

export type FiscalStatus =
  | "AUTORIZADA"
  | "PENDENTE"
  | "REJEITADA"
  | "CANCELADA"
  | "DENEGADA";

export type EnvironmentType = "HOMOLOGACAO" | "PRODUCAO";

export interface Tenant {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  uf: string;
  ambiente: EnvironmentType;
}

export interface NFe {
  chave: string; // 44 digits
  numero: number;
  serie: number;
  natOp: string;
  cfop: string;
  ncm: string;
  destinatario: { nome: string; doc: string; uf: string };
  valor: number;
  valorICMS: number;
  aliqICMS: number;
  status: FiscalStatus;
  emitidaEm: string; // ISO
  pedidoML: string;
}

export interface CTe {
  chave: string;
  numero: number;
  modal: "Rodoviário" | "Aéreo";
  origem: string;
  destino: string;
  valor: number;
  status: FiscalStatus;
  emitidoEm: string;
}

export interface FiscalEvent {
  id: string;
  tipo: "110111" | "110110" | "210200" | "210210" | "210220" | "210240";
  descricao: string;
  chaveRef: string;
  ocorridoEm: string;
  protocolo: string;
}

export interface AuditEntry {
  id: string;
  ator: string;
  acao: string;
  recurso: string;
  ocorridoEm: string;
  hash: string;
}

export interface TimelineStep {
  label: string;
  status: "done" | "current" | "pending";
  at?: string;
  meta?: string;
}

export const TENANTS: Tenant[] = [
  {
    id: "t1",
    razaoSocial: "Logística Brasil S.A. - Matriz",
    nomeFantasia: "LogBR Matriz",
    cnpj: "12.345.678/0001-90",
    ie: "123.456.789.012",
    uf: "SP",
    ambiente: "HOMOLOGACAO",
  },
  {
    id: "t2",
    razaoSocial: "Logística Brasil S.A. - Filial Sul",
    nomeFantasia: "LogBR Curitiba",
    cnpj: "12.345.678/0002-71",
    ie: "907.654.321.098",
    uf: "PR",
    ambiente: "HOMOLOGACAO",
  },
];

/** Builds a 44-char NFe access key (chave de acesso). Format-faithful, not check-valid. */
export function buildChave(uf: number, aamm: string, cnpj: string, mod: number, serie: number, nNF: number, tpEmis: number, cNF: number): string {
  const onlyDigits = (s: string) => s.replace(/\D/g, "");
  const k =
    String(uf).padStart(2, "0") +
    aamm +
    onlyDigits(cnpj).padStart(14, "0") +
    String(mod).padStart(2, "0") +
    String(serie).padStart(3, "0") +
    String(nNF).padStart(9, "0") +
    String(tpEmis).padStart(1, "0") +
    String(cNF).padStart(8, "0");
  // simulated DV (modulo-11 approximation, simulation-only)
  let sum = 0;
  let mult = 2;
  for (let i = k.length - 1; i >= 0; i--) {
    sum += parseInt(k[i], 10) * mult;
    mult = mult === 9 ? 2 : mult + 1;
  }
  const dv = (sum % 11 < 2) ? 0 : 11 - (sum % 11);
  return k + String(dv);
}

export function formatChave(c: string): string {
  return c.replace(/(\d{4})/g, "$1 ").trim();
}

export const NFES: NFe[] = [
  {
    chave: buildChave(35, "2511", "12345678000190", 55, 1, 428192, 1, 28374655),
    numero: 428192,
    serie: 1,
    natOp: "Venda de mercadoria adquirida de terceiros",
    cfop: "6404",
    ncm: "61091000",
    destinatario: { nome: "Mercado Livre S.A.", doc: "03.007.331/0001-41", uf: "SP" },
    valor: 1240.0,
    valorICMS: 223.2,
    aliqICMS: 18,
    status: "AUTORIZADA",
    emitidaEm: "2026-05-27T14:22:13-03:00",
    pedidoML: "ML-2026-98230",
  },
  {
    chave: buildChave(35, "2511", "12345678000190", 55, 1, 428195, 1, 28374658),
    numero: 428195,
    serie: 1,
    natOp: "Venda de mercadoria",
    cfop: "5102",
    ncm: "84713012",
    destinatario: { nome: "Varejo Online Ltda", doc: "45.102.304/0001-22", uf: "SP" },
    valor: 842.5,
    valorICMS: 151.65,
    aliqICMS: 18,
    status: "PENDENTE",
    emitidaEm: "2026-05-27T14:31:02-03:00",
    pedidoML: "ML-2026-98231",
  },
  {
    chave: buildChave(35, "2511", "12345678000190", 55, 1, 428201, 1, 28374671),
    numero: 428201,
    serie: 1,
    natOp: "Venda de mercadoria — interestadual",
    cfop: "6108",
    ncm: "61091000",
    destinatario: { nome: "João Silva Rodrigues", doc: "***.442.108-**", uf: "MG" },
    valor: 459.9,
    valorICMS: 55.19,
    aliqICMS: 12,
    status: "AUTORIZADA",
    emitidaEm: "2026-05-27T13:58:41-03:00",
    pedidoML: "ML-2026-98225",
  },
  {
    chave: buildChave(35, "2511", "12345678000190", 55, 1, 428158, 1, 28374599),
    numero: 428158,
    serie: 1,
    natOp: "Devolução de venda",
    cfop: "1202",
    ncm: "85176259",
    destinatario: { nome: "Ana Paula Oliveira", doc: "***.991.228-**", uf: "RJ" },
    valor: 89.9,
    valorICMS: 16.18,
    aliqICMS: 18,
    status: "AUTORIZADA",
    emitidaEm: "2026-05-27T12:14:07-03:00",
    pedidoML: "ML-2026-98119",
  },
  {
    chave: buildChave(35, "2511", "12345678000190", 55, 1, 428102, 1, 28374488),
    numero: 428102,
    serie: 1,
    natOp: "Venda de mercadoria",
    cfop: "5102",
    ncm: "39269090",
    destinatario: { nome: "Marcos Vinícius Junior", doc: "***.118.302-**", uf: "SP" },
    valor: 45.9,
    valorICMS: 8.26,
    aliqICMS: 18,
    status: "REJEITADA",
    emitidaEm: "2026-05-27T11:02:19-03:00",
    pedidoML: "ML-2026-97902",
  },
];

export const CTES: CTe[] = [
  {
    chave: buildChave(35, "2511", "12345678000190", 57, 1, 10294, 1, 11220033),
    numero: 10294,
    modal: "Rodoviário",
    origem: "Cajamar/SP",
    destino: "Belo Horizonte/MG",
    valor: 38.4,
    status: "AUTORIZADA",
    emitidoEm: "2026-05-27T14:22:40-03:00",
  },
  {
    chave: buildChave(35, "2511", "12345678000190", 57, 1, 10295, 1, 11220034),
    numero: 10295,
    modal: "Rodoviário",
    origem: "Cajamar/SP",
    destino: "São Paulo/SP",
    valor: 12.9,
    status: "PENDENTE",
    emitidoEm: "2026-05-27T14:33:00-03:00",
  },
];

export const EVENTS: FiscalEvent[] = [
  {
    id: "e1",
    tipo: "110111",
    descricao: "Cancelamento de NF-e",
    chaveRef: NFES[4].chave,
    ocorridoEm: "2026-05-27T11:08:50-03:00",
    protocolo: "135260000099420",
  },
  {
    id: "e2",
    tipo: "110110",
    descricao: "Carta de Correção Eletrônica (CC-e)",
    chaveRef: NFES[2].chave,
    ocorridoEm: "2026-05-27T14:01:12-03:00",
    protocolo: "135260000099421",
  },
  {
    id: "e3",
    tipo: "210200",
    descricao: "Confirmação da operação (manifestação destinatário)",
    chaveRef: NFES[0].chave,
    ocorridoEm: "2026-05-27T14:24:55-03:00",
    protocolo: "135260000099422",
  },
];

export const AUDIT: AuditEntry[] = [
  {
    id: "a1",
    ator: "joao.silva@logbr.com",
    acao: "EMISSAO_NFE",
    recurso: NFES[0].chave,
    ocorridoEm: "2026-05-27T14:22:13-03:00",
    hash: "a1b2c3d4e5f6g7h8",
  },
  {
    id: "a2",
    ator: "system.tax-engine",
    acao: "CALCULO_ICMS",
    recurso: NFES[0].chave,
    ocorridoEm: "2026-05-27T14:22:12-03:00",
    hash: "b2c3d4e5f6g7h8i9",
  },
  {
    id: "a3",
    ator: "maria.oliveira@logbr.com",
    acao: "CANCELAMENTO_NFE",
    recurso: NFES[4].chave,
    ocorridoEm: "2026-05-27T11:08:50-03:00",
    hash: "c3d4e5f6g7h8i9j0",
  },
];

export const TIMELINE_ATUAL: TimelineStep[] = [
  { label: "Venda recebida ML", status: "done", at: "14:02", meta: "Pedido ML-2026-98231" },
  { label: "Picking concluído", status: "done", at: "14:15", meta: "Operador: J. SILVA" },
  { label: "Packing finalizado", status: "done", at: "14:18", meta: "Caixa M-204" },
  { label: "NF-e autorizada", status: "current", at: "14:22", meta: "Aguardando protocolo" },
  { label: "CT-e gerado", status: "pending", meta: "Previsão 14:30" },
  { label: "Coleta Mercado Livre", status: "pending", meta: "Janela 16:00–17:00" },
];

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
