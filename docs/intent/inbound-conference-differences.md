# Intent: Conferência INBOUND (POSITIVE / NEGATIVE difference)

> **STATUS: CONFIRMED** (2026-07-24)  
> Spec: [`docs/specs/inbound-conference-differences.md`](../specs/inbound-conference-differences.md) **APPROVED**  
> Decisões: reconferência permitida; allowlist POSITIVE completa.

## Restate

| | |
|---|---|
| **Outcome** | Ação opcional de **conferência** na remessa INBOUND emite NFs de diferença e ajusta FIFO |
| **User** | Operador do simulador em homologação (testar cenários ML Full) |
| **Why now** | Fatia SALE + ST fechada; falta espelhar divergência de recebimento (falta/sobra) |
| **Success** | Falta 1 → NF `INBOUND_NEGATIVE_DIFFERENCE` + FIFO −1; sobra 1 → NF `INBOUND_POSITIVE_DIFFERENCE` + FIFO +1; sem conferência = recebimento OK |
| **Constraint** | 1ª fatia = só diferenças do **INBOUND base** (não supplier / filial / outras variantes) |
| **Out of scope** | `*_FROM_SUPPLIER`, `*_FILIAL_*`, `INBOUND_RETURN` completo como processo ML, UI matriz CFOP |

## Fluxo acordado

1. Remessa INBOUND emitida → saldo FIFO = quantidade da nota.
2. Default: recebimento OK → nenhuma NF extra.
3. Ação **Conferência da remessa**: esperado × recebido por item → emite só o delta + ajusta FIFO.
4. NFs filhas referenciam a remessa pai; `xTexto` / naturezas alinhados à planilha ML.

## Mapeamento planilha

| Caso | Processo ML | Transaction Type | Natureza (planilha) | Efeito FIFO |
|------|-------------|------------------|---------------------|-------------|
| Sobra | `INBOUND_POSITIVE_DIFFERENCE` | `inbound` | Outras Saídas - Remessa para Depósito Temporário | +delta |
| Falta | `INBOUND_NEGATIVE_DIFFERENCE` | `inbound_return` | Outras Entradas - Retorno de Depósito Temporário | −delta |

## Spec

→ [`docs/specs/inbound-conference-differences.md`](../specs/inbound-conference-differences.md) (DRAFT até aprovação humana)
