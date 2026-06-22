"""Testes do parser de contexto fiscal para validações MCP."""

from __future__ import annotations

from pathlib import Path

from nfe_xml_context import (
    expected_cfop_prefix,
    expected_cfop_tipo,
    item_requires_cest,
    parse_nfe_validation_context,
    resolve_tax_regime,
    _normalize_city,
)

PROJECT_XML = Path(__file__).resolve().parents[2].joinpath("xml.xml")


def test_parse_nfe_validation_context_from_project_xml() -> None:
    if not PROJECT_XML.exists():
        return

    ctx = parse_nfe_validation_context(PROJECT_XML.read_text(encoding="utf-8"))
    assert ctx is not None
    assert ctx.tp_nf == "1"
    assert ctx.crt == "3"
    assert ctx.id_dest == "1"
    assert ctx.uf_emit == "SP"
    assert ctx.uf_dest == "SC"
    assert ctx.dest_c_mun == "4205407"
    assert len(ctx.itens) == 1
    assert ctx.itens[0].cfop == "5105"
    assert ctx.itens[0].ncm == "85094010"
    assert ctx.itens[0].cest == "2104100"
    assert ctx.itens[0].cst_icms == "00"


def test_resolve_tax_regime_and_cfop_prefix() -> None:
    assert resolve_tax_regime("3") == "normal"
    assert resolve_tax_regime("1") == "simples"
    assert expected_cfop_prefix("2") == "6"
    assert expected_cfop_prefix("2", "0") == "2"
    assert expected_cfop_tipo("1") == "saida"
    assert expected_cfop_tipo("0") == "entrada"


def test_normalize_city_ignores_accents() -> None:
    assert _normalize_city("Sabáudia") == _normalize_city("Sabaudia")
    assert _normalize_city("Florianópolis") == _normalize_city("Florianopolis")
    assert _normalize_city("  São   Paulo  ") == _normalize_city("sao paulo")


def test_item_requires_cest_only_for_st() -> None:
    from nfe_xml_context import NfeItemContext

    normal_item = NfeItemContext(1, "5102", "12345678", "", "00", "")
    st_item = NfeItemContext(1, "5405", "12345678", "2104100", "60", "")

    assert item_requires_cest(normal_item, "normal") is False
    assert item_requires_cest(st_item, "normal") is True


if __name__ == "__main__":
    test_parse_nfe_validation_context_from_project_xml()
    test_resolve_tax_regime_and_cfop_prefix()
    test_normalize_city_ignores_accents()
    test_item_requires_cest_only_for_st()
    print("OK")
