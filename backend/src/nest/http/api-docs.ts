import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { appConfig } from "../../config/config.service.js";

const API_DOCS_PATH = "api/docs";

/**
 * Documentação OpenAPI em `/api/docs`, gerada dos decorators `@ApiTags`/`@ApiProperty`.
 * Só liga com `API_DOCS_ENABLED=true`; produção e testes de contrato ficam sem as rotas.
 */
export function setupApiDocs(app: NestFastifyApplication): void {
  if (!appConfig.apiDocsEnabled) return;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("MSimulation XML API")
      .setDescription("Simulação de NF-e e CT-e para operações de marketplace")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(API_DOCS_PATH, app, document);
}
