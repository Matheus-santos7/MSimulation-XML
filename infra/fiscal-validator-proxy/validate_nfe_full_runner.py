"""Executa `validate_nfe_full` a partir de conteúdo XML inline."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from mcp_fiscal_brasil.agentic import validate_nfe_full

from validate_nfe_full_response import serialize_validate_nfe_full_report


async def run_validate_nfe_full(xml_content: str, base_dir: Path) -> dict[str, Any]:
    """
    Grava XML em arquivo temporário e retorna o JSON cru do MCP.

    @param xml_content - XML completo (nfeProc ou NFe)
    @param base_dir - Diretório para arquivos temporários
    """
    base_dir.mkdir(parents=True, exist_ok=True)
    fd, raw_path = tempfile.mkstemp(suffix=".xml", dir=base_dir)
    path = Path(raw_path)
    try:
        os.write(fd, xml_content.encode("utf-8"))
        os.close(fd)
        report = await validate_nfe_full(path)
        return serialize_validate_nfe_full_report(report)
    finally:
        path.unlink(missing_ok=True)
