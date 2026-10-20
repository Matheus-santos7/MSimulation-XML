import { Module, type DynamicModule, type Type } from "@nestjs/common";
import { CoreModule, type CoreDependencies } from "./core.module.js";

/** Módulos de feature já migrados para o Nest (cada fase acrescenta um). */
const FEATURE_MODULES: Type[] = [];

@Module({})
export class AppModule {
  static register(dependencies: CoreDependencies): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.register(dependencies), ...FEATURE_MODULES],
    };
  }
}
