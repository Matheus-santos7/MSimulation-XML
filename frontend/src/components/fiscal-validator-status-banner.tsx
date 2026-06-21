// import { AlertTriangle } from "lucide-react";
// import type { FiscalValidatorStatusDto } from "@/lib/fiscal-api/validation-insights";

// type Props = {
//   status: FiscalValidatorStatusDto;
// };

// /** Alerta quando o validador MCP não está acessível (comum em produção sem deploy do serviço). */
// export function FiscalValidatorStatusBanner({ status }: Props) {
//   if (status.enabled && status.reachable) return null;

//   // const title = !status.enabled
//   //   ? "Validação MCP desabilitada"
//   //   : "Validador MCP indisponível";

//   // const detail = !status.enabled
//   //   ? "Configure FISCAL_VALIDATOR_ENABLED=true no backend de produção."
//   //   : `${status.message}. URL configurada: ${status.apiUrl}`;

//   return (
//     <div className="mb-6 border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 flex gap-3">
//       <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
//       <div className="space-y-1 text-sm">
//         <p className="font-semibold text-foreground">{title}</p>
//         <p className="text-muted-foreground">{detail}</p>
//         <p className="text-muted-foreground">
//           O backfill só altera o status quando o microsserviço responde. Em produção, suba o serviço{" "}
//           <code className="text-xs">mcp-fiscal-brasil</code> no Render e aponte{" "}
//           <code className="text-xs">FISCAL_VALIDATOR_URL</code> para ele.
//         </p>
//       </div>
//     </div>
//   );
// }
