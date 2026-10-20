import type { FastifyReply } from "fastify";

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type FileResponse = {
  content: Buffer | string;
  contentType: string;
  /** Com nome, o arquivo vai como anexo (`Content-Disposition: attachment`). */
  fileName?: string;
};

/** Envia um arquivo cru (use com `@Res()`; o Nest não serializa essa resposta). */
export function sendFile(reply: FastifyReply, file: FileResponse): FastifyReply {
  const headers: Record<string, string> = { "Content-Type": file.contentType };
  if (file.fileName) {
    headers["Content-Disposition"] = `attachment; filename="${file.fileName}"`;
  }

  return reply.headers(headers).send(file.content);
}
