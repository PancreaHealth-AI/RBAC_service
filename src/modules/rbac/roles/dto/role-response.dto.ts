import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  roleType: string;

  @ApiProperty()
  scopeType: string;

  @ApiPropertyOptional()
  scopeId?: string;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  permissionsCount?: number;

  @ApiPropertyOptional()
  permissions?: Array<{
    id: string;
    code: string;
    name: string;
    isGranted: boolean;
  }>;
}