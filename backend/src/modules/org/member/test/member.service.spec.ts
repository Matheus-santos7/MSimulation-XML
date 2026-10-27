import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgError } from "../../errors/org.errors.js";
import type { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import type { MemberRepository } from "../member.repository.js";
import { MemberService } from "../member.service.js";
import type { OrgUser } from "../member.types.js";

const member: OrgUser = {
  id: "user-2",
  tenantId: "tenant-1",
  email: "bia@example.com",
  role: "MEMBER",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MemberService", () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let service: MemberService;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue(member),
      countByTenant: vi.fn().mockResolvedValue(2),
      delete: vi.fn(),
      update: vi.fn().mockResolvedValue({ ...member, name: "Bia" }),
      create: vi.fn().mockResolvedValue(member),
    };
    service = new MemberService(
      repository as unknown as MemberRepository,
      { hash: vi.fn().mockResolvedValue("scrypt$hash") } as unknown as PasswordHasherProvider,
    );
  });

  it("should delete a member of the tenant", async () => {
    // Act
    await service.delete("user-2", "tenant-1", "user-1");

    // Assert
    expect(repository.findById).toHaveBeenCalledWith("user-2", "tenant-1");
    expect(repository.delete).toHaveBeenCalledWith("user-2");
  });

  it("should not let the user delete itself", async () => {
    // Act / Assert
    await expect(service.delete("user-2", "tenant-1", "user-2")).rejects.toThrow(
      new OrgError.MemberForbidden("Não é possível excluir o usuário logado"),
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("should keep at least one user in the tenant", async () => {
    // Arrange
    repository.countByTenant.mockResolvedValue(1);

    // Act / Assert
    await expect(service.delete("user-2", "tenant-1", "user-1")).rejects.toThrow(
      new OrgError.MemberForbidden("A empresa precisa ter ao menos um usuário"),
    );
  });

  it("should answer 404 for a user of another tenant", async () => {
    // Arrange
    repository.findById.mockResolvedValue(null);

    // Act / Assert
    await expect(service.get("user-9", "tenant-1")).rejects.toThrow(
      new NotFoundException("Usuário não encontrado"),
    );
    await expect(service.update("user-9", "tenant-1", { name: "X" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should hash the new password and send only the informed fields", async () => {
    // Act
    await service.update("user-2", "tenant-1", { password: "SenhaForte1" });

    // Assert
    expect(repository.update).toHaveBeenCalledWith("user-2", { passwordHash: "scrypt$hash" });
  });
});
