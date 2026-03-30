import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ResourceType, Action, PermissionScope } from '@database/entities/permission.entity';

export class QueryPermissionsDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({ example: 'patient' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ResourceType })
  @IsEnum(ResourceType)
  @IsOptional()
  resourceType?: ResourceType;

  @ApiPropertyOptional({ enum: Action })
  @IsEnum(Action)
  @IsOptional()
  action?: Action;

  @ApiPropertyOptional({ enum: PermissionScope })
  @IsEnum(PermissionScope)
  @IsOptional()
  scope?: PermissionScope;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  requiresConsent?: boolean;

  @ApiPropertyOptional({ example: 'code' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'code';

  @ApiPropertyOptional({ example: 'ASC', enum: ['ASC', 'DESC'] })
  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}