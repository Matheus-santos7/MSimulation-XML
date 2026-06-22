"""Consulta CEP tolerante a campos opcionais nulos (workaround MCP Pydantic)."""

from __future__ import annotations

import asyncio
import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

BRASIL_API_CEP_URL = "https://brasilapi.com.br/api/cep/v2/{cep}"
VIACEP_URL = "https://viacep.com.br/ws/{cep}/json/"
USER_AGENT = "msedit-fiscal-validator/1.0"


@dataclass(frozen=True)
class CepLookupResult:
    """Dados mínimos de endereço usados na validação do destinatário."""

    cep: str
    state: str
    city: str


class CepNotFoundError(ValueError):
    """CEP inexistente ou não retornado pelas APIs públicas."""


def normalize_cep_digits(cep: str) -> str:
    """Remove máscara e valida 8 dígitos."""
    digits = re.sub(r"\D", "", cep)
    if len(digits) != 8:
        raise ValueError(f"CEP inválido: {cep}")
    return digits


def _http_get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in {400, 404}:
            raise CepNotFoundError(f"CEP não encontrado ({exc.code})") from exc
        raise


def _lookup_brasilapi(cep: str) -> CepLookupResult:
    data = _http_get_json(BRASIL_API_CEP_URL.format(cep=cep))
    state = str(data.get("state") or "").strip()
    city = str(data.get("city") or "").strip()
    if not state or not city:
        raise ValueError("Resposta da BrasilAPI sem UF ou município.")
    return CepLookupResult(cep=cep, state=state, city=city)


def _lookup_viacep(cep: str) -> CepLookupResult:
    data = _http_get_json(VIACEP_URL.format(cep=cep))
    if data.get("erro"):
        raise CepNotFoundError("CEP não encontrado no ViaCEP.")
    state = str(data.get("uf") or "").strip()
    city = str(data.get("localidade") or "").strip()
    if not state or not city:
        raise ValueError("Resposta do ViaCEP sem UF ou município.")
    return CepLookupResult(cep=cep, state=state, city=city)


def lookup_dest_cep_sync(cep: str) -> CepLookupResult:
    """
    Consulta CEP usando BrasilAPI e ViaCEP como fallback.

    Ignora `street`/`neighborhood` nulos — só UF e município são necessários
    para as checagens do destinatário na NF-e.
    """
    digits = normalize_cep_digits(cep)
    try:
        return _lookup_brasilapi(digits)
    except CepNotFoundError:
        raise
    except Exception:
        return _lookup_viacep(digits)


async def lookup_dest_cep(cep: str) -> CepLookupResult:
    """Versão assíncrona de `lookup_dest_cep_sync`."""
    return await asyncio.to_thread(lookup_dest_cep_sync, cep)
