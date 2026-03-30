import { ApiProperty } from '@nestjs/swagger';

export class EffectivePermissionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  resourceType: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  scope: string;

  @ApiProperty()
  source: 'role' | 'override';

  @ApiProperty()
  roleId?: string;

  @ApiProperty()
  roleName?: string;

  @ApiProperty()
  constraints?: Record<string, any>;
}

export class EffectivePermissionsResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [EffectivePermissionDto] })
  permissions: EffectivePermissionDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  roles: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}