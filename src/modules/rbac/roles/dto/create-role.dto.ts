import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { RoleType, ScopeType } from '@database/entities/role.entity';

export class CreateRoleDto {
  @ApiProperty({ example: 'Infirmier', description: 'Nom du rôle' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'INFIRMIER', description: 'Code unique du rôle' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'Rôle pour les infirmiers' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: RoleType, example: RoleType.SYSTEM })
  @IsEnum(RoleType)
  @IsNotEmpty()
  roleType: RoleType;

  @ApiProperty({ enum: ScopeType, example: ScopeType.GLOBAL })
  @IsEnum(ScopeType)
  @IsNotEmpty()
  scopeType: ScopeType;

  @ApiPropertyOptional({ example: 'uuid-hospital' })
  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ type: [String], example: ['perm-id-1', 'perm-id-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  permissionIds?: string[];
}