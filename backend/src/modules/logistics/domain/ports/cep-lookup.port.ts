export type CepLookupResult = {
  bairro: string;
  codigoMunicipio: string;
};

export interface CepLookupPort {
  lookup(cep: string): Promise<CepLookupResult>;
}
