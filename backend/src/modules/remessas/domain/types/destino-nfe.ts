/** Campos dest* da tabela nfes (destinatário fiscal). */
export type CamposDestinoNfe = {
  destNome: string;
  destDoc: string;
  destUf: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destIndIeDest: number;
};
