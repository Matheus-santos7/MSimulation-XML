/** Protocolo SEFAZ simulado (15 dígitos). */
export function gerarProtocoloSefaz(cOrgao = "41"): string {
  const org = cOrgao.padStart(2, "0").slice(0, 2);
  const seq = String(Date.now() % 1_000_000_000_000).padStart(11, "0");
  return `${org}26${seq}`.slice(0, 15);
}
