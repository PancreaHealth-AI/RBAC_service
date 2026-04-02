import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class RemovePermissionsDto {
  @ApiProperty({ type: [String], example: ['permission-uuid-1', 'permission-uuid-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}