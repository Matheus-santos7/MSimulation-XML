"""Testes da serialização e enriquecimento do retorno cru de validate_nfe_full."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

from validate_nfe_full_response import (
    enrich_validate_nfe_full_payload,
    serialize_validate_nfe_full_report,
)

SAMPLE_XML = Path(__file__).with_name("fixtures").joinpath("nfe-fulfillment-audit.xml")
PROJECT_XML = Path(__file__).resolve().parents[2].joinpath("xml.xml")


def test_serialize_validate_nfe_full_report() -> None:
    report = SimpleNamespace(
        chave_acesso="35260601490698006689550580000000311306171272",
        valida_estruturalmente=True,
        chave_consistente=True,
        emissor_ativo=True,
        cnpj_emissor="01490698006689",
        valor_total=809.0,
        data_emissao="2026-06-19",
        issues=[
            SimpleNamespace(
                severidade="critico",
                código="XML_PARSE_ERROR",
                descrição="Falha ao parsear XML",
            )
        ],
        resumo="NFe válida estruturalmente.",
    )

    payload = serialize_validate_nfe_full_report(report)

    assert payload["chave_acesso"] == "35260601490698006689550580000000311306171272"
    assert payload["valida_estruturalmente"] is True
    assert payload["cnpj_emissor"] == "01490698006689"
    assert payload["valor_total"] == 809.0
    assert payload["issues"][0]["código"] == "XML_PARSE_ERROR"
    assert payload["issues"][0]["descrição"] == "Falha ao parsear XML"


async def _run_enrich_from_project_xml() -> None:
    xml_content = PROJECT_XML.read_text(encoding="utf-8")
    payload = {
        "chave_acesso": "",
        "valida_estruturalmente": True,
        "chave_consistente": False,
        "emissor_ativo": True,
        "issues": [],
        "resumo": "NFe válida estruturalmente, chave  consistente, emissor ativo.",
        "cnpj_emissor": "01490698006689",
        "valor_total": 809.0,
        "data_emissao": "2026-06-19",
    }

    enriched = await enrich_validate_nfe_full_payload(payload, xml_content)

    assert enriched["chave_acesso"] == "35260601490698006689550580000000311306171272"
    assert enriched["chave_consistente"] is True
    assert enriched["issues"] == []
    assert "35260601490698006689550580000000311306171272" in enriched["resumo"]


def test_enrich_validate_nfe_full_payload_fills_empty_chave() -> None:
    if not PROJECT_XML.exists():
        return
    try:
        asyncio.run(_run_enrich_from_project_xml())
    except ModuleNotFoundError:
        return


if __name__ == "__main__":
    test_serialize_validate_nfe_full_report()
    test_enrich_validate_nfe_full_payload_fills_empty_chave()
    print("OK")
