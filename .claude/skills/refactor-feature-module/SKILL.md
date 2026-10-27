---
name: refactor-feature-module
description: Transforms legacy backend code into a NestJS feature module matching this microservices architecture (controller, BaseService, use case, DTOs, module). Use when refactoring a legacy endpoint, service, or component into the Nerus module pattern, or when the user asks to replicate this project's module structure.
---

# Refatorar para feature module

Leia `.claude/ARCHITECTURE.md` e as rules `nestjs-feature-module`, `dto-and-validation`, `domain-entity`, `error-handling`.

A unidade é o contexto em `backend/src/modules/<contexto>/`, com uma pasta por feature. Rode o contrato HTTP (`src/test/app.contract.spec.ts`) antes e depois: a refatoração não muda status nem corpo de resposta.

## Passos

1. Nomeie a feature no singular e em kebab-case (`product-price`, `brand`).
2. Separe o legado:
   - HTTP e status code → controller
   - CRUD de um agregado e mapeamento para DTO → service
   - Fluxo que chama outro service ou API → `use-cases/<feature>-<ação>.usecase.ts` com `execute`
   - SQL/ORM → repository (subagente `nerus-data` / skill `migrate-database-layer`)
   - `process.env` → getter em `ConfigService`
3. Crie os arquivos nesta ordem: entity (se ainda não existe), DTOs, repository, service, use case, errors, controller, module.
4. Controller usa `@ApiTags`, o decorator de acesso (`@ProtectedApi()`, `@AdminOnly()`) e o pipe de validação no body. Erro sobe para o `ApiExceptionFilter`; mapeamento específico em `RouteErrorFilter`.
5. Service estende `BaseService<Entity>` e chama `super(repository)`. Insert faz `Entity.create` e devolve objeto literal no formato do response DTO.
6. Liste com `offset` (página, default 1), `limit` (default 10, máximo 100), `sort`, `filter`.
7. Update, delete, enable e disable devolvem `{ success: true }`.
8. Regra de negócio violada no service ou use case: `throw new BusinessException("...")`, mensagem em português. Nunca `throw new Error`.
9. Registre tudo no `@Module` e o módulo em `FEATURE_MODULES`. Exporte só o service (e use cases que outro módulo chama).
10. Outro módulo é usado pelo provider que ele exporta, nunca importando o repository dele. API externa vira provider HTTP.

## Controller mínimo

```typescript
@Controller("brand")
@ApiTags("brand")
@ProtectedApi()
export class BrandController {
  constructor(
    @Inject(BrandService) private readonly brandService: BrandService,
    @Inject(BrandListUseCase) private readonly brandListUseCase: BrandListUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  insert(@Body(new ZodValidationPipe(createBrandRequestSchema)) data: CreateBrandRequestDTO, @TenantId() tenantId: string) {
    return this.brandService.insert(data, tenantId);
  }
}
```

## O que não trazer do legado

- Repository injetado no controller.
- Regra de negócio dentro do controller.
- Tabela com `tenant_id` sem RLS, ou query fora de `getDbClient()` dentro da request.
- Pasta `domain/` ou `infrastructure/` nova num módulo no padrão novo.
- Tenant lido do body.
