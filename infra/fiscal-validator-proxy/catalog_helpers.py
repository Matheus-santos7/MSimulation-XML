"""Helpers para validação de catálogos fiscais (NCM/CEST) com banco MCP parcial."""

from __future__ import annotations

import os
import re
import unicodedata

_NCM_DIGITS_RE = re.compile(r"^\d{8}$")
_CEST_DIGITS_RE = re.compile(r"^\d{7}$")


def is_strict_catalog_enabled() -> bool:
    """Quando true, ausência no catálogo MCP vira rejeição (exige TIPI/CEST completos)."""
    raw = os.environ.get("FISCAL_VALIDATOR_STRICT_CATALOG", "false").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def normalize_ncm(ncm: str) -> str:
    return re.sub(r"\D", "", ncm.strip())


def normalize_cest(cest: str) -> str:
    return re.sub(r"\D", "", cest.strip())


def is_valid_ncm_format(ncm: str) -> bool:
    return bool(_NCM_DIGITS_RE.match(normalize_ncm(ncm)))


def is_valid_cest_format(cest: str) -> bool:
    return bool(_CEST_DIGITS_RE.match(normalize_cest(cest)))


def _exception_message(exc: Exception) -> str:
    message = getattr(exc, "message", None)
    if isinstance(message, str) and message.strip():
        return message
    return str(exc)


def _normalize_lookup_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return without_accents.lower()


def is_catalog_gap_error(exc: Exception) -> bool:
    """
    Detecta ausência no catálogo bundled do MCP (amostra incompleta).

    O wheel distribui ~250 NCM e ~100 CEST de exemplo, não a TIPI/CEST integral.
    """
    message = _normalize_lookup_text(_exception_message(exc))
    markers = (
        "nao encontrado",
        "incompleto",
        "build_tabelas_db",
        "tabela tipi",
        "tabela completa",
        "nao encontrada",
    )
    return any(marker in message for marker in markers)
