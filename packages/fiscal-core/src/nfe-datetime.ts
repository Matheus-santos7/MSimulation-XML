const NFE_DATETIME_WITH_OFFSET_RE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?([+-]\d{2}:\d{2})$/;

const NFE_TIMEZONE = "America/Sao_Paulo";
const NFE_OFFSET = "-03:00";

/**
 * Formata data/hora para tags NF-e/CT-e (dhEmi, dhSaiEnt, dhRecbto, dhEvento).
 * SEFAZ exige offset local (ex.: -03:00); sufixo "Z" (UTC) é inválido no schema.
 */
export function formatNfeDateTime(input: Date | string): string {
  if (typeof input === "string") {
    const trimmed = input.trim();
    const withOffset = trimmed.match(NFE_DATETIME_WITH_OFFSET_RE);
    if (withOffset) {
      return `${withOffset[1]}${withOffset[2]}`;
    }
  }

  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data/hora inválida para documento fiscal");
  }

  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: NFE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

  return `${local.replace(" ", "T")}${NFE_OFFSET}`;
}
