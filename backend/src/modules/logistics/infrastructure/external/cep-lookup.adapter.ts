import { lookupCep } from "../../../lookup/index.js";
import type { CepLookupPort } from "../../domain/ports/cep-lookup.port.js";

/**
 * Adapter que delega consulta CEP ao módulo **lookup** no bulk import de unidades ML.
 */
export class CepLookupAdapter implements CepLookupPort {
  /**
   * @param cep - CEP normalizado (8 dígitos)
   * @returns Bairro e código IBGE do município
   */
  async lookup(cep: string) {
    const data = await lookupCep(cep);
    return {
      bairro: data.bairro ?? "",
      codigoMunicipio: data.codigoMunicipio ?? "",
    };
  }
}
