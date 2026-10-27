import { NotFoundException } from "@nestjs/common";
import type { BaseRepository } from "./base.repository.js";

/** Base dos services de CRUD de um agregado. */
export abstract class BaseService<TEntity> {
  /** Mensagem do 404 quando o agregado não existe para o tenant (em português). */
  protected abstract readonly notFoundMessage: string;

  constructor(protected readonly repository: BaseRepository<TEntity>) {}

  async getOrFail(id: string, tenantId: string): Promise<TEntity> {
    const entity = await this.repository.getById(id, tenantId);
    if (!entity) throw new NotFoundException(this.notFoundMessage);

    return entity;
  }
}
