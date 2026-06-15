/** Emitente alternativo na emissão (ex.: remessa automática pela filial após transferência). */
export type EmitenteEmissaoOverride = {
  uf: string;
  cnpj: string;
  serie: number;
  emitSnapshot: {
    cnpj: string;
    xNome: string;
    xFant: string;
    ie: string;
    crt: number;
    uf: string;
    endereco: {
      xLgr: string;
      nro: string;
      xCpl?: string;
      xBairro: string;
      cMun: string;
      xMun: string;
      uf: string;
      cep: string;
      cPais: number;
      xPais: string;
      fone?: string;
    };
  };
};

export function chaveEmissaoFromOverride(
  override: EmitenteEmissaoOverride,
): { uf: string; cnpj: string; serie: number } {
  return {
    uf: override.uf.toUpperCase(),
    cnpj: override.cnpj.replace(/\D/g, ""),
    serie: override.serie,
  };
}
