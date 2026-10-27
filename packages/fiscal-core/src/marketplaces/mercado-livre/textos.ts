/** Alinha o sufixo OLSS do `obsContXTexto` ao `idCadIntTran` resolvido. */
export function syncObsContXTextoWarehouseSuffix(
  payload: Record<string, unknown>,
  warehouseId: string,
): void {
  const xTexto = payload.obsContXTexto;
  if (typeof xTexto !== "string" || !warehouseId.trim()) return;
  payload.obsContXTexto = xTexto.replace(/OLSS-\d+$/, `OLSS-${warehouseId.trim()}`);
}
