"""Serialização do retorno cru de `validate_nfe_full` (mcp-fiscal-brasil)."""

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
