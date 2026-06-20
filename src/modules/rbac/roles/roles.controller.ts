import {
  Controller,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
  Req,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  Put,
  Delete,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';

import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { JwtGatewayGuard } from '../../../common/guards/jwt-gateway.guard';
import { QueryRolesDto } from './dto/query-roles.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsDto } from './dto/add-permissions.dto';
import { RemovePermissionsDto } from './dto/remove-permissions.dto';
import { Permission } from '../../../common/decorators/permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';

@ApiTags('RBAC - Roles')
@Controller('rbac/roles')
@ApiBearerAuth()
@UseGuards(PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) { }

  @Post()
  @Permission('role.create')
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @Req() req: Request,
  ) {

    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }

    const userId = req.user.sub;
    return this.rolesService.create(createRoleDto, userId);
  }
  // @Post()
  // async create(@Body() createRoleDto: CreateRoleDto, @Req() req: Request) {
  //   const userIdHeader = req.headers['x-user-id'];
  //   const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
  //       console.log("userId 1:" , userId)

  //   if (!userId) {
  //     throw new UnauthorizedException('User not identified');
  //   }
  //   // Si besoin, vous pouvez aussi lire :
  //   // const email = req.headers['x-user-email'];
  //   // const roles = req.headers['x-user-roles'] ? JSON.parse(req.headers['x-user-roles']) : [];
  //   console.log("userId:" , userId)
  //   return this.rolesService.create(createRoleDto, userId);
  // }
  // @Post()
  // async create(@Body() createRoleDto: CreateRoleDto, @Req() req: Request) {
  //   console.log("user:" , req.user!.id)
  //   if (!req.user) {
  //     throw new UnauthorizedException('User not found');
  //   }
  //   const userId = req.user.id; 
  //   const userEmail = req.user.email;
  //   const userRoles = req.user.roles;
  //   // ...
  //   return this.rolesService.create(createRoleDto, userId);
  // }
  // @Post()
  // async create(@Body() createRoleDto: CreateRoleDto, @Request() req: Request) {
  //   console.log("req headers:", req.headers);
  //   const userId = req.headers['x-user-id']; // ← correction ici
  //   console.log("User ID from headers:", userId);

  //   if (!userId) {
  //     throw new UnauthorizedException('User not identified');
  //   }

  //   return this.rolesService.create(createRoleDto, userId);
  // }

  /**
   * Lister tous les rôles
   */
  @Get()
  @Permission('role.read')
  //   @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Lister tous les rôles avec filtres' })
  @ApiResponse({ status: 200, description: 'Liste des rôles' })
  async findAll(@Query() queryDto: QueryRolesDto) {
    return this.rolesService.findAll(queryDto);
  }

  /**
   * Obtenir un rôle par ID
   */
  @Get(':id')
  @Permission('role.read')
  //   @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Obtenir un rôle par ID avec ses permissions' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Rôle trouvé', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  /**
   * Mettre à jour un rôle
   */
  @Put(':id')
  @Permission('role.update')
  //   @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mettre à jour un rôle' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, updateRoleDto);
  }

  /**
   * Supprimer un rôle
   */
  @Delete(':id')
  @Permission('role.delete')
  //   @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un rôle (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Rôle supprimé' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  /**
   * Ajouter une permission à un rôle
   */
  @Post(':id/permissions/:permissionId')
  @Permission('role.update')
  //   @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Ajouter une permission à un rôle' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'permissionId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Permission ajoutée' })
  async addPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Body() body?: { constraints?: Record<string, any> },
  ) {
    return this.rolesService.addPermission(id, permissionId, body?.constraints);
  }

  /**
   * Retirer une permission d'un rôle
   */
  @Delete(':id/permissions/:permissionId')
  @Permission('role.update')
  //   @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer une permission d\'un rôle' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'permissionId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Permission retirée' })
  async removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rolesService.removePermission(id, permissionId);
  }

  /**
   * Ajouter plusieurs permissions à un rôle
   */
  @Post(':id/permissions')
  @Permission('role.update')
  @ApiOperation({ summary: 'Ajouter plusieurs permissions à un rôle' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: AddPermissionsDto })
  @ApiResponse({ status: 200, description: 'Permissions ajoutées' })
  async addPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addPermissionsDto: AddPermissionsDto,
  ) {
    return this.rolesService.addPermissions(
      id,
      addPermissionsDto.permissionIds,
      addPermissionsDto.constraints,
    );
  }

  /**
   * Retirer plusieurs permissions d'un rôle
   */
  @Delete(':id/permissions')
  @Permission('role.update')
  @ApiOperation({ summary: 'Retirer plusieurs permissions d\'un rôle' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: RemovePermissionsDto })
  @ApiResponse({ status: 200, description: 'Permissions retirées' })
  async removePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() removePermissionsDto: RemovePermissionsDto,
  ) {
    return this.rolesService.removePermissions(id, removePermissionsDto.permissionIds);
  }

  /**
   * Cloner un rôle
   */
  @Post(':id/clone')
  @Permission('role.create')
  @ApiOperation({ summary: 'Cloner un rôle existant vers un nouveau rôle' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newName: { type: 'string', example: 'Admin Service' },
        newCode: { type: 'string', example: 'ADMIN_SERVICE' },
        newScopeType: { type: 'string', enum: ['GLOBAL', 'HOSPITAL', 'DEPARTMENT', 'SERVICE'], example: 'SERVICE' },
        newScopeId: { type: 'string', format: 'uuid', nullable: true, example: 'abc-123' }
      },
      required: ['newName', 'newCode', 'newScopeType']
    }
  })
  @ApiResponse({ status: 201, description: 'Rôle cloné avec succès', type: RoleResponseDto })
  async cloneRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cloneDto: {
      newName: string;
      newCode: string;
      newScopeType: string;
      newScopeId?: string;
    },
  ) {
    return this.rolesService.cloneRole(
      id,
      cloneDto.newName,
      cloneDto.newCode,
      cloneDto.newScopeType,
      cloneDto.newScopeId,
    );
  }
}