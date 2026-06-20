import { NFeTipo } from "../../../../generated/prisma/client.js";
import { fiscalNotDeleted } from "../../../fiscal-documents/domain/constants/fiscal-not-deleted.js";

/** Saldo FIFO: remessa física + remessa avanço entre CDs. */
export const REMESSA_FIFO_TIPOS: NFeTipo[] = [NFeTipo.REMESSA, NFeTipo.REMESSA_AVANCO];

export const buildRemessaFifoNfeWhere = (tenantId: string) => ({
  tenantId,
  tipo: { in: REMESSA_FIFO_TIPOS },
  ...fiscalNotDeleted,
});

export const REMESSA_DEST_SELECT = {
  id: true,
  chave: true,
  tipo: true,
  destNome: true,
  destDoc: true,
  destUf: true,
  destLogradouro: true,
  destNumero: true,
  destComplemento: true,
  destBairro: true,
  destCodigoMunicipio: true,
  destMunicipio: true,
  destCep: true,
  destCodigoPais: true,
  destNomePais: true,
  destTelefone: true,
  destIndIeDest: true,
  fiscalPayload: true,
  unidadeDestino: {
    select: {
      ie: true,
      idCadIntTran: true,
      codigoMunicipio: true,
      municipio: true,
      bairro: true,
      logradouro: true,
      numero: true,
      complemento: true,
      cep: true,
    },
  },
} as const;
