# Proxy MCP Fiscal + endpoint POST /api/v1/validate-nfe { xml }.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    MCP_FISCAL_LOG_LEVEL=INFO \
    MCP_FISCAL_FILE_BASE_DIR=/tmp/mcp-fiscal-files \
    PIP_NO_CACHE_DIR=1

RUN pip install --no-cache-dir "mcp-fiscal-brasil==0.5.1"

WORKDIR /app
COPY infra/fiscal-validator-proxy/audit.py /app/audit.py
COPY infra/fiscal-validator-proxy/cep_lookup.py /app/cep_lookup.py
COPY infra/fiscal-validator-proxy/catalog_helpers.py /app/catalog_helpers.py
COPY infra/fiscal-validator-proxy/nfe_xml_context.py /app/nfe_xml_context.py
COPY infra/fiscal-validator-proxy/mcp_nfe_extended_checks.py /app/mcp_nfe_extended_checks.py
COPY infra/fiscal-validator-proxy/validate_nfe_full_response.py /app/validate_nfe_full_response.py
COPY infra/fiscal-validator-proxy/validate_nfe_full_runner.py /app/validate_nfe_full_runner.py
COPY infra/fiscal-validator-proxy/main.py /app/main.py

# Render injeta PORT em runtime.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
