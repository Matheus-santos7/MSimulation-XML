import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CnpjLookupResponseDTO {
  @ApiProperty()
  razaoSocial!: string;

  @ApiProperty()
  nomeFantasia!: string;

  @ApiProperty({ example: "12345678000199" })
  cnpj!: string;

  @ApiProperty()
  logradouro!: string;

  @ApiProperty()
  numero!: string;

  @ApiPropertyOptional()
  complemento?: string;

  @ApiProperty()
  bairro!: string;

  @ApiProperty()
  municipio!: string;

  @ApiProperty({ description: "Código IBGE do município" })
  codigoMunicipio!: string;

  @ApiProperty({ example: "SP" })
  uf!: string;

  @ApiProperty()
  cep!: string;

  @ApiPropertyOptional()
  telefone?: string;

  @ApiProperty({ description: "CRT inferido: 1 (Simples/MEI) ou 3 (regime normal)" })
  crt!: number;
}
