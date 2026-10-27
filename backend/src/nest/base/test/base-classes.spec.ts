import "reflect-metadata";
import { NotFoundException } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { ApiExceptionFilter } from "../../http/api-exception.filter.js";
import { BusinessException } from "../../http/business.exception.js";
import { BaseRepository } from "../base.repository.js";
import { BaseService } from "../base.service.js";
import { MAX_PAGE_SIZE, paginationQuerySchema, toPaginationParams } from "../pagination.js";
import { TenantIdEntity } from "../tenant-id.entity.js";

class BrandEntity extends TenantIdEntity {
  name!: string;

  static restore(row: unknown): BrandEntity {
    return Object.assign(new BrandEntity(), row);
  }
}

type BrandRow = { id: string; tenantId: string; name: string };

class FakeBrandRepository extends BaseRepository<BrandEntity> {
  constructor(private readonly rows: BrandRow[]) {
    super();
  }

  async getById(id: string, tenantId: string): Promise<BrandEntity | null> {
    const row = this.rows.find((r) => r.id === id && r.tenantId === tenantId);

    return row ? BrandEntity.restore(row) : null;
  }

  list(page: number, perPage: number) {
    return this.paginate(
      { page, perPage },
      {
        count: async () => this.rows.length,
        findMany: async ({ skip, take }) => this.rows.slice(skip, skip + take),
        restore: BrandEntity.restore,
      },
    );
  }
}

class BrandService extends BaseService<BrandEntity> {
  protected readonly notFoundMessage = "Marca não encontrada";
}

const rows: BrandRow[] = [
  { id: "b1", tenantId: "t1", name: "A" },
  { id: "b2", tenantId: "t1", name: "B" },
  { id: "b3", tenantId: "t1", name: "C" },
];

describe("BaseRepository", () => {
  it("should paginate with skip/take from page and perPage and restore each row", async () => {
    // Arrange
    const repository = new FakeBrandRepository(rows);

    // Act
    const result = await repository.list(2, 2);

    // Assert
    expect(result).toEqual({
      data: [BrandEntity.restore(rows[2])],
      total: 3,
      page: 2,
      perPage: 2,
      totalPages: 2,
    });
    expect(result.data[0]).toBeInstanceOf(BrandEntity);
  });
});

describe("BaseService", () => {
  it("should return the entity of the tenant", async () => {
    // Arrange
    const service = new BrandService(new FakeBrandRepository(rows));

    // Act
    const entity = await service.getOrFail("b1", "t1");

    // Assert
    expect(entity.name).toBe("A");
  });

  it("should throw NotFoundException with the service message when the entity is missing", async () => {
    // Arrange
    const service = new BrandService(new FakeBrandRepository(rows));

    // Act
    const result = service.getOrFail("b1", "outro-tenant");

    // Assert
    await expect(result).rejects.toThrow(NotFoundException);
    await expect(result).rejects.toThrow("Marca não encontrada");
  });
});

describe("BusinessException", () => {
  it("should be answered by the global filter as 422 { error }", () => {
    // Arrange
    const filter = new ApiExceptionFilter();
    const send = vi.fn();
    const reply = { sent: false, status: vi.fn().mockReturnValue({ send }) };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ log: {} as FastifyBaseLogger }),
        getResponse: () => reply,
      }),
    };

    // Act
    filter.catch(
      new BusinessException("Marketplace ainda não configurado para faturamento"),
      host as never,
    );

    // Assert
    expect(reply.status).toHaveBeenCalledWith(422);
    expect(send).toHaveBeenCalledWith({
      error: "Marketplace ainda não configurado para faturamento",
    });
  });

  it("should accept another status", () => {
    expect(new BusinessException("Conflito", 409).getStatus()).toBe(409);
  });
});

describe("paginationQuerySchema", () => {
  const pipe = { transform: (value: unknown) => paginationQuerySchema.parse(value) };

  it("should default to page 1 and 10 items", () => {
    expect(toPaginationParams(pipe.transform({}))).toEqual({ page: 1, perPage: 10 });
  });

  it("should convert query strings and cap the page size", () => {
    expect(toPaginationParams(pipe.transform({ offset: "3", limit: "500", sort: "name" }))).toEqual(
      {
        page: 3,
        perPage: MAX_PAGE_SIZE,
        sort: "name",
      },
    );
  });

  it("should reject a page lower than 1", () => {
    expect(() => pipe.transform({ offset: "0" })).toThrow("A página mínima é 1");
  });
});
