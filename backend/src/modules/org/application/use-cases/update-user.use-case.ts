import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { UpdateUserCommand } from "../dto/update-user.command.js";

/**
 * Atualiza e-mail, nome ou senha de um utilizador do tenant (ação ADMIN).
 *
 * Alteração de senha incrementa `tokenVersion` e revoga sessões ativas no repository.
 *
 * @param id - UUID do utilizador alvo
 * @param tenantId - Tenant do administrador (filtro de isolamento)
 * @param command - Campos parciais a alterar
 * @returns Utilizador atualizado ou `null` se não existir neste tenant
 * @throws {UserConflictError} E-mail duplicado
 */
export class UpdateUserUseCase {
  constructor(
    private readonly orgUserRepository: OrgUserRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(id: string, tenantId: string, command: UpdateUserCommand): Promise<OrgUser | null> {
    const existing = await this.orgUserRepository.findById(id, tenantId);
    if (!existing) return null;

    const passwordHash =
      command.password !== undefined ? await this.passwordHasher.hash(command.password) : undefined;

    return this.orgUserRepository.update(id, {
      ...(command.email !== undefined ? { email: command.email } : {}),
      ...(command.name !== undefined ? { name: command.name ?? null } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    });
  }
}
