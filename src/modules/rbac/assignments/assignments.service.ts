import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { PermissionOverride, OverrideType } from '@database/entities/permission-override.entity';
import { Role } from '@database/entities/role.entity';
import { Permission } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CreatePermissionOverrideDto } from './dto/permission-override.dto';
import { GrantTemporaryPermissionDto } from './dto/temporary-permission.dto';
import { UpdateRoleAssignmentDto } from './dto/update-role-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(RoleAssignment)
    private roleAssignmentRepository: Repository<RoleAssignment>,
    @InjectRepository(PermissionOverride)
    private permissionOverrideRepository: Repository<PermissionOverride>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
  ) {}

  /**
   * Assigner un rôle à un utilisateur
   */
  async assignRole(userId: string, assignRoleDto: AssignRoleDto, assignedBy: string) {
    const { roleId, scopeType, scopeId, expiresAt } = assignRoleDto;

    // Vérifier que le rôle existe
    const role = await this.roleRepository.findOne({
      where: { id: roleId, isActive: true },
    });

    if (!role) {
      throw new NotFoundException('Rôle non trouvé ou inactif');
    }

    // Vérifier si l'utilisateur a déjà ce rôle avec cette portée
    const existingAssignment = await this.roleAssignmentRepository.findOne({
      where: {
        userId,
        roleId,
        scopeType: scopeType || role.scopeType,
        scopeId: scopeId || role.scopeId,
        isActive: true,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Cet utilisateur a déjà ce rôle avec cette portée');
    }

    // Créer l'attribution
    const assignment = this.roleAssignmentRepository.create({
      userId,
      roleId,
      scopeType: scopeType || role.scopeType,
      scopeId: scopeId || role.scopeId,
      assignedBy,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return this.roleAssignmentRepository.save(assignment);
  }

 /**
 * Retirer un rôle d'un utilisateur (suppression physique)
 */
  async removeRole(assignmentId: string) {
    const assignment = await this.roleAssignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Attribution de rôle non trouvée');
    }

    await this.roleAssignmentRepository.delete({ id: assignment.id });
    return { message: 'Attribution de rôle supprimée avec succès' };
  }
  /**
   * Mettre à jour une attribution de rôle
   */
  async updateAssignment(
    assignmentId: string,
    updateDto: UpdateRoleAssignmentDto,
  ) {
    const assignment = await this.roleAssignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Attribution de rôle non trouvée');
    }

    if (updateDto.expiresAt !== undefined) {
      assignment.expiresAt = updateDto.expiresAt ? new Date(updateDto.expiresAt) : (null as any);
    }
    if (updateDto.isActive !== undefined) {
      assignment.isActive = updateDto.isActive;
    }
    if (updateDto.scopeType !== undefined) {
      assignment.scopeType = updateDto.scopeType;
    }
    if (updateDto.scopeId !== undefined) {
      assignment.scopeId = updateDto.scopeId;
    }

    await this.roleAssignmentRepository.save(assignment);
    return assignment;
  }

  /**
   * Récupérer toutes les attributions d'un utilisateur
   */
  async getUserAssignments(userId: string) {
    const assignments = await this.roleAssignmentRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    // Filtrer les attributions expirées
    const validAssignments = assignments.filter((a) => !a.isExpired);

    return validAssignments;
  }

  /**
   * Calculer les permissions effectives d'un utilisateur
   */
  async getEffectivePermissions(userId: string) {
    // Récupérer tous les rôles actifs de l'utilisateur
    const assignments = await this.getUserAssignments(userId);
    // console.log('Assignments for user', userId, assignments);
    if (assignments.length === 0) {
      return {
        userId,
        permissions: [],
        totalCount: 0,
        roles: [],
      };
    }

    const roleIds = assignments.map((a) => a.roleId);

    // Récupérer toutes les permissions des rôles
    const rolePermissions = await this.rolePermissionRepository.find({
      where: {
        roleId: In(roleIds),
        isGranted: true,
      },
      relations: ['permission', 'role'],
    });

    // Récupérer les surcharges de permissions
    const assignmentIds = assignments.map((a) => a.id);
    const overrides = await this.permissionOverrideRepository.find({
      where: {
        roleAssignmentId: In(assignmentIds),
      },
      relations: ['permission'],
    });
    console.log('Overrides for user', userId, overrides);
    // Filtrer les surcharges expirées
    // const activeOverrides = overrides.filter((o) => o.isActive);
    // console.log('Active Overrides for user', userId, activeOverrides);
    // Construire le set de permissions effectives
    const permissionsMap = new Map<string, any>();

    // Ajouter les permissions des rôles
    rolePermissions.forEach((rp) => {
      if (!permissionsMap.has(rp.permission.code)) {
        permissionsMap.set(rp.permission.code, {
          id: rp.permission.id,
          code: rp.permission.code,
          name: rp.permission.name,
          resourceType: rp.permission.resourceType,
          action: rp.permission.action,
          scope: rp.permission.scope,
          source: 'role',
          roleId: rp.role.id,
          roleName: rp.role.name,
          constraints: rp.constraints,
        });
      }
    });

    // Appliquer les surcharges
    overrides.forEach((override) => {
      const permCode = override.permission.code;

      if (override.overrideType === OverrideType.GRANT) {
        // Ajouter la permission
        if (!permissionsMap.has(permCode)) {
          permissionsMap.set(permCode, {
            id: override.permission.id,
            code: override.permission.code,
            name: override.permission.name,
            resourceType: override.permission.resourceType,
            action: override.permission.action,
            scope: override.permission.scope,
            source: 'override',
          });
        }
      } else if (override.overrideType === OverrideType.REVOKE) {
        // Retirer la permission
        permissionsMap.delete(permCode);
      }
    });

    const permissions = Array.from(permissionsMap.values());

    return {
      userId,
      permissions,
      totalCount: permissions.length,
      roles: assignments.map((a) => ({
        id: a.role.id,
        name: a.role.name,
        code: a.role.code,
      })),
    };
  }

  /**
   * Vérifier si un utilisateur a une permission spécifique
   */
  async checkPermission(checkPermissionDto: CheckPermissionDto) {
    const { userId, resourceType, action, resourceId, context } = checkPermissionDto;

    // Récupérer les permissions effectives
    const effectivePerms = await this.getEffectivePermissions(userId);

    // Chercher la permission correspondante
    const hasPermission = effectivePerms.permissions.some(
      (perm) => perm.resourceType === resourceType && perm.action === action,
    );

    return {
      userId,
      resourceType,
      action,
      hasPermission,
      permissions: effectivePerms.permissions.filter(
        (p) => p.resourceType === resourceType && p.action === action,
      ),
    };
  }

  /**
   * Ajouter une surcharge de permission pour un utilisateur
   */
  async addPermissionOverride(
    userId: string,
    roleId: string,
    overrideDto: CreatePermissionOverrideDto,
    approvedBy: string,
  ) {
    // Trouver l'attribution de rôle
    const assignment = await this.roleAssignmentRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (!assignment) {
      throw new NotFoundException('Attribution de rôle non trouvée');
    }

    // Vérifier que la permission existe
    const permission = await this.permissionRepository.findOne({
      where: { id: overrideDto.permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission non trouvée');
    }

    // Vérifier s'il existe déjà une surcharge
    const existingOverride = await this.permissionOverrideRepository.findOne({
      where: {
        roleAssignmentId: assignment.id,
        permissionId: overrideDto.permissionId,
      },
    });

    if (existingOverride && existingOverride.isActive) {
      throw new BadRequestException('Une surcharge existe déjà pour cette permission');
    }

    // Créer la surcharge
    const override = this.permissionOverrideRepository.create({
      roleAssignmentId: assignment.id,
      permissionId: overrideDto.permissionId,
      overrideType: overrideDto.overrideType,
      reason: overrideDto.reason,
      approvedBy,
      expiresAt: overrideDto.expiresAt ? new Date(overrideDto.expiresAt) : undefined,
    });

    return this.permissionOverrideRepository.save(override);
  }

  /**
   * Accorder une permission temporaire
   */
  async grantTemporaryPermission(
    userId: string,
    tempPermDto: GrantTemporaryPermissionDto,
    approvedBy: string,
  ) {
    // Créer une attribution temporaire avec surcharge GRANT
    // On crée d'abord un rôle temporaire ou on utilise un rôle existant

    // Pour simplifier, on va créer une surcharge sur la première attribution active
    const assignments = await this.getUserAssignments(userId);

    if (assignments.length === 0) {
      throw new BadRequestException('L\'utilisateur doit avoir au moins un rôle');
    }

    const firstAssignment = assignments[0];

    const override = this.permissionOverrideRepository.create({
      roleAssignmentId: firstAssignment.id,
      permissionId: tempPermDto.permissionId,
      overrideType: OverrideType.GRANT,
      reason: tempPermDto.reason,
      approvedBy,
      expiresAt: new Date(tempPermDto.expiresAt),
    });

    return this.permissionOverrideRepository.save(override);
  }

  /**
   * Lister toutes les surcharges actives d'un utilisateur
   */
  async getUserOverrides(userId: string) {
    const assignments = await this.getUserAssignments(userId);
    const assignmentIds = assignments.map((a) => a.id);

    const overrides = await this.permissionOverrideRepository.find({
      where: {
        roleAssignmentId: In(assignmentIds),
      },
      relations: ['permission', 'roleAssignment'],
    });

    // Filtrer les surcharges actives
    const activeOverrides = overrides.filter((o) => o.isActive);

    return activeOverrides.map((o) => ({
      id: o.id,
      permission: {
        id: o.permission.id,
        code: o.permission.code,
        name: o.permission.name,
      },
      overrideType: o.overrideType,
      reason: o.reason,
      expiresAt: o.expiresAt,
      createdAt: o.createdAt,
    }));
  }
}