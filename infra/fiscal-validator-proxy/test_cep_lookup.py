"""Testes da consulta tolerante de CEP."""

from __future__ import annotations

from unittest.mock import patch

from cep_lookup import (
    CepLookupResult,
    lookup_dest_cep_sync,
    normalize_cep_digits,
)


def test_normalize_cep_digits() -> None:
    assert normalize_cep_digits("88010-000") == "88010000"


def test_lookup_brasilapi_ignores_null_street() -> None:
    payload = {
        "cep": "01310930",
        "state": "SP",
        "city": "São Paulo",
        "neighborhood": None,
        "street": None,
    }

    with patch("cep_lookup._http_get_json", return_value=payload):
        result = lookup_dest_cep_sync("01310-930")

    assert result == CepLookupResult(cep="01310930", state="SP", city="São Paulo")


def test_lookup_falls_back_to_viacep() -> None:
    viacep_payload = {
        "cep": "88010-000",
        "localidade": "Florianópolis",
        "uf": "SC",
    }

    with patch("cep_lookup._lookup_brasilapi", side_effect=RuntimeError("timeout")):
        with patch("cep_lookup._lookup_viacep", return_value=CepLookupResult("88010000", "SC", "Florianópolis")):
            result = lookup_dest_cep_sync("88010000")

    assert result.city == "Florianópolis"
    assert result.state == "SC"


if __name__ == "__main__":
    test_normalize_cep_digits()
    test_lookup_brasilapi_ignores_null_street()
    test_lookup_falls_back_to_viacep()
    print("OK")
