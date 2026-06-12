export interface NfeListItem {
  [key: string]: unknown;
}

export interface NfeDetail extends NfeListItem {
  cteChaveRef?: string;
  referenciadas: Array<{
    chave: string;
    tipo: string;
    numero: number;
    serie: number;
  }>;
}

export interface NfeXmlResult {
  xml: string;
  source: string;
  filename: string;
}

export interface NfeQueryPort {
  list(tenantId: string): Promise<NfeListItem[]>;
  getByAccessKey(tenantId: string, accessKey: string): Promise<NfeDetail | null>;
  resolveXml(tenantId: string, accessKey: string): Promise<NfeXmlResult | null>;
  getTipoWhenXmlMissing(tenantId: string, accessKey: string): Promise<string | null>;
}
