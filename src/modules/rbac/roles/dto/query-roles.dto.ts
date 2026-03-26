import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoleType, ScopeType } from '@database/entities/role.entity';

export class QueryRolesDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'admin' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: RoleType })
  @IsEnum(RoleType)
  @IsOptional()
  roleType?: RoleType;

  @ApiPropertyOptional({ enum: ScopeType })
  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType;

  @ApiPropertyOptional({ example: 'uuid-scope' })
  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'name' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ example: 'ASC', enum: ['ASC', 'DESC'] })
  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
