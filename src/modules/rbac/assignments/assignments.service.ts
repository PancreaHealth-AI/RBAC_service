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
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { MessagingService } from '../messaging-module/messaging.service';
import { NotificationChannel } from '../messaging-module/enums/notification-channel.enum';

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
    @InjectRedis() private readonly redis: Redis,
    private messagingService: MessagingService,
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

    const saved = await this.roleAssignmentRepository.save(assignment);

    this.messagingService.logAudit({
      action: 'ASSIGN_ROLE',
      userId: assignedBy,
      resource: 'role_assignment',
      resourceId: saved.id,
      status: 'SUCCESS',
      metadata: { targetUserId: userId, roleId, roleName: role.name, scopeType, scopeId },
    });

    this.messagingService.notify(
      {
        userId,
        type: 'ROLE_GRANTED',
        channel: NotificationChannel.EMAIL,
        title: 'Rôle attribué',
        content: `Un nouveau rôle vous a été attribué : ${role.name}.`,

        variables: { roleId, roleName: role.name, assignmentId: saved.id, assignedBy },
      },
      this.messagingService.topics.userEvents,
    );

    return saved;
  }

 /**
 * Retirer un rôle d'un utilisateur (suppression physique)
 */
  async removeRole(assignmentId: string, removedBy?: string) {
    const assignment = await this.roleAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['role'],
    });

    if (!assignment) {
      throw new NotFoundException('Attribution de rôle non trouvée');
    }

    const { userId, roleId } = assignment;
    const roleName = assignment.role?.name;

    await this.roleAssignmentRepository.delete({ id: assignment.id });

    this.messagingService.logAudit({
      action: 'REMOVE_ROLE',
      userId: removedBy,
      resource: 'role_assignment',
      resourceId: assignmentId,
      status: 'SUCCESS',
      metadata: { targetUserId: userId, roleId, roleName },
    });

    this.messagingService.notify(
      {
        userId,
        type: 'ROLE_REVOKED',
        channel: NotificationChannel.EMAIL,
        title: 'Rôle révoqué',
        content: `Un de vos rôles a été retiré : ${roleName ?? roleId}.`,
        variables: { roleId, roleName, assignmentId, removedBy },
      },
      this.messagingService.topics.userEvents,
    );

    return { message: 'Attribution de rôle supprimée avec succès' };
  }
  /**
   * Mettre à jour une attribution de rôle
   */
  async updateAssignment(
    assignmentId: string,
    updateDto: UpdateRoleAssignmentDto,
    updatedBy?: string,
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

    this.messagingService.logAudit({
      action: 'UPDATE_ASSIGNMENT',
      userId: updatedBy,
      resource: 'role_assignment',
      resourceId: assignmentId,
      status: 'SUCCESS',
      metadata: { changes: updateDto },
    });

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
   * Récupérer tous les rôles attribués à un utilisateur
   */
  async getUserRoles(userId: string) {
    const assignments = await this.roleAssignmentRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
      order: { assignedAt: 'DESC' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      roleId: assignment.roleId,
      roleName: assignment.role.name,
      roleCode: assignment.role.code,
      roleType: assignment.role.roleType,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
      expiresAt: assignment.expiresAt,
      isActive: assignment.isActive,
    }));
  }

  /**
   * Récupérer les permissions effectives d'un utilisateur en fonction de ses rôles et des surcharges
   */
    async getEffectivePermissionsByRole(userId: string) {
    // Récupérer tous les rôles actifs de l'utilisateur
    const assignments = await this.roleAssignmentRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    if (assignments.length === 0) {
      return {
        userId,
        roles: [],
        totalPermissionsCount: 0,
      };
    }

    const assignmentIds = assignments.map(a => a.id);
    const roleIds = assignments.map(a => a.roleId);

    // Récupérer toutes les permissions de base des rôles (isGranted = true)
    const rolePermissions = await this.rolePermissionRepository.find({
      where: {
        roleId: In(roleIds),
        isGranted: true,
      },
      relations: ['permission', 'role'],
    });

    // Récupérer toutes les surcharges pour ces assignments
    const overrides = await this.permissionOverrideRepository.find({
      where: { roleAssignmentId: In(assignmentIds) },
      relations: ['permission'],
    });

    // Grouper les permissions par assignmentId (rôle)
    const permissionsByAssignment = new Map<string, Map<string, any>>();

    // Initialiser pour chaque assignment
    for (const assignment of assignments) {
      permissionsByAssignment.set(assignment.id, new Map());
    }

    // Ajouter les permissions héritées des rôles
    for (const rp of rolePermissions) {
      // Trouver l'assignment correspondant à ce rôle (l'utilisateur a ce rôle)
      const assignment = assignments.find(a => a.roleId === rp.roleId);
      if (!assignment) continue;

      const permMap = permissionsByAssignment.get(assignment.id);
      if (!permMap) continue;
      if (!permMap.has(rp.permission.code)) {
        permMap.set(rp.permission.code, {
          id: rp.permission.id,
          code: rp.permission.code,
          name: rp.permission.name,
          resourceType: rp.permission.resourceType,
          action: rp.permission.action,
          scope: rp.permission.scope,
          constraints: rp.constraints,
          source: 'role',
        });
      }
    }

    // Appliquer les surcharges
    for (const override of overrides) {
      const permMap = permissionsByAssignment.get(override.roleAssignmentId);
      if (!permMap) continue;

      const permCode = override.permission.code;

      if (override.overrideType === OverrideType.GRANT) {
        if (!permMap.has(permCode)) {
          permMap.set(permCode, {
            id: override.permission.id,
            code: override.permission.code,
            name: override.permission.name,
            resourceType: override.permission.resourceType,
            action: override.permission.action,
            scope: override.permission.scope,
            source: 'override-grant',
          });
        }
      } else if (override.overrideType === OverrideType.REVOKE) {
        permMap.delete(permCode);
      }
      // Pour RESTRICT, vous pouvez ajuster les constraints existantes (optionnel)
    }

    // Construire la réponse par rôle
    const rolesWithPermissions: Array<{
      role: {
        assignmentId: string;
        id: string;
        name: string;
        code: string;
        roleType: any;
        scopeType: any;
        scopeId: string;
        expiresAt: Date | null;
      };
      permissions: any[];
    }> = [];
    let totalPerms = 0;

    for (const assignment of assignments) {
      const permMap = permissionsByAssignment.get(assignment.id);
      const permissions = Array.from(permMap!.values());
      totalPerms += permissions.length;

      rolesWithPermissions.push({
        role: {
          assignmentId: assignment.id,
          id: assignment.role.id,
          name: assignment.role.name,
          code: assignment.role.code,
          roleType: assignment.role.roleType,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          expiresAt: assignment.expiresAt,
        },
        permissions,
      });
    }

    return {
      userId,
      roles: rolesWithPermissions,
      totalPermissionsCount: totalPerms,
    };
  }
  /**
   * Récupérer les permissions effectives d'un utilisateur (version plate)
   */
  async getPermissionCodesByAssignment(userId: string, assignmentId: string): Promise<string[]> {
    // 1. Vérifier que l'attribution appartient bien à l'utilisateur
    const assignment = await this.roleAssignmentRepository.findOne({
      where: { id: assignmentId, userId, isActive: true },
    });
    if (!assignment) throw new ForbiddenException();

    // 2. Cache Redis (clé simple)
    const cacheKey = `user:${userId}:assignment:${assignmentId}:permcodes`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 3. Récupérer les permissions du rôle (isGranted=true)
    const rolePerms = await this.rolePermissionRepository.find({
      where: { roleId: assignment.roleId, isGranted: true },
      relations: ['permission'],
    });

    // 4. Récupérer les surcharges pour cet assignment
    const overrides = await this.permissionOverrideRepository.find({
      where: { roleAssignmentId: assignmentId },
      relations: ['permission'],
    });

    // 5. Construire un Set de codes de permission
    const permSet = new Set<string>();
    for (const rp of rolePerms) {
      permSet.add(rp.permission.code); // ou `resourceType:action` si préféré
    }
    for (const ov of overrides) {
      if (ov.overrideType === OverrideType.GRANT) {
        permSet.add(ov.permission.code);
      } else if (ov.overrideType === OverrideType.REVOKE) {
        permSet.delete(ov.permission.code);
      }
    }

    const result = Array.from(permSet);
    // 6. Stocker en Redis (TTL 5 min)
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  /**
 * Récupère les codes de permission effectifs pour une attribution de rôle donnée (assignmentId)
 */
  async getPermissionCodesForAssignment(userId: string, assignmentId: string): Promise<string[]> {
    // Vérifier que l'attribution appartient bien à l'utilisateur
    const assignment = await this.roleAssignmentRepository.findOne({
      where: { id: assignmentId, userId, isActive: true },
      relations: ['role'],
    });
    if (!assignment) throw new ForbiddenException('Attribution non trouvée ou non autorisée');

    const cacheKey = `user:${userId}:assignment:${assignmentId}:permcodes`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Permissions de base du rôle (isGranted = true)
    const rolePerms = await this.rolePermissionRepository.find({
      where: { roleId: assignment.roleId, isGranted: true },
      relations: ['permission'],
    });

    // Surcharges pour cette attribution
    const overrides = await this.permissionOverrideRepository.find({
      where: { roleAssignmentId: assignmentId },
      relations: ['permission'],
    });

    // Construire le Set de codes
    const permSet = new Set<string>();
    for (const rp of rolePerms) {
      permSet.add(rp.permission.code);
    }
    for (const ov of overrides) {
      if (ov.overrideType === OverrideType.GRANT) {
        permSet.add(ov.permission.code);
      } else if (ov.overrideType === OverrideType.REVOKE) {
        permSet.delete(ov.permission.code);
      }
    }

    const result = Array.from(permSet);
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  /**
   * Vérifie si l'utilisateur possède une permission donnée pour un assignment spécifique.
   */
  async checkPermissionForAssignment(userId: string, assignmentId: string, permissionCode: string): Promise<boolean> {
    const perms = await this.getPermissionCodesForAssignment(userId, assignmentId);
    return perms.includes(permissionCode);
  }

  /**
   * Vérifier si un utilisateur a une permission spécifique
   */
  // async checkPermission(checkPermissionDto: CheckPermissionDto) {
  //   const { userId, resourceType, action, resourceId, context } = checkPermissionDto;

  //   // Récupérer les permissions effectives
  //   const effectivePerms = await this.getEffectivePermissions(userId);

  //   // Chercher la permission correspondante
  //   const hasPermission = effectivePerms.permissions.some(
  //     (perm) => perm.resourceType === resourceType && perm.action === action,
  //   );

  //   return {
  //     userId,
  //     resourceType,
  //     action,
  //     hasPermission,
  //     permissions: effectivePerms.permissions.filter(
  //       (p) => p.resourceType === resourceType && p.action === action,
  //     ),
  //   };
  // }

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

    const savedOverride = await this.permissionOverrideRepository.save(override);

    this.messagingService.logSecurity({
      action: 'GRANT_OVERRIDE',
      userId: approvedBy,
      resource: 'permission_override',
      resourceId: savedOverride.id,
      status: 'SUCCESS',
      metadata: { targetUserId: userId, permissionId: overrideDto.permissionId, permissionCode: permission.code, overrideType: overrideDto.overrideType },
    });

    if (overrideDto.overrideType === OverrideType.GRANT) {
      this.messagingService.notify(
        {
          userId,
          type: 'OVERRIDE_PERMISSION_GRANTED',
          channel: NotificationChannel.WEBSOCKET,
          title: 'Permission spéciale accordée',
          content: `Une permission supplémentaire vous a été accordée : ${permission.code}.`,
          variables: { permissionId: permission.id, permissionCode: permission.code, approvedBy },
        },
        this.messagingService.topics.userEvents,
      );
    }

    return savedOverride;
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