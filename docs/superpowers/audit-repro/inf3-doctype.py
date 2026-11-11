"""
INF-3: a recusa de DOCTYPE (safe_fromstring, commit 58bbf98) roda antes ou depois do
validate_nfe_full da biblioteca? E a biblioteca expande entidades?
Rodar com o venv que tem mcp-fiscal-brasil==0.5.1, a partir de infra/fiscal-validator-proxy:
  <venv>/bin/python -I ../../docs/superpowers/audit-repro/inf3-doctype.py
"""
import asyncio
import sys
import time
import tracemalloc
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))

import nfe_xml_context  # noqa: E402
import validate_nfe_full_runner as runner  # noqa: E402
from mcp_fiscal_brasil.shared import xml_utils  # noqa: E402

order: list[str] = []
real_safe = nfe_xml_context.safe_fromstring
real_full = runner.validate_nfe_full
real_lib_parse = xml_utils.parse_xml


def spy_safe(data):
    order.append("safe_fromstring")
    return real_safe(data)


async def spy_full(path):
    order.append("validate_nfe_full")
    return await real_full(path)


lib_results: list[str] = []


def spy_lib_parse(content):
    root = real_lib_parse(content)
    text = "".join(root.itertext())
    lib_results.append(f"lib parse ok, texto={len(text)} chars, contém 'lol'={'lol' * 2 in text}, contém hosts={'localhost' in text}")
    return root


nfe_xml_context.safe_fromstring = spy_safe
for mod in list(sys.modules.values()):
    if mod is not None and getattr(mod, "safe_fromstring", None) is real_safe:
        mod.safe_fromstring = spy_safe
runner.validate_nfe_full = spy_full
xml_utils.parse_xml = spy_lib_parse
import mcp_fiscal_brasil.nfe.xml_parser as xp  # noqa: E402

xp.parse_xml = spy_lib_parse

LEVELS = 5
ents = ['<!ENTITY lol0 "lol">'] + [
    f'<!ENTITY lol{i} "{"".join(f"&lol{i - 1};" for _ in range(10))}">' for i in range(1, LEVELS + 1)
]
xml = (
    f'<?xml version="1.0"?><!DOCTYPE nfeProc [{"".join(ents)}]>'
    f'<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe1"><ide><natOp>&lol{LEVELS};</natOp></ide></infNFe></NFe></nfeProc>'
)

if len(sys.argv) > 1 and sys.argv[1] == "xxe":
    xml = (
        '<?xml version="1.0"?><!DOCTYPE nfeProc [<!ENTITY x SYSTEM "file:///etc/hosts">]>'
        '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe1"><ide><natOp>&x;lol</natOp></ide></infNFe></NFe></nfeProc>'
    )

tracemalloc.start()
t0 = time.time()
try:
    asyncio.run(runner.run_validate_nfe_full(xml, Path("/tmp/inf3-audit")))
    outcome = "pipeline concluiu"
except Exception as exc:  # registra qualquer falha do pipeline como resultado
    outcome = f"pipeline lançou {type(exc).__name__}: {str(exc)[:90]}"
_, peak = tracemalloc.get_traced_memory()
print(f"ordem das chamadas: {order}")
print(f"biblioteca: {lib_results or ['parse_xml não chamado / falhou']}")
print(f"{outcome}; tempo={time.time() - t0:.2f}s; pico de memória={peak / 1e6:.1f} MB")
first_is_lib = bool(order) and order[0] == "validate_nfe_full"
expanded = any("contém 'lol'=True" in r for r in lib_results)
print(f"VEREDITO: ordem {'Confirmado' if first_is_lib else 'Refutado'} (biblioteca lê antes do guarda); "
      f"expansão de entidades na biblioteca: {'Sim' if expanded else 'Não'} → INF-3 {'Confirmado' if first_is_lib and expanded else 'Refutado no impacto'}")
