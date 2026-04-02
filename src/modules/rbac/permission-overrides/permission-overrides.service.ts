import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PermissionOverride, OverrideType } from '@database/entities/permission-override.entity';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { Permission } from '@database/entities/permission.entity';
import { CreatePermissionOverrideDto } from './dto/create-override.dto';
import { UpdatePermissionOverrideDto } from './dto/update-override.dto';
import { QueryOverridesDto } from './dto/query-overrides.dto';

@Injectable()
export class PermissionOverridesService {
  constructor(
    @InjectRepository(PermissionOverride)
    private overrideRepository: Repository<PermissionOverride>,
    @InjectRepository(RoleAssignment)
    private roleAssignmentRepository: Repository<RoleAssignment>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  /**
   * Créer une surcharge de permission
   */
  async create(createOverrideDto: CreatePermissionOverrideDto, approvedBy: string) {
    const {  roleAssignmentId, permissionId, overrideType, reason, expiresAt } =
      createOverrideDto;

    // Vérifier que le role assignment existe
    const roleAssignment = await this.roleAssignmentRepository.findOne({
      where: { id: roleAssignmentId },
      relations: ['role'],
    });

    if (!roleAssignment) {
      throw new NotFoundException('Attribution de rôle non trouvée');
    }

    // Vérifier que la permission existe
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission non trouvée');
    }

    // Vérifier s'il existe déjà une surcharge active
    const existingOverride = await this.overrideRepository.findOne({
      where: {
        roleAssignmentId,
        permissionId,
      },
    });

    if (existingOverride && existingOverride.isActive) {
      throw new ConflictException(
        'Une surcharge active existe déjà pour cette permission sur ce rôle',
      );
    }

    // Créer la surcharge
    const override = this.overrideRepository.create({
      roleAssignmentId,
      permissionId,
      overrideType,
      reason,
      approvedBy,
      expiresAt: expiresAt ? new Date(expiresAt) : null as any,
    });

    const savedOverride = await this.overrideRepository.save(override);

    return this.findOne(savedOverride.id);
  }

  /**
   * Lister toutes les surcharges avec filtres
   */
  async findAll(queryDto: QueryOverridesDto) {
    const {
      page = 1,
      limit = 20,
      userId,
      roleAssignmentId,
      permissionId,
      overrideType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;
    
    const queryBuilder = this.overrideRepository
      .createQueryBuilder('override')
      .leftJoinAndSelect('override.permission', 'permission')
      .leftJoinAndSelect('override.roleAssignment', 'roleAssignment')
      .leftJoinAndSelect('roleAssignment.role', 'role');

    // Filtres
    if (roleAssignmentId) {
      queryBuilder.andWhere('override.roleAssignmentId = :roleAssignmentId', {
        roleAssignmentId,
      });
    }

    if (userId) {
      queryBuilder.andWhere('roleAssignment.userId = :userId', { userId });
    }

    if (permissionId) {
      queryBuilder.andWhere('override.permissionId = :permissionId', {
        permissionId,
      });
    }

    if (overrideType) {
      queryBuilder.andWhere('override.overrideType = :overrideType', {
        overrideType,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('override.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    // Tri
    queryBuilder.orderBy(`override.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [overrides, total] = await queryBuilder.getManyAndCount();
    // Enrichir les résultats
    const enrichedOverrides = overrides.map((override) => ({
      ...override,
      permission: {
        id: override.permission.id,
        code: override.permission.code,
        name: override.permission.name,
        resourceType: override.permission.resourceType,
        action: override.permission.action,
      },
      roleAssignment: {
        id: override.roleAssignment.id,
        userId: override.roleAssignment.userId,
        roleId: override.roleAssignment.roleId,
        roleName: override.roleAssignment.role.name,
      },
    }));

    return {
      data: enrichedOverrides,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtenir une surcharge par ID
   */
  async findOne(id: string) {
    const override = await this.overrideRepository.findOne({
      where: { id },
      relations: ['permission', 'roleAssignment', 'roleAssignment.role'],
    });

    if (!override) {
      throw new NotFoundException('Surcharge de permission non trouvée');
    }

    return {
      ...override,
      permission: {
        id: override.permission.id,
        code: override.permission.code,
        name: override.permission.name,
        resourceType: override.permission.resourceType,
        action: override.permission.action,
      },
      roleAssignment: {
        id: override.roleAssignment.id,
        userId: override.roleAssignment.userId,
        roleId: override.roleAssignment.roleId,
        roleName: override.roleAssignment.role.name,
      },
    };
  }

  /**
   * Mettre à jour une surcharge
   */
  async update(id: string, updateOverrideDto: UpdatePermissionOverrideDto) {
    const override = await this.overrideRepository.findOne({ where: { id } });

    if (!override) {
      throw new NotFoundException('Surcharge de permission non trouvée');
    }

    if (updateOverrideDto.expiresAt) {
      override.expiresAt = new Date(updateOverrideDto.expiresAt);
    }else if (updateOverrideDto.expiresAt === null) {
      override.expiresAt = null as any; // Permet de retirer la date d'expiration
    }

    if (updateOverrideDto.reason !== undefined) {
      override.reason = updateOverrideDto.reason;
    }

    if (updateOverrideDto.overrideType) {
      override.overrideType = updateOverrideDto.overrideType;
    }

    await this.overrideRepository.save(override);

    return this.findOne(id);
  }

  /**
   * Supprimer une surcharge
   */
  async remove(id: string) {
    const override = await this.overrideRepository.findOne({ where: { id } });

    if (!override) {
      throw new NotFoundException('Surcharge de permission non trouvée');
    }

    await this.overrideRepository.remove(override);

    return { message: 'Surcharge supprimée avec succès' };
  }

  /**
   * Révoquer une surcharge (marquer comme expirée)
   */
  async revoke(id: string, reason?: string) {
    const override = await this.overrideRepository.findOne({ where: { id } });

    if (!override) {
      throw new NotFoundException('Surcharge de permission non trouvée');
    }

    // Marquer comme expirée immédiatement
    override.expiresAt = new Date();
    if (reason) {
      override.reason = `${override.reason || ''} [RÉVOQUÉE: ${reason}]`;
    }

    await this.overrideRepository.save(override);

    return { message: 'Surcharge révoquée avec succès' };
  }

  /**
   * Récupérer toutes les surcharges d'un utilisateur
   */
  async getUserOverrides(userId: string) {
    const queryBuilder = this.overrideRepository
      .createQueryBuilder('override')
      .leftJoinAndSelect('override.permission', 'permission')
      .leftJoinAndSelect('override.roleAssignment', 'roleAssignment')
      .where('roleAssignment.userId = :userId', { userId });



    const overrides = await queryBuilder.getMany();

    return overrides.map((override) => ({
      id: override.id,
      permission: {
        id: override.permission.id,
        code: override.permission.code,
        name: override.permission.name,
      },
      overrideType: override.overrideType,
      reason: override.reason,
      expiresAt: override.expiresAt,
      createdAt: override.createdAt,
    }));
  }

  /**
   * Récupérer toutes les surcharges d'un utilisateur
   */
  async getAssignmentOverrides(assignmentId: string) {
    const queryBuilder = this.overrideRepository
      .createQueryBuilder('override')
      .leftJoinAndSelect('override.permission', 'permission')
      .leftJoinAndSelect('override.roleAssignment', 'roleAssignment')
      .where('roleAssignment.id = :assignmentId', { assignmentId });


    const overrides = await queryBuilder.getMany();

    return overrides.map((override) => ({
      id: override.id,
      permission: {
        id: override.permission.id,
        code: override.permission.code,
        name: override.permission.name,
      },
      overrideType: override.overrideType,
      reason: override.reason,
      expiresAt: override.expiresAt,
      createdAt: override.createdAt,
    }));
  }

  /**
   * Récupérer toutes les surcharges pour une permission
   */
  async getPermissionOverrides(permissionId: string) {
    const overrides = await this.overrideRepository.find({
      where: { permissionId },
      relations: ['roleAssignment', 'roleAssignment.role'],
      order: { createdAt: 'DESC' },
    });

    return overrides.map((override) => ({
      id: override.id,
      userId: override.roleAssignment.userId,
      roleName: override.roleAssignment.role.name,
      overrideType: override.overrideType,
      reason: override.reason,
      expiresAt: override.expiresAt,
    }));
  }

  /**
   * Nettoyer les surcharges expirées
   */
  async cleanExpiredOverrides() {
    const result = await this.overrideRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    return {
      message: `${result.affected || 0} surcharges expirées supprimées`,
    };
  }

  /**
   * Statistiques des surcharges
   */
  async getStatistics() {
    const total = await this.overrideRepository.count();

    const active = await this.overrideRepository
      .createQueryBuilder('override')
      .where('override.expiresAt IS NULL OR override.expiresAt > :now', {
        now: new Date(),
      })
      .getCount();

    const byType = await this.overrideRepository
      .createQueryBuilder('override')
      .select('override.overrideType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('override.overrideType')
      .getRawMany();

    return {
      total,
      active,
      expired: total - active,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count, 10);
        return acc;
      }, {}),
    };
  }
}