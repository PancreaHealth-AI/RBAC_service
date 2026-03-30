import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { PermissionOverride } from '@database/entities/permission-override.entity';
import { Role } from '@database/entities/role.entity';
import { Permission } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleAssignment,
      PermissionOverride,
      Role,
      Permission,
      RolePermission,
    ]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}