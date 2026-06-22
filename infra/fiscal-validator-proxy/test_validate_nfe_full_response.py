"""Testes da serialização do retorno cru de validate_nfe_full."""

from __future__ import annotations

from types import SimpleNamespace

from validate_nfe_full_response import serialize_validate_nfe_full_report


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


if __name__ == "__main__":
    test_serialize_validate_nfe_full_report()
    print("OK")
