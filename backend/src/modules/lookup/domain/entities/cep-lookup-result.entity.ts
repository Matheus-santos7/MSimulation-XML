export interface CepLookupResult {
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  codigoMunicipio?: string;
  uf: string;
}
