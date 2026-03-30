import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePermissionOverrideDto } from './create-override.dto';

export class UpdatePermissionOverrideDto extends PartialType(
  OmitType(CreatePermissionOverrideDto, ['userId', 'roleAssignmentId', 'permissionId'] as const),
) {}