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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { QueryPermissionsDto } from './dto/query-permissions.dto';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { JwtGatewayGuard } from '../../../common/guards/jwt-gateway.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { ResourceType } from '@database/entities/permission.entity';
import { Permission } from '../../../common/decorators/permission.decorator';

@ApiTags('RBAC - Permissions')
@Controller('rbac/permissions')
@UseGuards(PermissionGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) { }

  /**
   * Créer une nouvelle permission
   */
  @Post()
  @Permission('permission.create')
  // @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle permission' })
  @ApiResponse({
    status: 201,
    description: 'Permission créée',
    type: PermissionResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Code de permission déjà utilisé' })
  async create(@Req() req: any, @Body() createPermissionDto: CreatePermissionDto) {
    const createBy = req.user.sub; // Récupérer l'ID de l'utilisateur à partir du token JWT
    return this.permissionsService.create(createPermissionDto, createBy);
  }

  /**
   * Lister toutes les permissions système
   */
  @Get()
  @Permission('permission.read')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Lister toutes les permissions système' })
  @ApiResponse({
    status: 200,
    description: 'Liste des permissions',
    type: [PermissionResponseDto],
  })
  async findAll(@Query() queryDto: QueryPermissionsDto) {
    return this.permissionsService.findAll(queryDto);
  }

  /**
   * Obtenir une permission par ID
   */
  @Get(':id')
  @Permission('permission.read')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Obtenir une permission par ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Permission trouvée',
    type: PermissionResponseDto,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.findOne(id);
  }

  /**
   * Mettre à jour une permission
   */
  @Put(':id')
  @Permission('permission.update')
  // @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Mettre à jour une permission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Permission mise à jour',
    type: PermissionResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  /**
   * Supprimer une permission
   */
  @Delete(':id')
  @Permission('permission.delete')
  // @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une permission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Permission supprimée' })
  @ApiResponse({
    status: 400,
    description: 'Permission utilisée par des rôles',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.remove(id);
  }

  /**
   * Initialiser les permissions système (seed)
   */
  @Post('seed')
  @Permission('permission.create')
  // @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialiser les permissions système (seed)' })
  @ApiResponse({ status: 200, description: 'Permissions initialisées' })
  async seedPermissions() {
    return this.permissionsService.seedPermissions();
  }

  /**
   * Récupérer les permissions par ressource
   */
  @Get('resource/:resourceType')
  @Permission('permission.read')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Récupérer permissions par type de ressource' })
  @ApiParam({ name: 'resourceType', enum: ResourceType })
  @ApiResponse({ status: 200, description: 'Permissions de la ressource' })
  async findByResource(@Param('resourceType') resourceType: ResourceType) {
    return this.permissionsService.findByResource(resourceType);
  }

  /**
   * Grouper les permissions par ressource
   */
  @Get('grouped/by-resource')
  @Permission('permission.read')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Grouper permissions par ressource' })
  @ApiResponse({ status: 200, description: 'Permissions groupées' })
  async groupByResource() {
    return this.permissionsService.groupByResource();
  }

  /**
   * Obtenir tous les endpoints sécurisés par @Permission groupés par contrôleur
   */
  @Get('by-controller')
  @Permission('permission.read')
  @ApiOperation({ summary: 'Obtenir tous les endpoints sécurisés par @Permission groupés par contrôleur' })
  @ApiResponse({ status: 200, description: 'Liste des endpoints sécurisés par contrôleur' })
  async getEndpointsByController() {
    return this.permissionsService.getEndpointsByController();
  }

  /**
   * Récupérer toutes les permissions d'un rôle
   */
  @Get('role/:roleId')
  @Permission('permission.read')
  // @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Récupérer toutes les permissions d\'un rôle' })
  @ApiParam({ name: 'roleId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Permissions du rôle' })
  async getPermissionsByRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.permissionsService.getPermissionsByRole(roleId);
  }
}