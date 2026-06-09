# Serviços fiscais

```
fiscal/
├── index.ts              # Barrel público — use nas rotas
├── shared/               # Transversal: XML, timeline, settings, soft-delete
├── tax/                  # Regras, cálculo, catálogo de planilha
├── remessa/              # Remessa física + simbólica + FIFO + CT-e remessa
│   └── helpers/          # CFOP, natOp, constantes ML (remessa-dest, simbólica)
├── venda/                # Pedido, checkout, CT-e venda
│   └── chain/            # Cadeia venda → retorno simbólico
├── devolucao/
├── cancelamento/
└── inutilizacao/
```

Fluxo da remessa física: [`docs/remessa-fisica.md`](../../../docs/remessa-fisica.md).
