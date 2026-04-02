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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PermissionOverridesService } from './permission-overrides.service';
import { CreatePermissionOverrideDto } from './dto/create-override.dto';
import { UpdatePermissionOverrideDto } from './dto/update-override.dto';
import { QueryOverridesDto } from './dto/query-overrides.dto';
import { PermissionOverrideResponseDto } from './dto/override-response.dto';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('RBAC - Permission Overrides')
@Controller('rbac/permission-overrides')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PermissionOverridesController {
  constructor(
    private readonly permissionOverridesService: PermissionOverridesService,
  ) {}

  /**
   * Créer une surcharge de permission
   */
  @Post()
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une surcharge de permission' })
  @ApiResponse({
    status: 201,
    description: 'Surcharge créée',
    type: PermissionOverrideResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Surcharge déjà existante' })
  async create(
    @Body() createOverrideDto: CreatePermissionOverrideDto,
    @Request() req,
  ) {
    return this.permissionOverridesService.create(createOverrideDto, req.user.sub);
  }

  /**
   * Lister toutes les surcharges
   */
  @Get()
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Lister toutes les surcharges avec filtres' })
  @ApiResponse({
    status: 200,
    description: 'Liste des surcharges',
    type: [PermissionOverrideResponseDto],
  })
  async findAll(@Query() queryDto: QueryOverridesDto) {
    return this.permissionOverridesService.findAll(queryDto);
  }

  /**
   * Obtenir une surcharge par ID
   */
  @Get(':id')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Obtenir une surcharge par ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Surcharge trouvée',
    type: PermissionOverrideResponseDto,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionOverridesService.findOne(id);
  }

  /**
   * Mettre à jour une surcharge
   */
  @Put(':id')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mettre à jour une surcharge' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Surcharge mise à jour',
    type: PermissionOverrideResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOverrideDto: UpdatePermissionOverrideDto,
  ) {
    return this.permissionOverridesService.update(id, updateOverrideDto);
  }

  /**
   * Supprimer une surcharge
   */
  @Delete(':id')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une surcharge' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Surcharge supprimée' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionOverridesService.remove(id);
  }

  /**
   * Révoquer une surcharge
   */
  @Post(':id/revoke')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Révoquer une surcharge (marquer comme expirée)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Surcharge révoquée' })
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.permissionOverridesService.revoke(id, body?.reason);
  }

  /**
   * Récupérer toutes les surcharges d'un utilisateur
   */
  @Get('user/:userId')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Récupérer toutes les surcharges d\'un utilisateur' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Surcharges de l\'utilisateur' })
  async getUserOverrides(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.permissionOverridesService.getUserOverrides(
      userId,
    );
  }
  /**
   *    * Récupérer toutes les surcharges d'une affectation de rôle
   */
  @Get('assignment/:assignmentId')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Récupérer toutes les surcharges d\'une affectation de rôle' })
  @ApiParam({ name: 'assignmentId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Surcharges de l\'affectation de rôle' })
  async getAssignmentOverrides(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.permissionOverridesService.getAssignmentOverrides(
      assignmentId,
    );
  }

  /**
   * Récupérer toutes les surcharges pour une permission
   */
  @Get('permission/:permissionId')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Récupérer surcharges pour une permission' })
  @ApiParam({ name: 'permissionId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Surcharges de la permission' })
  async getPermissionOverrides(@Param('permissionId', ParseUUIDPipe) permissionId: string) {
    return this.permissionOverridesService.getPermissionOverrides(permissionId);
  }

  /**
   * Nettoyer les surcharges expirées
   */
  @Post('cleanup/expired')
  // @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nettoyer les surcharges expirées' })
  @ApiResponse({ status: 200, description: 'Surcharges nettoyées' })
  async cleanExpiredOverrides() {
    return this.permissionOverridesService.cleanExpiredOverrides();
  }

  /**
   * Statistiques des surcharges
   */
  @Get('stats/summary')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Statistiques des surcharges' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  async getStatistics() {
    return this.permissionOverridesService.getStatistics();
  }
}