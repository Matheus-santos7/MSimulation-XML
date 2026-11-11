"""
Varredura: chamadas Prisma (findUnique/findFirst/findMany/update/updateMany/delete/deleteMany/upsert/count)
cujo `where` não cita tenantId, cruzadas com as tabelas que têm RLS no banco migrado do harness.
Uso (raiz do repositório): python3 -I docs/superpowers/audit-repro/tenant-filter-sweep.py > docs/superpowers/audit-repro/tenant-filter-sweep.md
"""
import re
from pathlib import Path

ROOT = Path.cwd()
schema = (ROOT / "backend/prisma/schema.prisma").read_text()
model_table: dict[str, str] = {}
for m in re.finditer(r"^model (\w+) \{(.*?)^\}", schema, re.S | re.M):
    mapped = re.search(r'@@map\("([^"]+)"\)', m.group(2))
    model_table[m.group(1)[0].lower() + m.group(1)[1:]] = mapped.group(1) if mapped else m.group(1)
model_table["nFe"] = model_table.get("nFe", "nfes")
model_table["cTe"] = model_table.get("cTe", "ctes")

# Fonte da verdade: o banco do harness com todas as migrations aplicadas (harness/up.sh).
import subprocess  # noqa: E402

rls = set(
    subprocess.run(
        ["docker", "exec", "audit-pg", "psql", "-U", "audit", "-d", "audit", "-tAc",
         "select relname from pg_class where relrowsecurity and relkind = 'r'"],
        check=True, capture_output=True, text=True,
    ).stdout.split()
)

OPS = "findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|update|updateMany|delete|deleteMany|upsert|count"
call = re.compile(rf"\.(\w+)\.({OPS})\(\s*\{{")


def balanced(text: str, start: int) -> str:
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:]


rows = []
total = 0
for f in sorted((ROOT / "backend/src").rglob("*.ts")):
    rel = f.relative_to(ROOT).as_posix()
    if "/generated/" in rel or "/test/" in rel or rel.endswith(".spec.ts"):
        continue
    text = f.read_text()
    for m in call.finditer(text):
        model, op = m.group(1), m.group(2)
        if model not in model_table:
            continue
        total += 1
        arg = balanced(text, m.end() - 1)
        where = re.search(r"where\s*:", arg)
        where_txt = balanced(arg, arg.index("{", where.end())) if where and "{" in arg[where.end():where.end() + 3] else (arg if where else "")
        if "tenantId" in where_txt or "tenant_id" in where_txt:
            continue
        table = model_table[model]
        line = text[: m.start()].count("\n") + 1
        status = "RLS" if table in rls else "SEM RLS"
        key = re.sub(r"\s+", " ", where_txt)[:70] if where_txt else "(sem where)"
        rows.append((status, rel, line, model, op, table, key))

print("# Varredura de filtro por tenant\n")
print(f"Chamadas examinadas: {total}. Sem `tenantId` no `where`: {len(rows)}. Tabelas com RLS (banco migrado): {len(rls)}.\n")
for status in ("SEM RLS", "RLS"):
    sel = [r for r in rows if r[0] == status]
    print(f"## {status} ({len(sel)})\n")
    print("| Arquivo:linha | Modelo.op | Tabela | where |")
    print("|---|---|---|---|")
    for _, rel, line, model, op, table, key in sel:
        print(f"| `{rel}:{line}` | `{model}.{op}` | `{table}` | `{key.replace('|', '/')}` |")
    print()
