import "dotenv/config";
import { buildApp } from "./app.js";
import { appConfig } from "./config/config.service.js";

const app = await buildApp();
app.enableShutdownHooks();

const port = Number(appConfig.port ?? 3001);
const host = appConfig.host ?? "0.0.0.0";

await app.listen(port, host);
app
  .getHttpAdapter()
  .getInstance()
  .log.info(`API em http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
