import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionOverrideResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  roleAssignmentId: string;

  @ApiProperty()
  permissionId: string;

  @ApiProperty()
  overrideType: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  permission?: {
    id: string;
    code: string;
    name: string;
    resourceType: string;
    action: string;
  };

  @ApiPropertyOptional()
  roleAssignment?: {
    id: string;
    userId: string;
    roleId: string;
    roleName: string;
  };
}