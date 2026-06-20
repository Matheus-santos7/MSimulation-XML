import type { UnidadeDestinoFiscal } from "../../../../logistics/domain/services/meli-unidade.js";

/**
 * Maps shipment destination (CD) to NF-e `dest*` table columns.
 */
export function mapShipmentDestinationToNfeFields(destino: UnidadeDestinoFiscal) {
  return {
    destNome: destino.nome,
    destDoc: destino.cnpj,
    destUf: destino.uf,
    destLogradouro: destino.logradouro,
    destNumero: destino.numero,
    destComplemento: destino.complemento,
    destBairro: destino.bairro,
    destCodigoMunicipio: destino.codigoMunicipio,
    destMunicipio: destino.municipio,
    destCep: destino.cep,
    destCodigoPais: destino.codigoPais,
    destNomePais: destino.nomePais,
    destIndIeDest: destino.indIeDest,
  };
}
