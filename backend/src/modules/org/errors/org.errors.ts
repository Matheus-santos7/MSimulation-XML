import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";

/** Erros das rotas de empresa, filial e usuários. O filtro responde `{ error: message }`. */
export namespace OrgError {
  /** CNPJ da empresa já cadastrado (409). */
  export class TenantConflict extends ConflictException {}

  /** Dado de filial ou papel fiscal inválido (400). */
  export class FilialInvalid extends BadRequestException {}

  /** E-mail de usuário já cadastrado (409). */
  export class MemberConflict extends ConflictException {}

  /** Operação proibida sobre usuário (auto-exclusão, último usuário) (403). */
  export class MemberForbidden extends ForbiddenException {}
}
