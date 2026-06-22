"""Serialização e correção do retorno cru de `validate_nfe_full` (mcp-fiscal-brasil)."""

from __future__ import annotations

from typing import Any


def serialize_validate_nfe_full_report(report: Any) -> dict[str, Any]:
    """
    Converte o dataclass retornado por `validate_nfe_full` em JSON pass-through.

    @param report - Objeto retornado por mcp_fiscal_brasil.agentic.validate_nfe_full
    """
    issues: list[dict[str, str]] = []
    for issue in getattr(report, "issues", []) or []:
        issues.append(
            {
                "severidade": str(getattr(issue, "severidade", "")),
                "código": str(getattr(issue, "código", getattr(issue, "codigo", ""))),
                "descrição": str(getattr(issue, "descrição", getattr(issue, "descricao", ""))),
            }
        )

    payload: dict[str, Any] = {
        "chave_acesso": str(getattr(report, "chave_acesso", "") or ""),
        "valida_estruturalmente": bool(getattr(report, "valida_estruturalmente", False)),
        "chave_consistente": bool(getattr(report, "chave_consistente", False)),
        "emissor_ativo": bool(getattr(report, "emissor_ativo", False)),
        "issues": issues,
        "resumo": str(getattr(report, "resumo", "") or ""),
    }

    cnpj_emissor = getattr(report, "cnpj_emissor", None)
    if cnpj_emissor is not None:
        payload["cnpj_emissor"] = str(cnpj_emissor)

    valor_total = getattr(report, "valor_total", None)
    if valor_total is not None:
        payload["valor_total"] = float(valor_total)

    data_emissao = getattr(report, "data_emissao", None)
    if data_emissao is not None:
        payload["data_emissao"] = str(data_emissao)

    return payload


def _issue_codigo(issue: dict[str, str]) -> str:
    return str(issue.get("código") or issue.get("codigo") or "")


def _rebuild_resumo(payload: dict[str, Any], chave: str) -> None:
    issues = payload.get("issues", [])
    if payload.get("valida_estruturalmente") and not issues:
        payload["resumo"] = (
            f"NFe válida estruturalmente, chave {chave} consistente, emissor ativo."
        )
    elif payload.get("valida_estruturalmente") and issues:
        payload["resumo"] = (
            f"NFe parseou ok mas tem {len(issues)} issue(s) ({_issue_codigo(issues[0])})."
        )


async def enrich_validate_nfe_full_payload(
    payload: dict[str, Any],
    xml_content: str,
) -> dict[str, Any]:
    """
    Corrige lacunas do mcp-fiscal-brasil <=0.5.1 em `validate_nfe_full`.

    O MCP chama `parse_nfe_xml(..., chave="")` e não preenche `chave_acesso`
    a partir do atributo `Id` do infNFe. Em 0.4.0 também consulta `válida`
    em vez de `válido` no retorno de `validar_chave_nfe`.
    """
    from mcp_fiscal_brasil.nfe.tools import validar_chave_nfe
    from mcp_fiscal_brasil.nfe.xml_parser import extrair_chave_nfe

    chave = str(payload.get("chave_acesso") or "").strip()
    if not chave:
        extracted = extrair_chave_nfe(xml_content)
        if extracted:
            chave = extracted
            payload["chave_acesso"] = chave

    if not chave:
        _rebuild_resumo(payload, chave)
        return payload

    try:
        chave_result = await validar_chave_nfe(chave)
        chave_consistente = bool(
            chave_result.get("válido", chave_result.get("válida", False)),
        )
        payload["chave_consistente"] = chave_consistente

        issues: list[dict[str, str]] = list(payload.get("issues") or [])
        codigos = {_issue_codigo(issue) for issue in issues}

        if not chave_consistente and "CHAVE_INVALIDA" not in codigos:
            issues.append(
                {
                    "severidade": "alto",
                    "código": "CHAVE_INVALIDA",
                    "descrição": "Digito verificador da chave de acesso não confere.",
                }
            )
        elif chave_consistente:
            issues = [
                issue
                for issue in issues
                if _issue_codigo(issue) not in {"CHAVE_INVALIDA", "CHAVE_VALIDACAO_FALHOU"}
            ]

        payload["issues"] = issues
    except Exception as exc:
        issues = list(payload.get("issues") or [])
        codigos = {_issue_codigo(issue) for issue in issues}
        if "CHAVE_VALIDACAO_FALHOU" not in codigos:
            issues.append(
                {
                    "severidade": "medio",
                    "código": "CHAVE_VALIDACAO_FALHOU",
                    "descrição": f"Não foi possivel validar chave: {exc}",
                }
            )
        payload["issues"] = issues

    _rebuild_resumo(payload, chave)
    return payload
