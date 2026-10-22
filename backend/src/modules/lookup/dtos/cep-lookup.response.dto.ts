import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CepLookupResponseDTO {
  @ApiProperty({ example: "01001000" })
  cep!: string;

  @ApiProperty()
  logradouro!: string;

  @ApiProperty()
  bairro!: string;

  @ApiProperty()
  municipio!: string;

  @ApiPropertyOptional({ description: "Código IBGE do município" })
  codigoMunicipio?: string;

  @ApiProperty({ example: "SP" })
  uf!: string;
}
