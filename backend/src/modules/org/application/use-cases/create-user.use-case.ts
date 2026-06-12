import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { CreateUserCommand } from "../dto/create-user.command.js";

/**
 * Convida/cria utilizador MEMBER no tenant (ação ADMIN).
 *
 * Hash de senha via bcrypt; e-mail deve ser único globalmente.
 *
 * @param tenantId - Tenant do administrador autenticado
 * @param command - E-mail, nome e senha inicial
 * @returns Utilizador criado (sem dados sensíveis)
 * @throws {UserConflictError} E-mail já cadastrado
 */
export class CreateUserUseCase {
  constructor(
    private readonly orgUserRepository: OrgUserRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(tenantId: string, command: CreateUserCommand): Promise<OrgUser> {
    return this.orgUserRepository.create(tenantId, {
      email: command.email,
      name: command.name,
      passwordHash: await this.passwordHasher.hash(command.password),
    });
  }
}
