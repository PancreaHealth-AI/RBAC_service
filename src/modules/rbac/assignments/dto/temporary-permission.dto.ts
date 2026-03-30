import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsDateString } from 'class-validator';

export class GrantTemporaryPermissionDto {
  @ApiProperty({ example: 'permission-uuid', description: 'ID de la permission' })
  @IsUUID()
  @IsNotEmpty()
  permissionId: string;

  @ApiProperty({ example: '2024-12-31T23:59:59Z', description: 'Date d\'expiration' })
  @IsDateString()
  @IsNotEmpty()
  expiresAt: string;

  @ApiProperty({ example: 'Accès urgence', description: 'Raison' })
  @IsNotEmpty()
  reason: string;
}