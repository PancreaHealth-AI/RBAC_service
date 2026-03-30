import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ScopeType } from '@database/entities/role.entity';

export class AssignRoleDto {
  @ApiProperty({ example: 'role-uuid', description: 'ID du rôle à assigner' })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @ApiPropertyOptional({ enum: ScopeType, description: 'Type de portée' })
  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType;

  @ApiPropertyOptional({ example: 'scope-uuid', description: 'ID de la portée (hospital, department, etc.)' })
  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59Z', description: 'Date d\'expiration' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}