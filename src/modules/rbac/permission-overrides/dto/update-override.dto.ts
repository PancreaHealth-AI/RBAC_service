import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePermissionOverrideDto } from './create-override.dto';

export class UpdatePermissionOverrideDto extends PartialType(
  OmitType(CreatePermissionOverrideDto, [ 'roleAssignmentId', 'permissionId'] as const),
) {}