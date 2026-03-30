import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ResourceType, Action } from '@database/entities/permission.entity';

export class CheckPermissionDto {
  @ApiProperty({ example: 'user-uuid', description: 'ID de l\'utilisateur' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: ResourceType, description: 'Type de ressource' })
  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;

  @ApiProperty({ enum: Action, description: 'Action à effectuer' })
  @IsEnum(Action)
  @IsNotEmpty()
  action: Action;

  @ApiPropertyOptional({ example: 'resource-uuid', description: 'ID de la ressource spécifique' })
  @IsUUID()
  @IsOptional()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Contexte additionnel' })
  @IsOptional()
  context?: Record<string, any>;
}