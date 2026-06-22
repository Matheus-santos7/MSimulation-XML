"""Testes dos helpers de catálogo fiscal."""

from __future__ import annotations

from catalog_helpers import (
    is_catalog_gap_error,
    is_valid_cest_format,
    is_valid_ncm_format,
)


class _FakeExc(Exception):
    pass


def test_ncm_and_cest_format() -> None:
    assert is_valid_ncm_format("85094010")
    assert is_valid_ncm_format("8509.40.10")
    assert not is_valid_ncm_format("8509401")
    assert is_valid_cest_format("2104100")
    assert not is_valid_cest_format("210410")


def test_catalog_gap_error_detection() -> None:
    exc = _FakeExc(
        "NCM '85094010' não encontrado. O banco NCM pode estar incompleto; "
        "execute scripts/build_tabelas_db.py"
    )
    assert is_catalog_gap_error(exc)

    class _FiscalLike(Exception):
        def __init__(self, message: str) -> None:
            super().__init__(message)
            self.message = message

        def __str__(self) -> str:
            return self.message

    assert is_catalog_gap_error(
        _FiscalLike(
            "NCM '85094010' não encontrado. O banco NCM pode estar incompleto; "
            "execute scripts/build_tabelas_db.py para popular a tabela TIPI completa."
        )
    )


if __name__ == "__main__":
    test_ncm_and_cest_format()
    test_catalog_gap_error_detection()
    print("OK")
