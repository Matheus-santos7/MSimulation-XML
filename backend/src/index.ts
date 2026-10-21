import "dotenv/config";
import { buildApp } from "./app.js";

const app = await buildApp();
app.enableShutdownHooks();

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen(port, host);
app
  .getHttpAdapter()
  .getInstance()
  .log.info(`API em http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
