"""Testes da auditoria NF-e fulfillment (mcp-fiscal-brasil)."""

from __future__ import annotations

import asyncio
from pathlib import Path

from audit import audit_nfe_xml

SAMPLE_XML = Path(__file__).with_name("fixtures").joinpath("nfe-fulfillment-audit.xml")


async def _run() -> None:
    xml = SAMPLE_XML.read_text(encoding="utf-8")
    result = await audit_nfe_xml(xml, xml_path=SAMPLE_XML)

    assert not result.valida, "XML de exemplo deve ser rejeitado"
    assert any("CFOP_CST_ICMS_REMESSA" in a.codigo for a in result.achados)
    assert any("DEST_CMUN_VAZIO" in a.codigo for a in result.achados)
    assert any(a.severidade.value == "critico" for a in result.achados)
    print("OK:", result.resumo)
    print("Achados:", len(result.achados))


if __name__ == "__main__":
    asyncio.run(_run())
