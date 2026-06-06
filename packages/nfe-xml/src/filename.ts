/** Nome de arquivo sugerido para download do procNFe. */
export function nfeProcXmlFilename(numero: number, serie: number): string {
  return `nfe_${numero}_serie${serie}_v4.00.xml`;
}
