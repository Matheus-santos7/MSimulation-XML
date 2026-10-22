import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CnpjLookupResponseDTO {
  @ApiProperty({ type: String })
  razaoSocial!: string;

  @ApiProperty({ type: String })
  nomeFantasia!: string;

  @ApiProperty({ type: String, example: "12345678000199" })
  cnpj!: string;

  @ApiProperty({ type: String })
  logradouro!: string;

  @ApiProperty({ type: String })
  numero!: string;

  @ApiPropertyOptional({ type: String })
  complemento?: string;

  @ApiProperty({ type: String })
  bairro!: string;

  @ApiProperty({ type: String })
  municipio!: string;

  @ApiProperty({ type: String, description: "Código IBGE do município" })
  codigoMunicipio!: string;

  @ApiProperty({ type: String, example: "SP" })
  uf!: string;

  @ApiProperty({ type: String })
  cep!: string;

  @ApiPropertyOptional({ type: String })
  telefone?: string;

  @ApiProperty({ type: Number, description: "CRT inferido: 1 (Simples/MEI) ou 3 (regime normal)" })
  crt!: number;
}
