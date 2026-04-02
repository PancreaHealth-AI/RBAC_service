import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsOptional, IsObject } from 'class-validator';

export class AddPermissionsDto {
  @ApiProperty({ type: [String], example: ['permission-uuid-1', 'permission-uuid-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  constraints?: Record<string, any>;
}