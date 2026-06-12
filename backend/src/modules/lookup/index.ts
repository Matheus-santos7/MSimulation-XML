import { createLookupModule } from "./infrastructure/factory/lookup-module.factory.js";

export type { CepLookupResult } from "./domain/entities/cep-lookup-result.entity.js";
export type { CnpjLookupResult } from "./domain/entities/cnpj-lookup-result.entity.js";
export { LookupNotFoundError } from "./domain/errors/lookup-not-found.error.js";
export { LookupValidationError } from "./domain/errors/lookup-validation.error.js";
export { LookupCepUseCase } from "./application/use-cases/lookup-cep.use-case.js";
export { LookupCnpjUseCase } from "./application/use-cases/lookup-cnpj.use-case.js";
export { createLookupModule };
export { lookupController, lookupRoutes } from "./presentation/controllers/lookup.controller.js";
export { cepParamSchema, cnpjParamSchema } from "./presentation/schemas/lookup.schemas.js";

export async function lookupCep(rawValue: string) {
  return createLookupModule().lookupCep.execute(rawValue);
}

export async function lookupCnpj(rawValue: string) {
  return createLookupModule().lookupCnpj.execute(rawValue);
}
