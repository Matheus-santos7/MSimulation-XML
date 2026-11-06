/** Conexões abertas no boot: cobrem as chamadas em paralelo de uma tela (ex.: /nfe faz 3). */
export const DB_POOL_WARM_CONNECTIONS = 4;

type WarmablePool = {
  connect(): Promise<{ release(): void }>;
};

/**
 * Abre `count` conexões ao mesmo tempo e as devolve ao pool, que as mantém ociosas. Cada conexão
 * nova ao Neon custa ~1 s (TCP + TLS + autenticação); sem isso a primeira tela paga esse custo
 * uma vez por chamada em paralelo. Devolve quantas abriram: falha parcial não é erro.
 */
export async function warmUpPool(pool: WarmablePool, count: number): Promise<number> {
  const results = await Promise.allSettled(Array.from({ length: count }, () => pool.connect()));
  let connected = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      result.value.release();
      connected += 1;
    }
  }

  return connected;
}
