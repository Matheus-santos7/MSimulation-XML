import "reflect-metadata";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../../lib/http/http-error.js";
import { ClassValidatorPipe } from "../class-validator.pipe.js";

class AddressDTO {
  @IsString({ message: "Informe a cidade" })
  city!: string;
}

class CreateItemDTO {
  // O decorator mais perto do campo é checado primeiro.
  @MinLength(3, { message: "O nome precisa de 3 letras ou mais" })
  @IsString({ message: "Informe o nome" })
  name!: string;

  @Type(() => Number)
  @Min(1, { message: "A quantidade mínima é 1" })
  @IsInt({ message: "A quantidade precisa ser um número inteiro" })
  quantity!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDTO)
  address?: AddressDTO;
}

function captureError(run: () => unknown): HttpError {
  try {
    run();
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error("expected the pipe to throw");
}

describe("ClassValidatorPipe", () => {
  it("should return a DTO instance with converted fields and without unknown keys", () => {
    // Arrange
    const pipe = new ClassValidatorPipe(CreateItemDTO);

    // Act
    const result = pipe.transform({ name: "Caneta", quantity: "2", extra: "x" });

    // Assert
    expect(result).toBeInstanceOf(CreateItemDTO);
    expect(result).toEqual({ name: "Caneta", quantity: 2 });
  });

  it("should answer 400 with the first message and the messages by field (Zod flatten format)", () => {
    // Arrange
    const pipe = new ClassValidatorPipe(CreateItemDTO);

    // Act
    const error = captureError(() => pipe.transform({ name: "ab", quantity: 0 }));

    // Assert
    expect(error.status).toBe(400);
    expect(error.body).toEqual({
      error: "O nome precisa de 3 letras ou mais",
      details: {
        name: ["O nome precisa de 3 letras ou mais"],
        quantity: ["A quantidade mínima é 1"],
      },
    });
  });

  it("should group nested errors under the top-level field", () => {
    // Arrange
    const pipe = new ClassValidatorPipe(CreateItemDTO);

    // Act
    const error = captureError(() =>
      pipe.transform({ name: "Caneta", quantity: 1, address: { city: 10 } }),
    );

    // Assert
    expect(error.body?.details).toEqual({ address: ["Informe a cidade"] });
  });

  it("should treat a missing body as an empty object", () => {
    // Arrange
    const pipe = new ClassValidatorPipe(CreateItemDTO);

    // Act
    const error = captureError(() => pipe.transform(undefined));

    // Assert
    expect(error.body?.error).toBe("Informe o nome");
  });

  it("should use the fixed message and the formErrors/fieldErrors shape when invalidMessage is set", () => {
    // Arrange
    const pipe = new ClassValidatorPipe(CreateItemDTO, { invalidMessage: "Movimentação inválida" });

    // Act
    const error = captureError(() => pipe.transform({ name: "Caneta", quantity: 0 }));

    // Assert
    expect(error.body).toEqual({
      error: "Movimentação inválida",
      details: { formErrors: [], fieldErrors: { quantity: ["A quantidade mínima é 1"] } },
    });
  });
});
