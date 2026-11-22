import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
