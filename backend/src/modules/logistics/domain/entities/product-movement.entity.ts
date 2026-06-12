export type ProductMovement = {
  id: string;
  tipoOperacao: string;
  quantidade: number;
  unidadeOrigemId?: string;
  unidadeDestinoId?: string;
  unidadeOrigem?: { codigo: string; nome: string };
  unidadeDestino?: { codigo: string; nome: string };
  nfeId: string;
  nfeSecundariaId?: string;
  nfe?: { chave: string; tipo: string; numero: number; serie: number };
  nfeSecundaria?: { chave: string; tipo: string; numero: number; serie: number };
  observacao?: string;
  createdAt: string;
};
