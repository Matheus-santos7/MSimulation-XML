---
paths:
  - "**/dtos/**/*.ts"
---

# DTOs

Um arquivo por DTO em `<feature>/dtos/`, com o schema Zod e o tipo inferido dele. Decisão de 2026-10-22: Zod no lugar do `class-validator` do padrão Nérus, porque as mensagens de validação (que o frontend mostra) já são as do Zod.

| Papel | Schema | Tipo | Arquivo |
|---|---|---|---|
| Criação | `create<X>RequestSchema` | `Create<X>RequestDTO` | `create-<x>.request.dto.ts` |
| Atualização | `update<X>RequestSchema` | `Update<X>RequestDTO` | `update-<x>.request.dto.ts` |
| Query de lista | `filter<X>QuerySchema` | `Filter<X>QueryDTO` | `filter-<x>.query.dto.ts` |
| Parâmetro de rota | `<x>ParamsSchema` | `<X>ParamsDTO` | `<x>.params.dto.ts` |
| Resposta | — | `<X>ResponseDTO` (type) | `<x>.response.dto.ts` |

```ts
import { z } from "zod";

export const createBrandRequestSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(100),
  enabled: z.boolean().default(true),
});

export type CreateBrandRequestDTO = z.infer<typeof createBrandRequestSchema>;
```

- Controller valida com `@Body(new ZodValidationPipe(createBrandRequestSchema)) body: CreateBrandRequestDTO`. Erro sai como `{ error, details }` (`details` = `fieldErrors` do Zod); com `{ invalidMessage }`, `{ error: invalidMessage, details: flatten() }`.
- Mensagem de regra em português. As mensagens padrão do Zod em inglês (`Required`, `Expected string...`) já fazem parte do contrato: não troque sem atualizar o frontend.
- Campo reaproveitado por vários DTOs vira constante exportada (`emailField`, `passwordField` em `auth/rules/credential.schemas.ts`).
- Paginação: `paginationQuerySchema` + `toPaginationParams` (`src/nest/base/pagination.ts`), teto de 100 itens.
- DTO não importa repository nem entity para executar regra.
