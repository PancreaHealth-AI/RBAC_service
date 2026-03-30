import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionOverridesService } from './permission-overrides.service';
import { PermissionOverridesController } from './permission-overrides.controller';
import { PermissionOverride } from '@database/entities/permission-override.entity';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { Permission } from '@database/entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionOverride, RoleAssignment, Permission]),
  ],
  controllers: [PermissionOverridesController],
  providers: [PermissionOverridesService],
  exports: [PermissionOverridesService],
})
export class PermissionOverridesModule {}