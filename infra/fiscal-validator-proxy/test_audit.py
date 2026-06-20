"""Testes da auditoria NF-e fulfillment (mcp-fiscal-brasil)."""

from __future__ import annotations

import asyncio
from pathlib import Path

from audit import _should_skip_assinatura_check, audit_nfe_xml

SAMPLE_XML = Path(__file__).with_name("fixtures").joinpath("nfe-fulfillment-audit.xml")


def test_skip_assinatura_homologacao() -> None:
    assert _should_skip_assinatura_check("2", None) is True


def test_skip_assinatura_rsa_sha1_forbidden() -> None:
    assert _should_skip_assinatura_check(
        "1",
        "Signature method RSA_SHA1 forbidden by configuration",
    ) is True


def test_nao_skip_assinatura_producao() -> None:
    assert _should_skip_assinatura_check("1", "certificado expirado") is False


async def _run_audit() -> None:
    xml = SAMPLE_XML.read_text(encoding="utf-8")
    result = await audit_nfe_xml(xml, xml_path=SAMPLE_XML)

    assert not result.valida, "XML de exemplo deve ser rejeitado"
    assert any("CFOP_CST_ICMS_REMESSA" in a.codigo for a in result.achados)
    assert any("DEST_CMUN_VAZIO" in a.codigo for a in result.achados)
    assert any(a.severidade.value == "critico" for a in result.achados)
    assert not any(a.codigo == "ASSINATURA_INVALIDA" for a in result.achados)
    print("OK:", result.resumo)
    print("Achados:", len(result.achados))


if __name__ == "__main__":
    test_skip_assinatura_homologacao()
    test_skip_assinatura_rsa_sha1_forbidden()
    test_nao_skip_assinatura_producao()
    asyncio.run(_run_audit())
