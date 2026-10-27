---
paths:
  - "backend/**/*.ts"
---

# Erros

- Validação de entrada para no `ZodValidationPipe` (schema do DTO). Não revalide o mesmo campo no service.
- Regra de negócio violada: `throw new BusinessException(message)` (`src/nest/http/`) em código novo; os contextos atuais usam o erro nomeado do próprio `errors/`, mapeado no filtro de rota (ver seção 12 do `ARCHITECTURE.md`). Marketplace sem perfil fiscal: `MarketplaceNotConfiguredError` (422 no filtro global).
- Recurso ausente, conflito, permissão: `NotFoundException`, `ConflictException`, `ForbiddenException` do Nest, ou `HttpError(status, message)` nos módulos atuais.
- Não use `throw new Error(...)` para regra de negócio: sem status, o `ApiExceptionFilter` responde 500.
- O controller não precisa de `.catch`: o `ApiExceptionFilter` global traduz para `{ error }` (Zod 400 com `details`, banco indisponível 503, Prisma `P2002` 409, `P2025` 404, resto 500 sem stack). Tradução específica de um módulo vai num `RouteErrorFilter` com `mappings`, aplicado com `@UseFilters`.
- Erro reutilizado em vários pontos do módulo pode virar classe nomeada em `modules/<feature>/errors/<feature>.error.ts`, dentro de `namespace <Feature>Error`, estendendo exceção HTTP do Nest.
- Mensagem em português, começando com maiúscula (`"Produto não encontrado"`): o frontend mostra o texto ao usuário. Não exponha SQL, stack, id interno nem dado de outro tenant.
- Provider HTTP externo: registre `error.message` no log e lance `BusinessException` (ou `HttpError(502, ...)`) com mensagem para o usuário.
- Log com `Logger` do Nest ou `request.log` (pino). `console.log` não.
- `catch` vazio é proibido.

```typescript
if (!pedido.notaFiscalId) {
  throw new BusinessException("Pedido sem nota fiscal para integrar");
}
```

```typescript
export namespace ProductError {
  export class NotFoundError extends NotFoundException {
    constructor() {
      super("Produto não encontrado");
    }
  }
}
```
