import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CepLookupResponseDTO {
  @ApiProperty({ type: String, example: "01001000" })
  cep!: string;

  @ApiProperty({ type: String })
  logradouro!: string;

  @ApiProperty({ type: String })
  bairro!: string;

  @ApiProperty({ type: String })
  municipio!: string;

  @ApiPropertyOptional({ type: String, description: "Código IBGE do município" })
  codigoMunicipio?: string;

  @ApiProperty({ type: String, example: "SP" })
  uf!: string;
}
