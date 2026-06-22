"""
Proxy HTTP para validação de NF-e via corpo XML.

O mcp-fiscal-brasil 0.4.0 expõe `validate_nfe_full` com `xml_path` em disco.
Este proxy traduz POST /api/v1/validate-nfe { "xml": "..." } para o retorno cru
do MCP. A auditoria estendida (CAT 31) permanece em POST /api/v1/audit-nfe.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field
from mcp_fiscal_brasil import __version__ as mcp_version

from audit import audit_nfe_xml
from validate_nfe_full_runner import run_validate_nfe_full

app = FastAPI(title="MSedit Fiscal Validator Proxy", version="1.0.0")

BASE_DIR = Path(os.environ.get("MCP_FISCAL_FILE_BASE_DIR", "/tmp/mcp-fiscal-files"))
BASE_DIR.mkdir(parents=True, exist_ok=True)


class ValidateNfeRequest(BaseModel):
    xml: str = Field(min_length=1)


class AchadoResponse(BaseModel):
    severidade: str
    codigo: str
    mensagem: str


class AuditNfeResponse(BaseModel):
    valida: bool
    erros: list[str]
    achados: list[AchadoResponse]
    resumo: str


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": mcp_version, "service": "mcp-fiscal-brasil"}


@app.post("/api/v1/validate-nfe")
async def validate_nfe(body: ValidateNfeRequest) -> dict[str, Any]:
    """Retorno cru de `validate_nfe_full` (mcp-fiscal-brasil)."""
    return await run_validate_nfe_full(body.xml, BASE_DIR)


@app.post("/api/v1/audit-nfe", response_model=AuditNfeResponse)
async def audit_nfe(body: ValidateNfeRequest) -> AuditNfeResponse:
    """Auditoria estendida (CAT 31 / fulfillment) — legado."""
    import tempfile

    fd, raw_path = tempfile.mkstemp(suffix=".xml", dir=BASE_DIR)
    path = Path(raw_path)
    try:
        os.write(fd, body.xml.encode("utf-8"))
        os.close(fd)
        report = await audit_nfe_xml(body.xml, xml_path=path)
        return AuditNfeResponse(
            valida=report.valida,
            erros=report.erros,
            achados=[
                AchadoResponse(
                    severidade=a.severidade.value,
                    codigo=a.codigo,
                    mensagem=a.mensagem,
                )
                for a in report.achados
            ],
            resumo=report.resumo,
        )
    finally:
        path.unlink(missing_ok=True)


def run() -> None:
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
