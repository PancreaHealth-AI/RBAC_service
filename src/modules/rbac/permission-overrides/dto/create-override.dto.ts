import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { OverrideType } from '@database/entities/permission-override.entity';

export class CreatePermissionOverrideDto {

  @ApiProperty({ example: 'role-assignment-uuid', description: 'ID de l\'attribution de rôle' })
  @IsUUID()
  @IsNotEmpty()
  roleAssignmentId: string;

  @ApiProperty({ example: 'permission-uuid', description: 'ID de la permission' })
  @IsUUID()
  @IsNotEmpty()
  permissionId: string;

  @ApiProperty({ enum: OverrideType, description: 'Type de surcharge' })
  @IsEnum(OverrideType)
  @IsNotEmpty()
  overrideType: OverrideType;

  @ApiPropertyOptional({ example: 'Accès temporaire pour urgence', description: 'Raison de la surcharge' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z', description: 'Date d\'expiration' , format: 'date-time' , nullable: true })
  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}