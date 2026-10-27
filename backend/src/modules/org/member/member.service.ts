import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { OrgError } from "../errors/org.errors.js";
import { PasswordHasherProvider } from "../providers/password-hasher.provider.js";
import type { CreateMemberRequestDTO } from "./dtos/create-member.request.dto.js";
import type { UpdateMemberRequestDTO } from "./dtos/update-member.request.dto.js";
import { MemberRepository } from "./member.repository.js";
import type { OrgUser } from "./member.types.js";

const USER_NOT_FOUND = "Usuário não encontrado";

/**
 * Usuários da empresa do JWT. Leitura: qualquer membro; criação, edição e exclusão: ADMIN
 * (controlado no controller). Usuário de outra empresa responde 404.
 */
@Injectable()
export class MemberService {
  constructor(
    @Inject(MemberRepository) private readonly memberRepository: MemberRepository,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
  ) {}

  list(tenantId: string): Promise<OrgUser[]> {
    return this.memberRepository.listByTenant(tenantId);
  }

  async get(id: string, tenantId: string): Promise<OrgUser> {
    return this.orNotFound(await this.memberRepository.findById(id, tenantId));
  }

  /** Novo usuário MEMBER. @throws {OrgError.MemberConflict} E-mail já cadastrado */
  async create(tenantId: string, command: CreateMemberRequestDTO): Promise<OrgUser> {
    return this.memberRepository.create(tenantId, {
      email: command.email,
      name: command.name,
      passwordHash: await this.passwordHasher.hash(command.password),
    });
  }

  /**
   * Atualiza e-mail, nome ou senha. Trocar a senha incrementa `tokenVersion` e revoga as sessões.
   * @throws {OrgError.MemberConflict} E-mail já cadastrado
   */
  async update(id: string, tenantId: string, command: UpdateMemberRequestDTO): Promise<OrgUser> {
    this.orNotFound(await this.memberRepository.findById(id, tenantId));

    const passwordHash =
      command.password !== undefined ? await this.passwordHasher.hash(command.password) : undefined;

    return this.orNotFound(
      await this.memberRepository.update(id, {
        ...(command.email !== undefined ? { email: command.email } : {}),
        ...(command.name !== undefined ? { name: command.name ?? null } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
      }),
    );
  }

  /**
   * Remove o usuário. Não permite excluir o próprio usuário nem o último da empresa.
   * @throws {OrgError.MemberForbidden}
   */
  async delete(id: string, tenantId: string, currentUserId: string): Promise<void> {
    const existing = this.orNotFound(await this.memberRepository.findById(id, tenantId));
    if (existing.id === currentUserId) {
      throw new OrgError.MemberForbidden("Não é possível excluir o usuário logado");
    }

    const userCount = await this.memberRepository.countByTenant(tenantId);
    if (userCount <= 1) {
      throw new OrgError.MemberForbidden("A empresa precisa ter ao menos um usuário");
    }

    await this.memberRepository.delete(id);
  }

  private orNotFound<T>(value: T | null): T {
    if (value == null) throw new NotFoundException(USER_NOT_FOUND);

    return value;
  }
}
