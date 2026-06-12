export interface CteListItem {
  [key: string]: unknown;
}

export interface CteXmlResult {
  xml: string;
  source: string;
  filename: string;
}

export interface CteQueryPort {
  list(tenantId: string): Promise<CteListItem[]>;
  getByAccessKey(tenantId: string, accessKey: string): Promise<CteListItem | null>;
  resolveXml(tenantId: string, accessKey: string): Promise<CteXmlResult | null>;
  exists(tenantId: string, accessKey: string): Promise<boolean>;
}
