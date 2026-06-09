# Camada de serviços (`backend/src/services`)

Organização por **domínio de negócio**. Cada domínio expõe um `index.ts` com a API pública; rotas importam preferencialmente desse barrel.

## Estrutura

```
services/
├── auth/                 # Autenticação e conta
│   ├── auth-service.ts   # Login, registro, sessão
│   ├── email/            # Envio e verificação de e-mail, reset de senha
│   └── mfa/              # 2FA (TOTP)
├── catalog/              # Produtos
├── fiscal/               # Documentos fiscais (ver fiscal/README.md)
├── logistics/            # CDs ML, movimentações, avanço entre CDs
├── lookup/               # CEP e consultas auxiliares
└── org/                  # Tenants e usuários
```

## Fiscal (resumo)

| Pasta | Responsabilidade |
|-------|------------------|
| `fiscal/shared/` | NF-e XML, timeline, settings, soft-delete |
| `fiscal/tax/` | Regras tributárias, cálculo, catálogo |
| `fiscal/remessa/` | NF-e remessa física, simbólica, FIFO, CT-e remessa |
| `fiscal/remessa/helpers/` | CFOP, constantes ML, destinos |
| `fiscal/venda/` | Pedido, checkout, cadeia venda/retorno, CT-e venda |
| `fiscal/venda/chain/` | Passos da cadeia de venda |
| `fiscal/devolucao/` | NF-e devolução |
| `fiscal/cancelamento/` | Evento cancelamento |
| `fiscal/inutilizacao/` | Inutilização de numeração |

Documentação detalhada da remessa: [`docs/remessa-fisica.md`](../../docs/remessa-fisica.md).

## Convenções

- **`lib/`** — infraestrutura compartilhada (mappers, chave NF-e, tax-engine, HTTP).
- **`services/*/helpers/`** — constantes e funções puras do domínio, sem Prisma.
- Import externo: `from "../../services/fiscal/index.js"` (ou domínio equivalente).
