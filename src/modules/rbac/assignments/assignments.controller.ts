import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CreatePermissionOverrideDto } from './dto/permission-override.dto';
import { GrantTemporaryPermissionDto } from './dto/temporary-permission.dto';
import { EffectivePermissionsResponseDto } from './dto/effective-permissions-response.dto';
import { UpdateRoleAssignmentDto } from './dto/update-role-assignment.dto';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('RBAC - Assignments & Permissions')
@Controller('rbac')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * Assigner un rôle à un utilisateur
   */
  @Post('users/:userId/roles')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assigner un rôle à un utilisateur' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Rôle assigné' })
  async assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() assignRoleDto: AssignRoleDto,
    @Request() req,
  ) {
    return this.assignmentsService.assignRole(userId, assignRoleDto, req.user.sub);
  }

  /**
   * Retirer un rôle d'un utilisateur
   */
  @Delete('users/:assignmentId/roles')
  @ApiOperation({ summary: 'Retirer un rôle d\'un utilisateur' })
  @ApiParam({ name: 'assignmentId', type: 'string', format: 'uuid', description: 'ID de l\'attribution de rôle' })
  @ApiResponse({ status: 200, description: 'Rôle retiré' })
  async removeRole(@Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
    return this.assignmentsService.removeRole(assignmentId);
  }

  /**
   * update une attribution de rôle (expiration, active, scope)
   */
  @Patch('users/:assignmentId/roles')
  @ApiOperation({ summary: 'Mettre à jour une attribution de rôle (expiration, active, scope)' })
  @ApiParam({ name: 'assignmentId', type: String })
  @ApiBody({ type: UpdateRoleAssignmentDto })
  async updateAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() updateDto: UpdateRoleAssignmentDto,
  ) {
    return this.assignmentsService.updateAssignment(assignmentId, updateDto);
  }

  /**
   * Récupérer les permissions effectives d'un utilisateur
   */
  @Get('users/:userId/effective-permissions')
  @ApiOperation({ summary: 'Récupérer permissions effectives d\'un utilisateur' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Permissions effectives',
    type: EffectivePermissionsResponseDto,
  })
  async getEffectivePermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.assignmentsService.getEffectivePermissions(userId);
  }

  /**
   * Vérifier si un utilisateur a une permission
   */
  @Post('check-permission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier si un utilisateur possède une permission' })
  @ApiResponse({ status: 200, description: 'Résultat de la vérification' })
  async checkPermission(@Body() checkPermissionDto: CheckPermissionDto) {
    return this.assignmentsService.checkPermission(checkPermissionDto);
  }

  /**
   * Ajouter/Modifier permissions personnalisées pour un rôle d'utilisateur
   */
  @Patch('users/:userId/roles/:roleId/permissions')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Surcharger permissions d\'un rôle pour un utilisateur' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'roleId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Surcharge créée' })
  async addPermissionOverride(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() overrideDto: CreatePermissionOverrideDto,
    @Request() req,
  ) {
    return this.assignmentsService.addPermissionOverride(
      userId,
      roleId,
      overrideDto,
      req.user.sub,
    );
  }

  /**
   * Accorder une permission temporaire
   */
  @Post('users/:userId/temporary-permissions')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accorder permission temporaire à un utilisateur' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Permission temporaire accordée' })
  async grantTemporaryPermission(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() tempPermDto: GrantTemporaryPermissionDto,
    @Request() req,
  ) {
    return this.assignmentsService.grantTemporaryPermission(
      userId,
      tempPermDto,
      req.user.sub,
    );
  }

  /**
   * Lister toutes les surcharges actives d'un utilisateur
   */
  @Get('users/:userId/permission-overrides')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Lister surcharges de permissions d\'un utilisateur' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Liste des surcharges' })
  async getUserOverrides(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.assignmentsService.getUserOverrides(userId);
  }
}