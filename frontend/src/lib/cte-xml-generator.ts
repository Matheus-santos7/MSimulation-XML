/**
 * CT-e v4.00 — delega ao gerador compartilhado em @msimulation-xml/fiscal-core.
 */
import {
  buildCTeXML as buildCTeXMLCore,
  participanteRemetenteFromTenant,
  type CteFiscalPayload,
} from "@msimulation-xml/fiscal-core";
import type { CTeDto, TenantDto } from "./fiscal-types";

export function buildCTeXML(cte: CTeDto, remetente: TenantDto): string {
  const fiscalPayload = (cte.fiscalPayload as CteFiscalPayload | undefined) ?? null;

  return buildCTeXMLCore({
    chave: cte.chave,
    numero: cte.numero,
    serie: cte.serie,
    cfop: cte.cfop,
    natOp: cte.natOp,
    valor: cte.valor,
    valorCarga: cte.valorCarga,
    pesoCarga: cte.pesoCarga,
    status: cte.status,
    emitidoEm: cte.emitidoEm,
    fiscalPayload,
    remetenteFallback: participanteRemetenteFromTenant({
      cnpj: remetente.cnpj,
      ie: remetente.ie,
      razaoSocial: remetente.razaoSocial,
      logradouro: remetente.logradouro,
      numero: remetente.numero,
      bairro: remetente.bairro,
      codigoMunicipio: remetente.codigoMunicipio,
      municipio: remetente.municipio,
      uf: remetente.uf,
      cep: remetente.cep,
    }),
  });
}
