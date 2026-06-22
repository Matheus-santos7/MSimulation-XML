"""Extrai contexto fiscal do XML NF-e para validações MCP incrementais."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any

NFE_NS = "http://www.portalfiscal.inf.br/nfe"
NS = {"nfe": NFE_NS}

ICMS_CST_ST = frozenset({"10", "30", "60", "70"})
CSOSN_ST = frozenset({"201", "202", "203", "500"})


@dataclass(frozen=True)
class NfeItemContext:
    """Item da NF-e relevante para validação tributária."""

    numero: int
    cfop: str
    ncm: str
    cest: str
    cst_icms: str
    csosn: str


@dataclass
class NfeValidationContext:
    """Campos do XML usados pelas checagens MCP offline/online."""

    crt: str
    id_dest: str
    uf_emit: str
    uf_dest: str
    dest_c_mun: str
    dest_x_mun: str
    dest_cep: str
    itens: list[NfeItemContext] = field(default_factory=list)


def _text(node: ET.Element | None) -> str:
    if node is None or node.text is None:
        return ""
    return node.text.strip()


def _normalize_digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def _normalize_city(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _extract_icms_codes(det: ET.Element) -> tuple[str, str]:
    icms_group = det.find(".//nfe:ICMS", NS)
    if icms_group is None:
        return "", ""

    for child in icms_group:
        cst = _text(child.find("nfe:CST", NS))
        if cst:
            return cst.zfill(2)[-2:], ""
        csosn = _text(child.find("nfe:CSOSN", NS))
        if csosn:
            return "", csosn.zfill(3)[-3:]

    return "", ""


def parse_nfe_validation_context(xml_content: str) -> NfeValidationContext | None:
    """
    Monta contexto mínimo do XML para validações incrementais do MCP.

    @param xml_content - XML completo (nfeProc ou NFe)
    """
    try:
        root = ET.fromstring(xml_content.encode("utf-8"))
    except ET.ParseError:
        return None

    inf = root.find(".//nfe:infNFe", NS)
    if inf is None:
        return None

    ide = inf.find("nfe:ide", NS)
    emit = inf.find("nfe:emit", NS)
    dest = inf.find("nfe:dest", NS)
    ender_emit = emit.find("nfe:enderEmit", NS) if emit is not None else None
    ender_dest = dest.find("nfe:enderDest", NS) if dest is not None else None

    itens: list[NfeItemContext] = []
    for det in inf.findall("nfe:det", NS):
        prod = det.find("nfe:prod", NS)
        cst_icms, csosn = _extract_icms_codes(det)
        try:
            numero = int(det.get("nItem", "0"))
        except ValueError:
            numero = 0

        itens.append(
            NfeItemContext(
                numero=numero,
                cfop=_text(prod.find("nfe:CFOP", NS)) if prod is not None else "",
                ncm=_text(prod.find("nfe:NCM", NS)) if prod is not None else "",
                cest=_text(prod.find("nfe:CEST", NS)) if prod is not None else "",
                cst_icms=cst_icms,
                csosn=csosn,
            )
        )

    return NfeValidationContext(
        crt=_text(emit.find("nfe:CRT", NS)) if emit is not None else "",
        id_dest=_text(ide.find("nfe:idDest", NS)) if ide is not None else "",
        uf_emit=_text(ender_emit.find("nfe:UF", NS)) if ender_emit is not None else "",
        uf_dest=_text(ender_dest.find("nfe:UF", NS)) if ender_dest is not None else "",
        dest_c_mun=_text(ender_dest.find("nfe:cMun", NS)) if ender_dest is not None else "",
        dest_x_mun=_text(ender_dest.find("nfe:xMun", NS)) if ender_dest is not None else "",
        dest_cep=_normalize_digits(
            _text(ender_dest.find("nfe:CEP", NS)) if ender_dest is not None else ""
        ),
        itens=itens,
    )


def resolve_tax_regime(crt: str) -> str:
    """Mapeia CRT da NF-e para regime aceito por `validar_cst` do MCP."""
    if crt in {"1", "2", "4"}:
        return "simples"
    return "normal"


def expected_cfop_prefix(id_dest: str) -> str | None:
    """Primeiro dígito esperado do CFOP de saída conforme idDest."""
    if id_dest == "1":
        return "5"
    if id_dest == "2":
        return "6"
    if id_dest == "3":
        return "7"
    return None


def item_requires_cest(item: NfeItemContext, regime: str) -> bool:
    """Indica se o item exige CEST preenchido e válido."""
    if regime == "simples" and item.csosn in CSOSN_ST:
        return True
    return item.cst_icms in ICMS_CST_ST


def issue_dict(severidade: str, codigo: str, descricao: str) -> dict[str, str]:
    return {"severidade": severidade, "código": codigo, "descrição": descricao}
