---
paths:
  - "**/providers/**/*.ts"
---

# Providers HTTP

Pasta `backend/src/providers/<destino>/`, arquivo `<destino>.provider.ts`, para API externa (BrasilAPI, ViaCEP, OpenCNPJ, SEFAZ, Brevo). Classe `@Injectable()` estende `BaseProvider` (criada em `src/providers/` quando houver o segundo provider; até lá o provider usa `fetch` com timeout). Os módulos atuais fazem isso em `infrastructure/` atrás de um port.

- Construtor: `ConfigService` e o cliente HTTP. Repasse a `super(...)`.
- URL base é getter do config (`this.configService.apiUrlIntegration`), nunca string solta.
- Use os helpers do `BaseProvider`: `this.get`, `this.post`, `this.put`, `this.patch` (url, body, headers). `httpService.axiosRef` direto só existe em código legado.
- Toda chamada tem timeout. Credencial de API externa vem do `ConfigService`, nunca de string no código.
- Retorno é o corpo já validado (Zod ou DTO): resposta externa é dado não confiável. Falha: `Logger.error(error.message)` e `throw new BusinessException("<mensagem em português>")`.
- Método curto e nomeado (`lookupCnpj`, `getCep`). O módulo da feature registra o provider em `providers` e importa `HttpModule`.
- Tipos de payload ficam em `types.ts` ao lado do provider.
- O provider não instancia entidade nem abre transação. Quem orquestra é o use case.

```typescript
@Injectable()
export class IntegrationApiProvider extends BaseProvider {
  constructor(
    readonly configService: ConfigService,
    readonly httpService: HttpService,
  ) {
    super(configService, httpService);
  }

  updateStatus(data: NerusNotification, clientId: string) {
    return this.patch(
      `${this.configService.apiUrlIntegration}/order/update/status?clientId=${clientId}`,
      data,
      this.defineHeadersDirectCall(),
    )
      .then(res => res?.data)
      .catch(error => {
        Logger.error(error.message);
        throw new BusinessException(error.response?.data?.message);
      });
  }
}
```
