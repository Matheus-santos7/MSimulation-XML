# Fiscal + Clean Architecture Checklist (msedit-xml)

Use este checklist nos stages **bugbot** e **code-reviewer** quando o diff tocar backend fiscal, XML, impostos ou frontend com lógica de domínio.

## Clean Architecture / DDD

- [ ] `domain/` não importa Fastify, Prisma nem libs externas
- [ ] `application/` importa apenas `domain/`
- [ ] Prisma existe somente em `infrastructure/prisma/`
- [ ] Controllers em `presentation/` são burros: HTTP in → use case → HTTP out
- [ ] Regra de negócio não vive em routes/services legados (`src/routes`, `src/services`)
- [ ] Nomes de arquivos em `kebab-case` com sufixo de camada (`*.use-case.ts`, `*.controller.ts`)

## XML (regra 04-refactory-xml)

- [ ] XML montado como objeto JS/TS puro; serialização só no final
- [ ] Proibido template strings para tags (`<tag>${valor}</tag>`)
- [ ] Funções pequenas por node (`buildIde`, `buildDest`, etc.)
- [ ] Cálculo de impostos em resolvers isolados, não no builder XML

## Matemática fiscal (MOC / rejeições SEFAZ)

- [ ] Valores por item arredondados comercialmente para 2 casas **antes** de somar totais
- [ ] Bloco `<total>` é reduce dos itens já arredondados (não recalcular imposto no total)
- [ ] `vNF = vProd - vDesc + vOutro + vSeg + vFrete + vST + vIPI + vII`
- [ ] Se `vBC` ou alíquota zerada → valor do imposto zerado (não gerar `vICMS` > 0)
- [ ] FCP em tags exclusivas (`pFCP`, `vFCP`); nunca embutido em `pICMS`
- [ ] CST/CSOSN coerente com regime tributário e CFOP
- [ ] DIFAL obrigatório: interestadual (CFOP 6xxx) + `indFinal=1` + `indIEDest=9`
- [ ] Devoluções: espelhar nota origem; IPI devolvido em `vIPIDevol`

## Frontend thin client

- [ ] Frontend não importa `xlsx` nem faz parse de planilhas
- [ ] Frontend não monta/assina XML
- [ ] Frontend não chama APIs externas (ViaCEP, SEFAZ, ML) direto — só `/api/...`
- [ ] Validações de domínio vêm da API (`domain-errors`), não inventadas no browser

## Severidade sugerida

| Finding | Severidade |
|---------|------------|
| Math fiscal errado que gera rejeição SEFAZ | Critical |
| Template string XML / layer violation grave | Critical |
| Test gap em resolver fiscal | Important |
| Controller com if/else de negócio | Important |
| Naming/style | Minor |
