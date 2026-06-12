/** Resultado enriquecido de CEP para importação de unidades ML. */
export type CepLookupResult = {
  bairro: string;
  codigoMunicipio: string;
};

/**
 * Port de consulta CEP usado no bulk import (bairro e código IBGE do município).
 */
export interface CepLookupPort {
  lookup(cep: string): Promise<CepLookupResult>;
}
