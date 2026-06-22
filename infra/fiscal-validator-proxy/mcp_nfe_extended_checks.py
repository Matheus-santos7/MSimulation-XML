"""Validações incrementais do MCP fiscal-brasil sobre XML NF-e (Opção B)."""

from __future__ import annotations

from typing import Any

from catalog_helpers import (
    is_catalog_gap_error,
    is_strict_catalog_enabled,
    is_valid_cest_format,
    is_valid_ncm_format,
)
from cep_lookup import CepNotFoundError, lookup_dest_cep
from nfe_xml_context import (
    NfeValidationContext,
    issue_dict,
    item_requires_cest,
    parse_nfe_validation_context,
    resolve_tax_regime,
    expected_cfop_prefix,
    expected_cfop_tipo,
    _normalize_city,
)


def _issue_codes(issues: list[dict[str, str]]) -> set[str]:
    return {str(item.get("código") or item.get("codigo") or "") for item in issues}


def _append_issue(
    issues: list[dict[str, str]],
    severidade: str,
    codigo: str,
    descricao: str,
) -> None:
    if codigo in _issue_codes(issues):
        return
    issues.append(issue_dict(severidade, codigo, descricao))


async def _check_destination(
    issues: list[dict[str, str]],
    ctx: NfeValidationContext,
) -> None:
    from mcp_fiscal_brasil._core import FiscalValidationError
    from mcp_fiscal_brasil.ibge.tools import consultar_municipios_ibge

    if not ctx.dest_cep:
        _append_issue(
            issues,
            "alto",
            "DEST_CEP_AUSENTE",
            "Destinatário sem CEP — campo obrigatório no endereço.",
        )
        return

    try:
        endereco = await lookup_dest_cep(ctx.dest_cep)
        if ctx.uf_dest and endereco.state and ctx.uf_dest.upper() != endereco.state.upper():
            _append_issue(
                issues,
                "alto",
                "DEST_CEP_UF_DIVERGENTE",
                f"CEP {ctx.dest_cep} pertence a {endereco.state}, mas <enderDest><UF> é {ctx.uf_dest}.",
            )
        if ctx.dest_x_mun and endereco.city:
            if _normalize_city(ctx.dest_x_mun) != _normalize_city(endereco.city):
                _append_issue(
                    issues,
                    "medio",
                    "DEST_CEP_MUNICIPIO_DIVERGENTE",
                    f"CEP {ctx.dest_cep} retornou município '{endereco.city}', "
                    f"mas o XML informa '{ctx.dest_x_mun}'.",
                )
    except CepNotFoundError as exc:
        _append_issue(
            issues,
            "medio",
            "DEST_CEP_INVALIDO",
            f"CEP do destinatário inválido ou não encontrado: {exc}",
        )
    except ValueError as exc:
        _append_issue(
            issues,
            "medio",
            "DEST_CEP_INVALIDO",
            f"CEP do destinatário inválido: {exc}",
        )
    except Exception as exc:
        _append_issue(
            issues,
            "medio",
            "DEST_CEP_LOOKUP",
            f"Não foi possível consultar CEP do destinatário: {exc}",
        )

    if not ctx.dest_c_mun or not ctx.uf_dest:
        return

    try:
        municipios = await consultar_municipios_ibge(ctx.uf_dest)
        codigo_mun = int(ctx.dest_c_mun)
        municipio = next((m for m in municipios if m.id == codigo_mun), None)
        if municipio is None:
            _append_issue(
                issues,
                "alto",
                "DEST_CMUN_IBGE_INVALIDO",
                f"cMun {ctx.dest_c_mun} não pertence à UF {ctx.uf_dest} segundo o IBGE.",
            )
            return

        if ctx.dest_x_mun and _normalize_city(ctx.dest_x_mun) != _normalize_city(municipio.nome):
            _append_issue(
                issues,
                "medio",
                "DEST_CMUN_NOME_DIVERGENTE",
                f"cMun {ctx.dest_c_mun} corresponde a '{municipio.nome}', "
                f"mas o XML informa '{ctx.dest_x_mun}'.",
            )
    except ValueError:
        _append_issue(
            issues,
            "alto",
            "DEST_CMUN_FORMATO",
            f"cMun '{ctx.dest_c_mun}' inválido — esperado código IBGE numérico.",
        )
    except Exception as exc:
        _append_issue(
            issues,
            "medio",
            "DEST_CMUN_LOOKUP",
            f"Não foi possível validar cMun do destinatário no IBGE: {exc}",
        )


async def _check_item_tables(
    issues: list[dict[str, str]],
    ctx: NfeValidationContext,
) -> None:
    from mcp_fiscal_brasil._core import FiscalValidationError
    from mcp_fiscal_brasil.tabelas.tools import (
        consultar_cest,
        consultar_cfop,
        consultar_ncm,
        validar_cst_tool,
    )

    regime = resolve_tax_regime(ctx.crt)
    cfop_prefix = expected_cfop_prefix(ctx.id_dest, ctx.tp_nf)
    expected_tipo = expected_cfop_tipo(ctx.tp_nf)

    for item in ctx.itens:
        label = f"item {item.numero}" if item.numero else "item"

        if item.cfop:
            try:
                cfop_data = await consultar_cfop(item.cfop)
                if expected_tipo and cfop_data.tipo != expected_tipo:
                    tipo_label = "saída" if expected_tipo == "saida" else "entrada"
                    _append_issue(
                        issues,
                        "alto",
                        "CFOP_TIPO_INVALIDO",
                        f"{label}: CFOP {item.cfop} não é de {tipo_label} ({cfop_data.tipo}).",
                    )
                if cfop_prefix and not item.cfop.startswith(cfop_prefix):
                    _append_issue(
                        issues,
                        "alto",
                        "CFOP_IDDEST_DIVERGENTE",
                        f"{label}: CFOP {item.cfop} incompatível com idDest={ctx.id_dest} "
                        f"(esperado grupo {cfop_prefix}xxx).",
                    )
                if ctx.uf_emit and ctx.uf_dest:
                    if ctx.uf_emit == ctx.uf_dest and cfop_data.aplicacao == "interestadual":
                        _append_issue(
                            issues,
                            "alto",
                            "CFOP_APLICACAO_ESTADUAL",
                            f"{label}: CFOP {item.cfop} é interestadual, mas emitente e destinatário "
                            f"estão na mesma UF ({ctx.uf_emit}).",
                        )
                    if ctx.uf_emit != ctx.uf_dest and cfop_data.aplicacao == "estadual":
                        _append_issue(
                            issues,
                            "alto",
                            "CFOP_APLICACAO_INTERESTADUAL",
                            f"{label}: CFOP {item.cfop} é estadual, mas a operação é "
                            f"{ctx.uf_emit}→{ctx.uf_dest}.",
                        )
            except FiscalValidationError as exc:
                _append_issue(
                    issues,
                    "alto",
                    "CFOP_INVALIDO",
                    f"{label}: CFOP {item.cfop} inválido ou ausente na tabela MCP: {exc}",
                )

        if item.ncm:
            if not is_valid_ncm_format(item.ncm):
                _append_issue(
                    issues,
                    "alto",
                    "NCM_FORMATO",
                    f"{label}: NCM '{item.ncm}' inválido — informe 8 dígitos numéricos.",
                )
            else:
                try:
                    await consultar_ncm(item.ncm)
                except FiscalValidationError as exc:
                    if is_strict_catalog_enabled() or not is_catalog_gap_error(exc):
                        _append_issue(
                            issues,
                            "alto",
                            "NCM_INVALIDO",
                            f"{label}: NCM {item.ncm} inválido ou não encontrado: {exc}",
                        )

        tax_code = item.csosn if regime == "simples" and item.csosn else item.cst_icms
        if tax_code:
            cst_param = tax_code.zfill(3)
            try:
                cst_data = await validar_cst_tool(cst_param, regime)
                if not cst_data.valido:
                    _append_issue(
                        issues,
                        "alto",
                        "CST_INVALIDO",
                        f"{label}: código tributário '{tax_code}' inválido para regime "
                        f"'{regime}' (CRT={ctx.crt or 'n/d'}).",
                    )
            except FiscalValidationError as exc:
                _append_issue(
                    issues,
                    "alto",
                    "CST_VALIDACAO",
                    f"{label}: falha ao validar CST/CSOSN '{tax_code}': {exc}",
                )

        if item_requires_cest(item, regime):
            if not item.cest:
                _append_issue(
                    issues,
                    "alto",
                    "CEST_OBRIGATORIO",
                    f"{label}: CST/CSOSN de ST exige <CEST> preenchido.",
                )
            elif not is_valid_cest_format(item.cest):
                _append_issue(
                    issues,
                    "alto",
                    "CEST_FORMATO",
                    f"{label}: CEST '{item.cest}' inválido — informe 7 dígitos numéricos.",
                )
            else:
                try:
                    await consultar_cest(item.cest)
                except FiscalValidationError as exc:
                    if is_strict_catalog_enabled() or not is_catalog_gap_error(exc):
                        _append_issue(
                            issues,
                            "alto",
                            "CEST_INVALIDO",
                            f"{label}: CEST {item.cest} inválido ou não encontrado: {exc}",
                        )
        elif item.cest and not is_valid_cest_format(item.cest):
            _append_issue(
                issues,
                "medio",
                "CEST_FORMATO",
                f"{label}: CEST opcional '{item.cest}' com formato inválido (esperado 7 dígitos).",
            )


async def run_mcp_extended_checks(xml_content: str) -> list[dict[str, str]]:
    """
    Executa validações incrementais do MCP sobre o XML.

    @param xml_content - XML completo da NF-e
    """
    ctx = parse_nfe_validation_context(xml_content)
    if ctx is None:
        return [
            issue_dict(
                "critico",
                "XML_CONTEXT_PARSE",
                "Não foi possível extrair contexto fiscal do XML para validações MCP.",
            )
        ]

    issues: list[dict[str, str]] = []
    await _check_item_tables(issues, ctx)
    await _check_destination(issues, ctx)
    return issues


async def apply_mcp_extended_checks(
    payload: dict[str, Any],
    xml_content: str,
) -> dict[str, Any]:
    """Anexa issues MCP incrementais ao payload cru de validate_nfe_full."""
    from validate_nfe_full_response import finalize_validate_nfe_full_payload

    if not payload.get("valida_estruturalmente"):
        return payload

    extra_issues = await run_mcp_extended_checks(xml_content)
    merged = list(payload.get("issues") or [])
    known = _issue_codes(merged)
    for issue in extra_issues:
        code = str(issue.get("código") or issue.get("codigo") or "")
        if code and code not in known:
            merged.append(issue)
            known.add(code)

    payload["issues"] = merged
    return finalize_validate_nfe_full_payload(payload)
