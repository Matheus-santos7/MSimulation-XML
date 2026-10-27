---
paths:
  - "backend/**/*.ts"
  - "packages/**/*.ts"
---

# TypeScript e formatação

O `.prettierrc` da raiz é a fonte: aspas duplas, ponto e vírgula, vírgula final sempre, `printWidth` 100, `arrowParens` padrão (`(x) => ...`). Rode o Prettier só nos arquivos que você tocou.

- Linha em branco antes de `return`. Linha em branco entre um bloco `const`/`let` e o código seguinte. Sem linhas vazias duplicadas.
- ESM com `NodeNext`: import relativo termina em `.js` (`./brand.repository.js`). Não há alias `@/`.
- Imports: pacotes externos, depois `@nestjs/*` e `@msimulation-xml/*`, depois relativos. `import type` para o que é só tipo.
- `strict: true`, `experimentalDecorators: true`. Campo obrigatório de classe usa `!`, opcional usa `?`.
- `unknown` em `catch` e em dado externo; estreite antes de usar. Evite `any`.
- Número com significado vira constante nomeada (`HTTP_NOT_FOUND`, `MAX_PAGE_SIZE`).
- Sem mutação de argumento: devolva objeto novo (`{ ...entity, name }`).
- `rules/` e `types/` não importam `@nestjs/*` nem `fastify` (dependency-cruiser e `src/test/architecture.spec.ts`).
- Log de runtime usa `Logger` do Nest ou `request.log`. `console.log` não.

```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { BrandEntity } from "../../entities/brand.entity.js";
import { BrandRepository } from "./brand.repository.js";

@Injectable()
export class BrandService {
  constructor(@Inject(BrandRepository) private readonly brandRepository: BrandRepository) {}

  async get(id: string, tenantId: string): Promise<BrandEntity | null> {
    const entity = await this.brandRepository.getById(id, tenantId);

    return entity;
  }
}
```

`@Inject(...)` explícito é obrigatório enquanto dev e testes rodam com `tsx` (sem `emitDecoratorMetadata`). Com SWC na fundação, a injeção por tipo passa a funcionar e o `@Inject` vira opcional.
