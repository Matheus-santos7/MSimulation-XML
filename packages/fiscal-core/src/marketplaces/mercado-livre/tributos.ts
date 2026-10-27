/** IBS/CBS das remessas de fulfillment quando a regra tributária não informa. */
export const ML_IBS_CBS_REMESSA = {
  st: "410",
  cClassTrib: "410999",
} as const;

/** IBS/CBS das vendas quando a regra tributária não informa. */
export const ML_IBS_CBS_VENDA = {
  st: "000",
  cClassTrib: "000001",
  pIBSUF: 0.1,
  pIBSMun: 0,
  pCBS: 0.9,
} as const;
