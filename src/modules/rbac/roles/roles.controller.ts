import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { RoleResponseDto } from './dto/role-response.dto';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('RBAC - Roles')
@Controller('rbac/roles')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * Créer un nouveau rôle
   */
  @Post()
//   @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouveau rôle' })
  @ApiResponse({ status: 201, description: 'Rôle créé', type: RoleResponseDto })
  @ApiResponse({ status: 409, description: 'Code de rôle déjà utilisé' })
@Post()
async create(@Body() createRoleDto: CreateRoleDto, @Request() req: Request) {
  console.log("req headers:", req.headers);
  const userId = req.headers['x-user-id']; // ← correction ici
  console.log("User ID from headers:", userId);

  if (!userId) {
    throw new UnauthorizedException('User not identified');
  }

  return this.rolesService.create(createRoleDto, userId);
}

  /**
   * Lister tous les rôles
   */
  @Get()
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
}