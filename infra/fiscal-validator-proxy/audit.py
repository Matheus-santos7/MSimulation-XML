"""
Auditoria consolidada de NF-e (fulfillment / CAT 31) via mcp-fiscal-brasil.

Orquestra parse, chave, estrutura, assinatura, consultas offline e regras
de negócio alinhadas ao parecer fiscal do simulador msedit-xml.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from mcp_fiscal_brasil.agentic import validate_nfe_full
from mcp_fiscal_brasil.nfe.assinatura import validar_assinatura_nfe
from mcp_fiscal_brasil.nfe.tools import validar_chave_nfe
from mcp_fiscal_brasil.nfe.xml_parser import parse_nfe_xml
from mcp_fiscal_brasil.tabelas.tools import consultar_aliquota_icms

NFE_NS = "http://www.portalfiscal.inf.br/nfe"
NS = {"nfe": NFE_NS}

REMESSA_CFOPS = frozenset({"5949", "6949", "5904", "6904"})
ICMS_CST_TRIBUTADO = frozenset({"00", "10", "20", "51", "70"})
ICMS_CST_NAO_TRIBUTADO = frozenset({"40", "41", "50", "60"})
ORIGEM_IMPORTADA = frozenset({1, 2, 3, 8})


class Severidade(str, Enum):
    CRITICO = "critico"
    ALTO = "alto"
    MEDIO = "medio"


@dataclass(frozen=True)
class Achado:
    severidade: Severidade
    codigo: str
    mensagem: str

    def as_erro(self) -> str:
        label = self.severidade.value.upper()
        return f"[{label}] {self.mensagem}"


@dataclass
class AuditResult:
    valida: bool
    erros: list[str]
    achados: list[Achado]
    resumo: str


def extract_chave_acesso(xml_content: str) -> str | None:
    """Extrai chave de 44 dígitos do Id infNFe ou protNFe/chNFe."""
    match = re.search(r'Id="NFe(\d{44})"', xml_content)
    if match:
        return match.group(1)
    match = re.search(r"<chNFe>(\d{44})</chNFe>", xml_content)
    return match.group(1) if match else None


def _local(tag: str) -> str:
    return f"{{{NFE_NS}}}{tag}"


def _text(node: ET.Element | None) -> str:
    if node is None or node.text is None:
        return ""
    return node.text.strip()


def _find_first(root: ET.Element, path: str) -> ET.Element | None:
    return root.find(path, NS)


def _parse_xml_fields(xml_content: str) -> dict[str, Any]:
    """Campos do XML não expostos pelo parse_nfe_xml do MCP."""
    root = ET.fromstring(xml_content.encode("utf-8"))
    inf = root.find(".//nfe:infNFe", NS)
    if inf is None:
        return {}

    ide = inf.find("nfe:ide", NS)
    dest = inf.find("nfe:dest", NS)
    ender_dest = dest.find("nfe:enderDest", NS) if dest is not None else None
    inf_intermed = inf.find("nfe:infIntermed", NS)

    external_id = ""
    for obs in inf.findall(".//nfe:obsCont", NS):
        if obs.get("xCampo") == "external_id":
            texto = obs.find("nfe:xTexto", NS)
            external_id = _text(texto)
            break

    det = inf.find("nfe:det", NS)
    orig = 0
    if det is not None:
        orig_node = det.find(".//nfe:orig", NS)
        if orig_node is not None and orig_node.text:
            try:
                orig = int(orig_node.text.strip())
            except ValueError:
                orig = 0

    return {
        "tp_amb": _text(_find_first(ide, "nfe:tpAmb") if ide is not None else None),
        "ind_intermed": _text(_find_first(ide, "nfe:indIntermed") if ide is not None else None),
        "c_mun_dest": _text(_find_first(ender_dest, "nfe:cMun") if ender_dest is not None else None),
        "x_bairro_dest": _text(_find_first(ender_dest, "nfe:xBairro") if ender_dest is not None else None),
        "ind_ie_dest": _text(_find_first(dest, "nfe:indIEDest") if dest is not None else None),
        "ie_dest": _text(_find_first(dest, "nfe:IE") if dest is not None else None),
        "inf_intermed_cnpj": _text(_find_first(inf_intermed, "nfe:CNPJ") if inf_intermed is not None else None),
        "id_cad_int_tran": _text(_find_first(inf_intermed, "nfe:idCadIntTran") if inf_intermed is not None else None),
        "external_id": external_id,
        "orig_icms": orig,
    }


def _item_icms_bases(xml_content: str) -> list[dict[str, float | str]]:
    """Extrai CFOP, CST, vBC e vICMS de cada <det> via ElementTree."""
    root = ET.fromstring(xml_content.encode("utf-8"))
    items: list[dict[str, float | str]] = []
    for det in root.findall(".//nfe:det", NS):
        cfop = _text(det.find(".//nfe:CFOP", NS))
        cst_node = det.find(".//nfe:ICMS/*[nfe:CST]", NS)
        cst = ""
        v_bc = 0.0
        v_icms = 0.0
        p_icms = 0.0
        if cst_node is not None:
            cst = _text(cst_node.find("nfe:CST", NS))
            v_bc_node = cst_node.find("nfe:vBC", NS)
            v_icms_node = cst_node.find("nfe:vICMS", NS)
            p_icms_node = cst_node.find("nfe:pICMS", NS)
            try:
                v_bc = float(_text(v_bc_node) or "0")
                v_icms = float(_text(v_icms_node) or "0")
                p_icms = float(_text(p_icms_node) or "0")
            except ValueError:
                pass
        items.append({"cfop": cfop, "cst": cst, "v_bc": v_bc, "v_icms": v_icms, "p_icms": p_icms})
    return items


def _append(achados: list[Achado], severidade: Severidade, codigo: str, mensagem: str) -> None:
    achados.append(Achado(severidade=severidade, codigo=codigo, mensagem=mensagem))


def _check_remessa_icms(
    achados: list[Achado],
    cfop: str,
    cst_icms: str,
    v_icms: float,
    v_bc: float,
) -> None:
    """CFOP de remessa não deve destacar ICMS como saída tributada."""
    if cfop not in REMESSA_CFOPS:
        return

    cst = cst_icms.zfill(2)[-2:] if cst_icms else ""

    if cst in ICMS_CST_TRIBUTADO and v_icms > 0:
        _append(
            achados,
            Severidade.CRITICO,
            "CFOP_CST_ICMS_REMESSA",
            f"CFOP {cfop} (remessa) incompatível com CST ICMS {cst} e vICMS={v_icms:.2f}. "
            "Remessas usam CST 40/41/50/60/90 com ICMS zerado.",
        )
        return

    if cst in ICMS_CST_NAO_TRIBUTADO and (v_icms > 0 or v_bc > 0):
        _append(
            achados,
            Severidade.CRITICO,
            "CFOP_CST_ICMS_ZERADO",
            f"CFOP {cfop} com CST {cst} exige vBC e vICMS zerados (vBC={v_bc:.2f}, vICMS={v_icms:.2f}).",
        )


async def _check_aliquota_icms(
    achados: list[Achado],
    uf_origem: str,
    uf_destino: str,
    p_icms: float,
    orig_produto: int,
) -> None:
    if not uf_origem or not uf_destino or uf_origem == uf_destino:
        return

    try:
        lookup = await consultar_aliquota_icms(uf_origem, uf_destino)
        expected = float(lookup.aliquota_interestadual)
        if orig_produto in ORIGEM_IMPORTADA and p_icms > 0:
            expected = 4.0
    except Exception as exc:
        _append(
            achados,
            Severidade.MEDIO,
            "ALIQUOTA_ICMS_LOOKUP",
            f"Não foi possível consultar alíquota ICMS {uf_origem}→{uf_destino}: {exc}",
        )
        return

    if p_icms <= 0:
        return

    if abs(p_icms - expected) > 0.01:
        _append(
            achados,
            Severidade.ALTO,
            "ALIQUOTA_ICMS_DIVERGENTE",
            f"pICMS {p_icms:.2f}% diverge da alíquota esperada {expected:.2f}% "
            f"para operação interestadual {uf_origem}→{uf_destino}.",
        )


def _build_resumo(achados: list[Achado], valida: bool) -> str:
    if valida:
        return "NF-e aprovada na auditoria fiscal (estrutura, chave e regras de fulfillment)."
    criticos = sum(1 for a in achados if a.severidade == Severidade.CRITICO)
    altos = sum(1 for a in achados if a.severidade == Severidade.ALTO)
    return (
        f"NF-e rejeitada: {criticos} achado(s) crítico(s), {altos} alto(s), "
        f"{len(achados)} no total."
    )


async def audit_nfe_xml(xml_content: str, xml_path: Path | None = None) -> AuditResult:
    """
    Executa auditoria completa de NF-e conforme fluxo MCP + regras CAT 31.

    @param xml_content - XML completo (nfeProc ou NFe)
    @param xml_path - Caminho temporário para validate_nfe_full (obrigatório se None usa tmp)
    """
    achados: list[Achado] = []

    chave = extract_chave_acesso(xml_content)
    if not chave:
        _append(achados, Severidade.CRITICO, "CHAVE_AUSENTE", "Chave de acesso não encontrada no XML.")
        erros = [a.as_erro() for a in achados]
        return AuditResult(valida=False, erros=erros, achados=achados, resumo=_build_resumo(achados, False))

    try:
        chave_result = await validar_chave_nfe(chave)
        if not chave_result.get("válido"):
            _append(
                achados,
                Severidade.CRITICO,
                "CHAVE_INVALIDA",
                f"Chave de acesso inválida: {chave_result}",
            )
    except Exception as exc:
        _append(achados, Severidade.CRITICO, "CHAVE_VALIDACAO", f"Falha ao validar chave: {exc}")

    path = xml_path
    cleanup = False
    if path is None:
        import os
        import tempfile

        fd, raw = tempfile.mkstemp(suffix=".xml")
        path = Path(raw)
        os.write(fd, xml_content.encode("utf-8"))
        os.close(fd)
        cleanup = True

    try:
        report = await validate_nfe_full(path)
        if not report.valida_estruturalmente:
            _append(
                achados,
                Severidade.CRITICO,
                "ESTRUTURA_XML",
                "XML inválido estruturalmente (validate_nfe_full).",
            )
        if not report.emissor_ativo:
            _append(
                achados,
                Severidade.CRITICO,
                "EMISSOR_INATIVO",
                f"CNPJ emissor {report.cnpj_emissor} não está ativo.",
            )
        for issue in report.issues:
            _append(
                achados,
                Severidade.CRITICO,
                issue.código,
                issue.descrição,
            )
    except Exception as exc:
        _append(achados, Severidade.CRITICO, "VALIDATE_NFE_FULL", f"Falha na validação estrutural: {exc}")
    finally:
        if cleanup and path is not None:
            path.unlink(missing_ok=True)

    try:
        parsed = parse_nfe_xml(xml_content, chave)
        extra = _parse_xml_fields(xml_content)
        tp_amb = extra.get("tp_amb", "")

        if not extra.get("c_mun_dest"):
            _append(
                achados,
                Severidade.CRITICO,
                "DEST_CMUN_VAZIO",
                "Destinatário com <cMun> vazio — campo obrigatório (risco de rejeição SEFAZ).",
            )
        if not extra.get("x_bairro_dest"):
            _append(
                achados,
                Severidade.ALTO,
                "DEST_BAIRRO_VAZIO",
                "Destinatário com <xBairro> vazio — campo obrigatório no endereço.",
            )
        if extra.get("ind_ie_dest") == "1" and not extra.get("ie_dest") and not parsed.destinatario.ie:
            _append(
                achados,
                Severidade.ALTO,
                "DEST_IE_AUSENTE",
                "indIEDest=1 (contribuinte ICMS) sem Inscrição Estadual do destinatário.",
            )

        for item in parsed.itens:
            p_icms = float(item.aliquota_icms or 0)
            uf_emit = parsed.emitente.uf or ""
            uf_dest = parsed.destinatario.uf or ""
            await _check_aliquota_icms(
                achados,
                uf_emit,
                uf_dest,
                p_icms,
                int(extra.get("orig_icms", 0)),
            )

        for raw_item in _item_icms_bases(xml_content):
            _check_remessa_icms(
                achados,
                str(raw_item["cfop"]),
                str(raw_item["cst"]).zfill(2)[-2:],
                float(raw_item["v_icms"]),
                float(raw_item["v_bc"]),
            )

        if extra.get("ind_intermed") == "1":
            if not extra.get("inf_intermed_cnpj"):
                _append(
                    achados,
                    Severidade.ALTO,
                    "INF_INTERMED_AUSENTE",
                    "indIntermed=1 exige grupo <infIntermed> com CNPJ do intermediador.",
                )
            if not extra.get("id_cad_int_tran"):
                _append(
                    achados,
                    Severidade.MEDIO,
                    "ID_CAD_INT_TRAN_AUSENTE",
                    "Operação intermediada sem idCadIntTran.",
                )

    except Exception as exc:
        _append(achados, Severidade.CRITICO, "PARSE_NFE", f"Falha ao parsear XML: {exc}")

    try:
        assinatura = validar_assinatura_nfe(xml_content)
        extra = _parse_xml_fields(xml_content)
        tp_amb = extra.get("tp_amb", "1")
        if not assinatura.assinatura_valida:
            sev = Severidade.MEDIO if tp_amb == "2" else Severidade.CRITICO
            _append(
                achados,
                sev,
                "ASSINATURA_INVALIDA",
                f"Assinatura XMLDSig não validada: {assinatura.motivo}",
            )
    except Exception as exc:
        _append(achados, Severidade.ALTO, "ASSINATURA_ERRO", f"Falha ao validar assinatura: {exc}")

    has_critico = any(a.severidade == Severidade.CRITICO for a in achados)
    has_alto = any(a.severidade == Severidade.ALTO for a in achados)
    valida = not has_critico and not has_alto

    erros = [a.as_erro() for a in achados]
    return AuditResult(
        valida=valida,
        erros=erros,
        achados=achados,
        resumo=_build_resumo(achados, valida),
    )
