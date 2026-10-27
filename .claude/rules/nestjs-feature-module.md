---
paths:
  - "**/modules/**/*.ts"
---

# Feature module

Um agregado = uma pasta `src/modules/<feature>/`.

Arquivos: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`, `dtos/`, `use-cases/`, `errors/`, `test/`.

- Controller: `@Controller("<feature>")`, `@ApiTags("<feature>")` e o decorator de acesso (`@ProtectedApi()` para rota de negócio; `@AdminOnly()` por método). Injeta service e use cases. Não injeta repository.
- Verbos: `POST` insert (201), `PATCH :id` update, `GET` list, `GET :id` get, `DELETE :id`, `POST :id/disable`, `POST :id/enable`.
- Update, delete, enable e disable respondem `{ success: true }` (`SuccessResponse`).
- Listagem: `offset` default 1, `limit` default 10, teto 100, `sort` e `filter` opcionais. O controller chama `useCase.execute({ perPage, page, sort, filter })`.
- Body, params e query sempre passam pelo pipe de validação.
- O controller não trata erro: o `ApiExceptionFilter` global faz a tradução. Mapeamento específico vai em `@UseFilters(new RouteErrorFilter(...))`.
- Tenant vem de `@TenantId()` no controller ou de `getDbRequestContext()` no use case, nunca do body.
- Service `@Injectable` estende `BaseService<Entity>`, recebe o repository e chama `super(repository)`. CRUD de um agregado mora aqui. Mapeia entidade para DTO com objeto literal.
- Use case `@Injectable`, um método `execute`. Use quando o fluxo chama outro service, provider ou monta filtro Prisma. Pasta `use-cases/`, arquivo `<feature>-<ação>.usecase.ts`, classe `<Feature><Ação>UseCase`.
- Module declara `controllers`, `providers` (service, repository, use cases, providers HTTP) e `exports` só do que outro módulo importa (em geral o service). Entra em `FEATURE_MODULES` (`src/nest/app.module.ts`).
- Rota nova entra no contrato HTTP (`src/test/app.contract.spec.ts` + snapshot).

```typescript
@Module({
  controllers: [BrandController],
  providers: [BrandService, BrandRepository, BrandListUseCase],
  exports: [BrandService],
})
export class BrandModule {}
```
