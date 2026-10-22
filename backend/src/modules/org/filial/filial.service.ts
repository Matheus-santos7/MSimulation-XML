import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { digitsOnly } from "../tenant/dtos/create-tenant.request.dto.js";
import type { CreateFilialRequestDTO } from "./dtos/create-filial.request.dto.js";
import type { UpdateFilialRequestDTO } from "./dtos/update-filial.request.dto.js";
import { FilialRepository } from "./filial.repository.js";
import type { FilialWriteData, TenantFilial } from "./filial.types.js";

const FILIAL_NOT_FOUND = "Filial não encontrada";

/** Filiais (estabelecimentos com CNPJ próprio) da empresa do JWT. */
@Injectable()
export class FilialService {
  constructor(@Inject(FilialRepository) private readonly filialRepository: FilialRepository) {}

  list(tenantId: string): Promise<TenantFilial[]> {
    return this.filialRepository.listByTenant(tenantId);
  }

  /** @throws {OrgError.FilialInvalid} CNPJ já cadastrado nesta empresa */
  add(tenantId: string, body: CreateFilialRequestDTO): Promise<TenantFilial> {
    return this.filialRepository.create(tenantId, toFilialCreate(body));
  }

  async update(tenantId: string, id: string, body: UpdateFilialRequestDTO): Promise<TenantFilial> {
    const row = await this.filialRepository.update(tenantId, id, toFilialUpdate(body));
    if (!row) throw new NotFoundException(FILIAL_NOT_FOUND);

    return row;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    if (!(await this.filialRepository.delete(tenantId, id))) {
      throw new NotFoundException(FILIAL_NOT_FOUND);
    }
  }
}

function toFilialCreate(body: CreateFilialRequestDTO): FilialWriteData {
  return {
    razaoSocial: body.razaoSocial,
    nomeFantasia: body.nomeFantasia,
    cnpj: digitsOnly(body.cnpj),
    ie: body.ie,
    crt: body.crt,
    logradouro: body.logradouro,
    numero: body.numero,
    complemento: body.complemento,
    bairro: body.bairro,
    codigoMunicipio: body.codigoMunicipio,
    municipio: body.municipio,
    uf: body.uf.toUpperCase(),
    cep: body.cep,
    telefone: body.telefone,
    serieRemessa: body.serieRemessa,
    serieTransferencia: body.serieTransferencia,
    unidadeLogisticaPadraoId: body.unidadeLogisticaPadraoId,
  };
}

/** Só os campos enviados; `null` limpa os opcionais (complemento, telefone, série de transferência, CD padrão). */
function toFilialUpdate(body: UpdateFilialRequestDTO): Partial<FilialWriteData> {
  return {
    ...(body.razaoSocial != null ? { razaoSocial: body.razaoSocial } : {}),
    ...(body.nomeFantasia != null ? { nomeFantasia: body.nomeFantasia } : {}),
    ...(body.cnpj != null ? { cnpj: digitsOnly(body.cnpj) } : {}),
    ...(body.ie != null ? { ie: body.ie } : {}),
    ...(body.crt != null ? { crt: body.crt } : {}),
    ...(body.logradouro != null ? { logradouro: body.logradouro } : {}),
    ...(body.numero != null ? { numero: body.numero } : {}),
    ...(body.complemento !== undefined ? { complemento: body.complemento } : {}),
    ...(body.bairro != null ? { bairro: body.bairro } : {}),
    ...(body.codigoMunicipio != null ? { codigoMunicipio: body.codigoMunicipio } : {}),
    ...(body.municipio != null ? { municipio: body.municipio } : {}),
    ...(body.uf != null ? { uf: body.uf.toUpperCase() } : {}),
    ...(body.cep != null ? { cep: body.cep } : {}),
    ...(body.telefone !== undefined ? { telefone: body.telefone } : {}),
    ...(body.serieRemessa != null ? { serieRemessa: body.serieRemessa } : {}),
    ...(body.serieTransferencia !== undefined
      ? { serieTransferencia: body.serieTransferencia }
      : {}),
    ...(body.unidadeLogisticaPadraoId !== undefined
      ? { unidadeLogisticaPadraoId: body.unidadeLogisticaPadraoId }
      : {}),
  };
}
