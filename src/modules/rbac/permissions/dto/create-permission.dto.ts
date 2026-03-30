import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ResourceType, Action, PermissionScope } from '@database/entities/permission.entity';

export class CreatePermissionDto {
  @ApiProperty({ example: 'PATIENT_EXPORT', description: 'Code unique de la permission' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 'Exporter données patient', description: 'Nom de la permission' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: ResourceType, example: ResourceType.PATIENT })
  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;

  @ApiProperty({ enum: Action, example: Action.EXPORT })
  @IsEnum(Action)
  @IsNotEmpty()
  action: Action;

  @ApiProperty({ enum: PermissionScope, example: PermissionScope.HOSPITAL })
  @IsEnum(PermissionScope)
  @IsNotEmpty()
  scope: PermissionScope;

  @ApiPropertyOptional({ example: true, description: 'Nécessite consentement patient' })
  @IsBoolean()
  @IsOptional()
  requiresConsent?: boolean;

  @ApiPropertyOptional({ example: 'Permet d\'exporter les données patient' })
  @IsString()
  @IsOptional()
  description?: string;
}