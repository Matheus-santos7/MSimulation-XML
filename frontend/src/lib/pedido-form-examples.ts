import type { PedidoFormValues } from "./pedido-form";

export type PedidoFormExampleKind = "cpf_consumidor" | "cnpj_contribuinte" | "cnpj_nao_contribuinte";

export type PedidoFormExample = {
  id: string;
  label: string;
  kind: PedidoFormExampleKind;
  /** Resumo fiscal para validação de emissão (CFOP, DIFAL, regra tributária). */
  fiscalHint: string;
  values: PedidoFormValues;
};

type StateCapital = {
  uf: string;
  municipio: string;
  codigoMunicipio: string;
  cep: string;
  logradouro: string;
  bairro: string;
};

/** Capitais brasileiras — endereços sintéticos com código IBGE válido por UF. */
const STATE_CAPITALS: StateCapital[] = [
  { uf: "AC", municipio: "Rio Branco", codigoMunicipio: "1200401", cep: "69900001", logradouro: "Rua Benjamin Constant", bairro: "Centro" },
  { uf: "AL", municipio: "Maceió", codigoMunicipio: "2704302", cep: "57020001", logradouro: "Rua do Comercio", bairro: "Centro" },
  { uf: "AP", municipio: "Macapá", codigoMunicipio: "1600303", cep: "68900001", logradouro: "Rua Cândido Mendes", bairro: "Central" },
  { uf: "AM", municipio: "Manaus", codigoMunicipio: "1302603", cep: "69005001", logradouro: "Avenida Eduardo Ribeiro", bairro: "Centro" },
  { uf: "BA", municipio: "Salvador", codigoMunicipio: "2927408", cep: "40010000", logradouro: "Rua Chile", bairro: "Comercio" },
  { uf: "CE", municipio: "Fortaleza", codigoMunicipio: "2304400", cep: "60010000", logradouro: "Rua Major Facundo", bairro: "Centro" },
  { uf: "DF", municipio: "Brasília", codigoMunicipio: "5300108", cep: "70040902", logradouro: "Esplanada dos Ministérios", bairro: "Zona Cívica" },
  { uf: "ES", municipio: "Vitória", codigoMunicipio: "3205309", cep: "29010001", logradouro: "Rua da Praia", bairro: "Centro" },
  { uf: "GO", municipio: "Goiânia", codigoMunicipio: "5208707", cep: "74003010", logradouro: "Avenida Goiás", bairro: "Centro" },
  { uf: "MA", municipio: "São Luís", codigoMunicipio: "2111300", cep: "65010000", logradouro: "Rua do Sol", bairro: "Centro" },
  { uf: "MT", municipio: "Cuiabá", codigoMunicipio: "5103403", cep: "78005000", logradouro: "Avenida Getúlio Vargas", bairro: "Centro" },
  { uf: "MS", municipio: "Campo Grande", codigoMunicipio: "5002704", cep: "79002000", logradouro: "Rua 14 de Julho", bairro: "Centro" },
  { uf: "MG", municipio: "Belo Horizonte", codigoMunicipio: "3106200", cep: "30112000", logradouro: "Avenida Afonso Pena", bairro: "Centro" },
  { uf: "PA", municipio: "Belém", codigoMunicipio: "1501402", cep: "66010000", logradouro: "Travessa Benjamin Constant", bairro: "Campina" },
  { uf: "PB", municipio: "João Pessoa", codigoMunicipio: "2507507", cep: "58010000", logradouro: "Rua das Trincheiras", bairro: "Centro" },
  { uf: "PR", municipio: "Curitiba", codigoMunicipio: "4106902", cep: "80010000", logradouro: "Rua XV de Novembro", bairro: "Centro" },
  { uf: "PE", municipio: "Recife", codigoMunicipio: "2611606", cep: "50010000", logradouro: "Rua do Bom Jesus", bairro: "Recife Antigo" },
  { uf: "PI", municipio: "Teresina", codigoMunicipio: "2211001", cep: "64000001", logradouro: "Rua Areolino de Abreu", bairro: "Centro" },
  { uf: "RJ", municipio: "Rio de Janeiro", codigoMunicipio: "3304557", cep: "20040002", logradouro: "Avenida Rio Branco", bairro: "Centro" },
  { uf: "RN", municipio: "Natal", codigoMunicipio: "2408102", cep: "59010000", logradouro: "Rua Princesa Isabel", bairro: "Cidade Alta" },
  { uf: "RS", municipio: "Porto Alegre", codigoMunicipio: "4314902", cep: "90010000", logradouro: "Rua dos Andradas", bairro: "Centro Histórico" },
  { uf: "RO", municipio: "Porto Velho", codigoMunicipio: "1100205", cep: "76801000", logradouro: "Rua José Bonifácio", bairro: "Centro" },
  { uf: "RR", municipio: "Boa Vista", codigoMunicipio: "1400100", cep: "69301000", logradouro: "Avenida Ville Roy", bairro: "Centro" },
  { uf: "SC", municipio: "Florianópolis", codigoMunicipio: "4205407", cep: "88010000", logradouro: "Rua Felipe Schmidt", bairro: "Centro" },
  { uf: "SP", municipio: "São Paulo", codigoMunicipio: "3550308", cep: "01001000", logradouro: "Praça da Sé", bairro: "Sé" },
  { uf: "SE", municipio: "Aracaju", codigoMunicipio: "2800308", cep: "49010000", logradouro: "Rua Laranjeiras", bairro: "Centro" },
  { uf: "TO", municipio: "Palmas", codigoMunicipio: "1721000", cep: "77001000", logradouro: "Quadra 104 Norte", bairro: "Plano Diretor Norte" },
];

function calcCpfCheckDigits(base9: string): string {
  const nums = base9.padStart(9, "0").slice(0, 9).split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i]! * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  sum = 0;
  const nums10 = [...nums, d1];
  for (let i = 0; i < 10; i++) sum += nums10[i]! * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return `${base9}${d1}${d2}`;
}

function calcCnpjCheckDigits(base12: string): string {
  const nums = base12.padStart(12, "0").slice(0, 12).split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = w1.reduce((acc, weight, index) => acc + nums[index]! * weight, 0);
  let d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  const nums13 = [...nums, d1];
  sum = w2.reduce((acc, weight, index) => acc + nums13[index]! * weight, 0);
  let d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return `${base12}${d1}${d2}`;
}

function formatCpf(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function buildBaseForm(partial: Omit<PedidoFormValues, "productId" | "quantidade">): PedidoFormValues {
  return {
    productId: "",
    quantidade: "1",
    ...partial,
  };
}

function cpfExampleForState(capital: StateCapital, index: number): PedidoFormExample {
  const cpfDigits = calcCpfCheckDigits(String(100000000 + index * 111111).slice(0, 9));
  return {
    id: `cpf-${capital.uf.toLowerCase()}`,
    label: `CPF consumidor final — ${capital.uf}`,
    kind: "cpf_consumidor",
    fiscalHint: `indIEDest=9 (não contribuinte) · ${capital.uf} · regra non_taxpayer · DIFAL se interestadual`,
    values: buildBaseForm({
      cpf: formatCpf(cpfDigits),
      nome: `Consumidor Final ${capital.uf}`,
      logradouro: capital.logradouro,
      numero: String(100 + index),
      complemento: "",
      bairro: capital.bairro,
      codigoMunicipio: capital.codigoMunicipio,
      municipio: capital.municipio,
      uf: capital.uf,
      cep: `${capital.cep.slice(0, 5)}-${capital.cep.slice(5)}`,
      telefone: `119${String(90000000 + index).slice(-8)}`,
      indIEDest: "9",
    }),
  };
}

const CNPJ_CONTRIBUINTE = formatCnpj(calcCnpjCheckDigits("782428490001"));
const CNPJ_NAO_CONTRIBUINTE = formatCnpj(calcCnpjCheckDigits("112223330001"));

/** Exemplos de pedido para simulação fiscal (uma UF por estado + CNPJ contribuinte/não contribuinte). */
export const PEDIDO_FORM_EXAMPLES: PedidoFormExample[] = [
  ...STATE_CAPITALS.map((capital, index) => cpfExampleForState(capital, index)),
  {
    id: "cnpj-contribuinte-sp",
    label: "CNPJ contribuinte ICMS — SP",
    kind: "cnpj_contribuinte",
    fiscalHint: "indIEDest=1 (contribuinte) · regra taxpayer · CFOP interestadual/intra conforme origem",
    values: buildBaseForm({
      cpf: CNPJ_CONTRIBUINTE,
      nome: "Comercial Atlas Distribuidora LTDA",
      logradouro: "Avenida Paulista",
      numero: "1000",
      complemento: "Sala 12",
      bairro: "Bela Vista",
      codigoMunicipio: "3550308",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01310-100",
      telefone: "1133334444",
      indIEDest: "1",
    }),
  },
  {
    id: "cnpj-nao-contribuinte-rj",
    label: "CNPJ não contribuinte — RJ",
    kind: "cnpj_nao_contribuinte",
    fiscalHint: "indIEDest=9 (não contribuinte) · regra non_taxpayer · DIFAL se emitente em outra UF",
    values: buildBaseForm({
      cpf: CNPJ_NAO_CONTRIBUINTE,
      nome: "Serviços Beta Digital EIRELI",
      logradouro: "Avenida Rio Branco",
      numero: "156",
      complemento: "Andar 3",
      bairro: "Centro",
      codigoMunicipio: "3304557",
      municipio: "Rio de Janeiro",
      uf: "RJ",
      cep: "20040-002",
      telefone: "21988887777",
      indIEDest: "9",
    }),
  },
  {
    id: "cnpj-contribuinte-pr",
    label: "CNPJ contribuinte ICMS — PR",
    kind: "cnpj_contribuinte",
    fiscalHint: "indIEDest=1 (contribuinte) · mesma UF do emitente típico · regra taxpayer",
    values: buildBaseForm({
      cpf: formatCnpj(calcCnpjCheckDigits("456789120001")),
      nome: "Indústria Gamma Paraná LTDA",
      logradouro: "Rua XV de Novembro",
      numero: "500",
      complemento: "",
      bairro: "Centro",
      codigoMunicipio: "4106902",
      municipio: "Curitiba",
      uf: "PR",
      cep: "80020-310",
      telefone: "4132221100",
      indIEDest: "1",
    }),
  },
];

export function findPedidoFormExample(id: string): PedidoFormExample | undefined {
  return PEDIDO_FORM_EXAMPLES.find((example) => example.id === id);
}

export const PEDIDO_FORM_EXAMPLE_GROUPS: { label: string; kind: PedidoFormExampleKind }[] = [
  { label: "CPF — consumidor final (por UF)", kind: "cpf_consumidor" },
  { label: "CNPJ — contribuinte ICMS", kind: "cnpj_contribuinte" },
  { label: "CNPJ — não contribuinte", kind: "cnpj_nao_contribuinte" },
];
