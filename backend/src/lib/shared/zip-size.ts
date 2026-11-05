/**
 * Leitura do diretório central de um ZIP (.xlsx é um ZIP) para somar o tamanho
 * descompactado ANTES de entregar o arquivo ao `XLSX.read`.
 *
 * Por quê: o `XLSX.read` descompacta e lê o XML inteiro de forma síncrona. Um upload de
 * 15 MB muito comprimido (zip bomb) pode carregar centenas de MB de XML e travar o event
 * loop. Ler só o diretório central custa O(número de entradas) e não descompacta nada.
 *
 * Falha fechada: qualquer estrutura truncada, inválida ou zip64 devolve `null` e quem chama
 * recusa o arquivo. Uma planilha real do Excel/LibreOffice nunca precisa de zip64 no nosso teto.
 *
 * shortcut: confia nos tamanhos declarados no diretório central; um ZIP que mente o tamanho
 * ainda passa daqui. Se isso virar problema, descompactar em streaming com teto de bytes.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_ENTRY_SIGNATURE = 0x02014b50;
const EOCD_LENGTH = 22;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;
const CENTRAL_ENTRY_HEADER_LENGTH = 46;
/** Valor que o zip64 usa nos campos de 16/32 bits para dizer "veja o registro zip64". */
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;

/** Procura o End Of Central Directory de trás para frente (só pode haver o comentário depois dele). */
function findEndOfCentralDirectory(view: DataView): number {
  const lastStart = view.byteLength - EOCD_LENGTH;
  const firstStart = Math.max(0, lastStart - MAX_ZIP_COMMENT_LENGTH);

  for (let offset = lastStart; offset >= firstStart; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }

  return -1;
}

/**
 * Soma o tamanho descompactado declarado de todas as entradas do ZIP.
 * Devolve `null` quando o ZIP é inválido, truncado ou zip64 (quem chama deve recusar).
 */
export function sumZipUncompressedSize(data: Buffer | Uint8Array): number | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return null;

  const entryCount = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entryCount === ZIP64_MARKER_16 || directoryOffset === ZIP64_MARKER_32) return null;

  let offset = directoryOffset;
  let total = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + CENTRAL_ENTRY_HEADER_LENGTH > eocd) return null;
    if (view.getUint32(offset, true) !== CENTRAL_ENTRY_SIGNATURE) return null;

    const uncompressedSize = view.getUint32(offset + 24, true);
    if (uncompressedSize === ZIP64_MARKER_32) return null;

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    total += uncompressedSize;
    offset += CENTRAL_ENTRY_HEADER_LENGTH + nameLength + extraLength + commentLength;
  }

  return total;
}
