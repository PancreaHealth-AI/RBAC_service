import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { Role } from '@database/entities/role.entity';
import { Permission } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { console } from 'inspector';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
  ) {}

  /**
   * Créer un nouveau rôle
   */
  async create(createRoleDto: CreateRoleDto, createdBy: string) {
    console.log("createBy:", createdBy)
    // Vérifier si le code ou le nom existe déjà
    const existingRole = await this.roleRepository.findOne({
      where: [
        { code: createRoleDto.code, deletedAt: IsNull() },
        { name: createRoleDto.name, deletedAt: IsNull() },
      ],
    });
    console.log("existingRole:", existingRole)
    if (existingRole) {
      const conflictField = existingRole.code === createRoleDto.code ? 'code' : 'nom';
      throw new ConflictException(`Un rôle avec ce ${conflictField} existe déjà`);
    }

    // Créer le rôle
    const role = this.roleRepository.create({
      ...createRoleDto,
      createdBy,
    });
    const savedRole = await this.roleRepository.save(role);
    console.log("saved role : ", savedRole)
    // Assigner les permissions si fournies
    if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
      await this.assignPermissions(savedRole.id, createRoleDto.permissionIds);
    }

    return this.findOne(savedRole.id);
  }

  /**
   * Lister tous les rôles avec filtres
   */
  async findAll(queryDto: QueryRolesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      roleType,
      scopeType,
      scopeId,
      isActive,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = queryDto;

    const queryBuilder = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.rolePermissions', 'rolePermission')
      .leftJoinAndSelect('rolePermission.permission', 'permission');

    // Filtres
    if (search) {
      queryBuilder.andWhere(
        '(role.name ILIKE :search OR role.code ILIKE :search OR role.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (roleType) {
      queryBuilder.andWhere('role.roleType = :roleType', { roleType });
    }

    if (scopeType) {
      queryBuilder.andWhere('role.scopeType = :scopeType', { scopeType });
    }

    if (scopeId) {
      queryBuilder.andWhere('role.scopeId = :scopeId', { scopeId });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('role.isActive = :isActive', { isActive });
    }

    // Exclure les rôles supprimés
    queryBuilder.andWhere('role.deletedAt IS NULL');

    // Tri
    queryBuilder.orderBy(`role.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [roles, total] = await queryBuilder.getManyAndCount();

    // Enrichir avec le compte de permissions
    const enrichedRoles = await Promise.all(
      roles.map(async (role) => {
        const permissionsCount = await this.rolePermissionRepository.count({
          where: { roleId: role.id, isGranted: true },
        });

        return {
          ...role,
          permissionsCount,
        };
      }),
    );

    return {
      data: enrichedRoles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtenir un rôle par ID
   */
  async findOne(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!role) {
      throw new NotFoundException('Rôle non trouvé');
    }

    // Récupérer les permissions du rôle
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: id },
      relations: ['permission'],
    });

    const permissions = rolePermissions.map((rp) => ({
      id: rp.permission.id,
      code: rp.permission.code,
      name: rp.permission.name,
      resourceType: rp.permission.resourceType,
      action: rp.permission.action,
      isGranted: rp.isGranted,
      constraints: rp.constraints,
    }));

    return {
      ...role,
      permissions,
      permissionsCount: rolePermissions.filter((rp) => rp.isGranted).length,
    };
  }

  /**
   * Mettre à jour un rôle
   */
  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!role) {
      throw new NotFoundException('Rôle non trouvé');
    }

    // Mettre à jour les champs de base
    Object.assign(role, updateRoleDto);
    await this.roleRepository.save(role);

    // Mettre à jour les permissions si fournies
    if (updateRoleDto.permissionIds) {
      // Supprimer les anciennes permissions
      await this.rolePermissionRepository.delete({ roleId: id });

      // Ajouter les nouvelles permissions
      if (updateRoleDto.permissionIds.length > 0) {
        await this.assignPermissions(id, updateRoleDto.permissionIds);
      }
    }

    return this.findOne(id);
  }

  /**
   * Supprimer un rôle (soft delete)
   */
  async remove(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!role) {
      throw new NotFoundException('Rôle non trouvé');
    }

    // Vérifier si le rôle est utilisé
    // TODO: Vérifier avec RoleAssignment
    // const assignmentsCount = await this.roleAssignmentRepository.count({
    //   where: { roleId: id, isActive: true },
    // });

    // if (assignmentsCount > 0) {
    //   throw new BadRequestException(
    //     'Ce rôle ne peut pas être supprimé car il est assigné à des utilisateurs',
    //   );
    // }

    // Soft delete
    role.deletedAt = new Date();
    role.isActive = false;
    await this.roleRepository.save(role);

    return { message: 'Rôle supprimé avec succès' };
  }

  /**
   * Assigner des permissions à un rôle
   */
  private async assignPermissions(roleId: string, permissionIds: string[]) {
    // Vérifier que toutes les permissions existent
    const permissions = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Certaines permissions sont invalides');
    }

    // Créer les liens role-permission
    const rolePermissions = permissionIds.map((permissionId) =>
      this.rolePermissionRepository.create({
        roleId,
        permissionId,
        isGranted: true,
      }),
    );

    await this.rolePermissionRepository.save(rolePermissions);
  }

  /**
   * Ajouter une permission à un rôle
   */
  async addPermission(
    roleId: string,
    permissionId: string,
    constraints?: Record<string, any>,
  ) {
    const role = await this.findOne(roleId);

    // Vérifier que la permission existe
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission non trouvée');
    }

    // Vérifier si la permission est déjà assignée
    const existingRolePermission = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (existingRolePermission) {
      // Mettre à jour
      existingRolePermission.isGranted = true;
      existingRolePermission.constraints = constraints || null;
      await this.rolePermissionRepository.save(existingRolePermission);
    } else {
      // Créer
      const rolePermission = this.rolePermissionRepository.create({
        roleId,
        permissionId,
        isGranted: true,
        constraints,
      });
      await this.rolePermissionRepository.save(rolePermission);
    }

    return this.findOne(roleId);
  }

  /**
   * Retirer une permission d'un rôle
   */
  async removePermission(roleId: string, permissionId: string) {
    const role = await this.findOne(roleId);

    const rolePermission = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (!rolePermission) {
      throw new NotFoundException('Permission non trouvée dans ce rôle');
    }

    await this.rolePermissionRepository.delete({ roleId, permissionId });

    return this.findOne(roleId);
  }

  /**
   * Cloner un rôle pour une nouvelle portée
   */
  async cloneRole(
    sourceRoleId: string,
    newName: string,
    newCode: string,
    newScopeType: string,
    newScopeId?: string,
  ) {
    const sourceRole = await this.findOne(sourceRoleId);

    // Créer le nouveau rôle
    const newRole = this.roleRepository.create({
      name: newName,
      code: newCode,
      description: `Copie de ${sourceRole.name}`,
      roleType: sourceRole.roleType,
      scopeType: newScopeType as any,
      scopeId: newScopeId,
      isActive: true,
    });

    const savedNewRole = await this.roleRepository.save(newRole);

    // Copier les permissions
    const sourcePermissions = await this.rolePermissionRepository.find({
      where: { roleId: sourceRoleId },
    });

    const newPermissions = sourcePermissions.map((sp) =>
      this.rolePermissionRepository.create({
        roleId: savedNewRole.id,
        permissionId: sp.permissionId,
        isGranted: sp.isGranted,
        constraints: sp.constraints,
      }),
    );

    await this.rolePermissionRepository.save(newPermissions);

    return this.findOne(savedNewRole.id);
  }

  /**
   * Ajouter plusieurs permissions à un rôle
   */
  async addPermissions(
    roleId: string,
    permissionIds: string[],
    constraints?: Record<string, any>,
  ) {
    const role = await this.findOne(roleId);

    // Vérifier que toutes les permissions existent
    const permissions = await this.permissionRepository.findByIds(permissionIds);
    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('Une ou plusieurs permissions sont introuvables');
    }

    // Pour chaque permission, créer ou mettre à jour l'association
    const results: Array<{ permissionId: string; status: string }> = [];
    for (const permissionId of permissionIds) {
      const existing = await this.rolePermissionRepository.findOne({
        where: { roleId, permissionId },
      });
      if (existing) {
        existing.isGranted = true;
        if (constraints) existing.constraints = constraints;
        await this.rolePermissionRepository.save(existing);
        results.push({ permissionId, status: 'updated' });
      } else {
        const newRolePerm = this.rolePermissionRepository.create({
          roleId,
          permissionId,
          isGranted: true,
          constraints,
        });
        await this.rolePermissionRepository.save(newRolePerm);
        results.push({ permissionId, status: 'added' });
      }
    }

    return { message: `${results.length} permission(s) ajoutée(s)`, results };
  }

  /**
   * Retirer plusieurs permissions d'un rôle
   */
  async removePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.findOne(roleId);

    const result = await this.rolePermissionRepository
      .createQueryBuilder()
      .delete()
      .where('roleId = :roleId AND permissionId IN (:...permissionIds)', { roleId, permissionIds })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException('Aucune permission trouvée pour ce rôle');
    }

    return { message: `${result.affected} permission(s) retirée(s)` };
  }


  
}