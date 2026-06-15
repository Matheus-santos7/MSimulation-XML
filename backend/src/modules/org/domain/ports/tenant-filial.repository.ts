import type { TenantFilial } from "../entities/tenant-filial.entity.js";

export type TenantFilialWriteData = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string | null;
  serieRemessa: number;
  serieTransferencia?: number | null;
  unidadeLogisticaPadraoId?: string | null;
};

export interface TenantFilialRepository {
  listByTenant(tenantId: string): Promise<TenantFilial[]>;
  findById(tenantId: string, id: string): Promise<TenantFilial | null>;
  create(tenantId: string, data: TenantFilialWriteData): Promise<TenantFilial>;
  update(
    tenantId: string,
    id: string,
    data: Partial<TenantFilialWriteData>,
  ): Promise<TenantFilial | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}
