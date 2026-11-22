import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  itemSize?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockCount: number;
}
