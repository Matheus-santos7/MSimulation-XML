"""
Proxy HTTP para validação de NF-e via corpo XML.

O mcp-fiscal-brasil 0.4.0 expõe apenas POST /v1/nfe/validate com xml_path
(arquivo no disco do container). Este proxy traduz POST /api/v1/validate-nfe
{ "xml": "..." } para validate_nfe_full(), compatível com o backend msedit-xml.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel, Field
from mcp_fiscal_brasil import __version__ as mcp_version
from mcp_fiscal_brasil.agentic import validate_nfe_full

app = FastAPI(title="MSedit Fiscal Validator Proxy", version="1.0.0")

BASE_DIR = Path(os.environ.get("MCP_FISCAL_FILE_BASE_DIR", "/tmp/mcp-fiscal-files"))
BASE_DIR.mkdir(parents=True, exist_ok=True)


class ValidateNfeRequest(BaseModel):
    xml: str = Field(min_length=1)


class ValidateNfeResponse(BaseModel):
    valida: bool
    erros: list[str]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": mcp_version, "service": "mcp-fiscal-brasil"}


@app.post("/api/v1/validate-nfe", response_model=ValidateNfeResponse)
async def validate_nfe(body: ValidateNfeRequest) -> ValidateNfeResponse:
    fd, raw_path = tempfile.mkstemp(suffix=".xml", dir=BASE_DIR)
    path = Path(raw_path)
    try:
        os.write(fd, body.xml.encode("utf-8"))
        os.close(fd)
        report = await validate_nfe_full(path)
        erros = [f"{issue.código}: {issue.descrição}" for issue in report.issues]
        valida = report.valida_estruturalmente and len(report.issues) == 0
        return ValidateNfeResponse(valida=valida, erros=erros)
    finally:
        path.unlink(missing_ok=True)


def run() -> None:
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
