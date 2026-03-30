import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionResponseDto {
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
  requiresConsent: boolean;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: Date;
}