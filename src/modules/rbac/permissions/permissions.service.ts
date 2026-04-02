import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, ResourceType, Action, PermissionScope } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { QueryPermissionsDto } from './dto/query-permissions.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
  ) {}

  /**
   * Créer une nouvelle permission
   */
  async create(createPermissionDto: CreatePermissionDto , createBy: string) {
    // Vérifier si le code existe déjà
    const existingPermission = await this.permissionRepository.findOne({
      where: { code: createPermissionDto.code },
    });

    if (existingPermission) {
      throw new ConflictException('Une permission avec ce code existe déjà');
    }

    const permission = this.permissionRepository.create(createPermissionDto);
    permission.createdBy = createBy;
    return this.permissionRepository.save(permission );
  }

  /**
   * Lister toutes les permissions système
   */
  async findAll(queryDto: QueryPermissionsDto) {
    const {
      page = 1,
      limit = 50,
      search,
      resourceType,
      action,
      scope,
      requiresConsent,
      sortBy = 'code',
      sortOrder = 'ASC',
    } = queryDto;

    const queryBuilder = this.permissionRepository.createQueryBuilder('permission');

    // Filtres
    if (search) {
      queryBuilder.andWhere(
        '(permission.code ILIKE :search OR permission.name ILIKE :search OR permission.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (resourceType) {
      queryBuilder.andWhere('permission.resourceType = :resourceType', {
        resourceType,
      });
    }

    if (action) {
      queryBuilder.andWhere('permission.action = :action', { action });
    }

    if (scope) {
      queryBuilder.andWhere('permission.scope = :scope', { scope });
    }

    if (requiresConsent !== undefined) {
      queryBuilder.andWhere('permission.requiresConsent = :requiresConsent', {
        requiresConsent,
      });
    }

    // Tri
    queryBuilder.orderBy(`permission.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [permissions, total] = await queryBuilder.getManyAndCount();

    return {
      data: permissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtenir une permission par ID
   */
  async findOne(id: string) {
    const permission = await this.permissionRepository.findOne({ where: { id } });

    if (!permission) {
      throw new NotFoundException('Permission non trouvée');
    }

    // Compter combien de rôles utilisent cette permission
    const rolesCount = await this.rolePermissionRepository.count({
      where: { permissionId: id, isGranted: true },
    });

    return {
      ...permission,
      usedByRolesCount: rolesCount,
    };
  }

  /**
   * Obtenir une permission par code
   */
  async findByCode(code: string) {
    return this.permissionRepository.findOne({ where: { code } });
  }

  /**
   * Mettre à jour une permission
   */
  async update(id: string, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.permissionRepository.findOne({ where: { id } });

    if (!permission) {
      throw new NotFoundException('Permission non trouvée');
    }

    Object.assign(permission, updatePermissionDto);
    return this.permissionRepository.save(permission);
  }

  /**
   * Supprimer une permission
   */
  async remove(id: string) {
    const permission = await this.permissionRepository.findOne({ where: { id } });

    if (!permission) {
      throw new NotFoundException('Permission non trouvée');
    }

    // Vérifier si la permission est utilisée
    const rolesCount = await this.rolePermissionRepository.count({
      where: { permissionId: id, isGranted: true },
    });

    if (rolesCount > 0) {
      throw new BadRequestException(
        `Cette permission ne peut pas être supprimée car elle est utilisée par ${rolesCount} rôle(s)`,
      );
    }
    permission.deletedAt = new Date();
    await this.permissionRepository.save(permission);

    return { message: 'Permission supprimée avec succès' };
  }

  /**
   * Initialiser les permissions système (à exécuter au démarrage)
   */
  async seedPermissions() {
    const permissions: Array<{
      code: string;
      name: string;
      resourceType: ResourceType;
      action: Action;
      scope: PermissionScope;
      requiresConsent: boolean;
      description: string;
    }> = [
      // === PATIENT ===
      {
        code: 'PATIENT_CREATE',
        name: 'Créer un patient',
        resourceType: ResourceType.PATIENT,
        action: Action.CREATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de créer un nouveau dossier patient',
      },
      {
        code: 'PATIENT_READ',
        name: 'Consulter un patient',
        resourceType: ResourceType.PATIENT,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de consulter les informations d\'un patient',
      },
      {
        code: 'PATIENT_UPDATE',
        name: 'Modifier un patient',
        resourceType: ResourceType.PATIENT,
        action: Action.UPDATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de modifier les informations d\'un patient',
      },
      {
        code: 'PATIENT_DELETE',
        name: 'Supprimer un patient',
        resourceType: ResourceType.PATIENT,
        action: Action.DELETE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de supprimer un dossier patient',
      },
      {
        code: 'PATIENT_EXPORT',
        name: 'Exporter données patient',
        resourceType: ResourceType.PATIENT,
        action: Action.EXPORT,
        scope: PermissionScope.SELF,
        requiresConsent: true,
        description: 'Permet d\'exporter les données d\'un patient',
      },

      // === MEDICAL_RECORD ===
      {
        code: 'MEDICAL_RECORD_READ',
        name: 'Consulter dossier médical',
        resourceType: ResourceType.MEDICAL_RECORD,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de consulter le dossier médical complet',
      },
      {
        code: 'MEDICAL_RECORD_UPDATE',
        name: 'Modifier dossier médical',
        resourceType: ResourceType.MEDICAL_RECORD,
        action: Action.UPDATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de modifier le dossier médical',
      },
      {
        code: 'MEDICAL_RECORD_EXPORT',
        name: 'Exporter dossier médical',
        resourceType: ResourceType.MEDICAL_RECORD,
        action: Action.EXPORT,
        scope: PermissionScope.SELF,
        requiresConsent: true,
        description: 'Permet d\'exporter le dossier médical',
      },
      {
        code: 'MEDICAL_RECORD_SHARE',
        name: 'Partager dossier médical',
        resourceType: ResourceType.MEDICAL_RECORD,
        action: Action.SHARE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de partager le dossier médical avec d\'autres services',
      },

      // === ENCOUNTER ===
      {
        code: 'ENCOUNTER_CREATE',
        name: 'Créer une consultation',
        resourceType: ResourceType.ENCOUNTER,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de créer une consultation',
      },
      {
        code: 'ENCOUNTER_READ',
        name: 'Consulter une consultation',
        resourceType: ResourceType.ENCOUNTER,
        action: Action.READ,
        scope: PermissionScope.SPECIALTY,
        requiresConsent: false,
        description: 'Permet de consulter les détails d\'une consultation',
      },
      {
        code: 'ENCOUNTER_UPDATE',
        name: 'Modifier une consultation',
        resourceType: ResourceType.ENCOUNTER,
        action: Action.UPDATE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de modifier une consultation',
      },
      {
        code: 'ENCOUNTER_DELETE',
        name: 'Supprimer une consultation',
        resourceType: ResourceType.ENCOUNTER,
        action: Action.DELETE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de supprimer une consultation',
      },

      // === PRESCRIPTION ===
      {
        code: 'PRESCRIPTION_CREATE',
        name: 'Prescrire médicament',
        resourceType: ResourceType.PRESCRIPTION,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de prescrire des médicaments',
      },
      {
        code: 'PRESCRIPTION_READ',
        name: 'Consulter prescriptions',
        resourceType: ResourceType.PRESCRIPTION,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de consulter les prescriptions',
      },
      {
        code: 'PRESCRIPTION_UPDATE',
        name: 'Modifier prescription',
        resourceType: ResourceType.PRESCRIPTION,
        action: Action.UPDATE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de modifier une prescription',
      },
      {
        code: 'PRESCRIPTION_DELETE',
        name: 'Annuler prescription',
        resourceType: ResourceType.PRESCRIPTION,
        action: Action.DELETE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet d\'annuler une prescription',
      },

      // === BIOLOGICAL_TEST ===
      {
        code: 'BIOLOGICAL_TEST_CREATE',
        name: 'Prescrire analyse',
        resourceType: ResourceType.BIOLOGICAL_TEST,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de prescrire des analyses biologiques',
      },
      {
        code: 'BIOLOGICAL_TEST_READ',
        name: 'Consulter résultats analyses',
        resourceType: ResourceType.BIOLOGICAL_TEST,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de consulter les résultats d\'analyses',
      },
      {
        code: 'BIOLOGICAL_TEST_UPDATE',
        name: 'Modifier analyse',
        resourceType: ResourceType.BIOLOGICAL_TEST,
        action: Action.UPDATE,
        scope: PermissionScope.SERVICE,
        requiresConsent: false,
        description: 'Permet de modifier une analyse',
      },

      // === MEDICAL_IMAGE ===
      {
        code: 'MEDICAL_IMAGE_CREATE',
        name: 'Prescrire imagerie',
        resourceType: ResourceType.MEDICAL_IMAGE,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de prescrire des examens d\'imagerie',
      },
      {
        code: 'MEDICAL_IMAGE_READ',
        name: 'Consulter imagerie',
        resourceType: ResourceType.MEDICAL_IMAGE,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de consulter les images médicales',
      },
      {
        code: 'MEDICAL_IMAGE_SHARE',
        name: 'Partager imagerie',
        resourceType: ResourceType.MEDICAL_IMAGE,
        action: Action.SHARE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de partager les images avec d\'autres services',
      },

      // === DIAGNOSIS ===
      {
        code: 'DIAGNOSIS_CREATE',
        name: 'Créer diagnostic',
        resourceType: ResourceType.DIAGNOSIS,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de créer un diagnostic',
      },
      {
        code: 'DIAGNOSIS_READ',
        name: 'Consulter diagnostic',
        resourceType: ResourceType.DIAGNOSIS,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet de consulter les diagnostics',
      },
      {
        code: 'DIAGNOSIS_UPDATE',
        name: 'Modifier diagnostic',
        resourceType: ResourceType.DIAGNOSIS,
        action: Action.UPDATE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de modifier un diagnostic',
      },

      // === TREATMENT ===
      {
        code: 'TREATMENT_CREATE',
        name: 'Créer traitement',
        resourceType: ResourceType.TREATMENT,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de créer un traitement',
      },
      {
        code: 'TREATMENT_READ',
        name: 'Consulter traitement',
        resourceType: ResourceType.TREATMENT,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de consulter les traitements',
      },
      {
        code: 'TREATMENT_UPDATE',
        name: 'Modifier traitement',
        resourceType: ResourceType.TREATMENT,
        action: Action.UPDATE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de modifier un traitement',
      },

      // === AI_MODEL ===
      {
        code: 'AI_MODEL_EXECUTE',
        name: 'Exécuter modèle IA',
        resourceType: ResourceType.AI_MODEL,
        action: Action.EXECUTE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: true,
        description: 'Permet d\'exécuter des prédictions IA',
      },
      {
        code: 'AI_MODEL_READ',
        name: 'Consulter modèles IA',
        resourceType: ResourceType.AI_MODEL,
        action: Action.READ,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de consulter les modèles IA disponibles',
      },
      {
        code: 'AI_MODEL_CREATE',
        name: 'Créer modèle IA',
        resourceType: ResourceType.AI_MODEL,
        action: Action.CREATE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de créer des modèles IA',
      },
      {
        code: 'AI_MODEL_UPDATE',
        name: 'Modifier modèle IA',
        resourceType: ResourceType.AI_MODEL,
        action: Action.UPDATE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de modifier des modèles IA',
      },
      {
        code: 'AI_MODEL_DELETE',
        name: 'Supprimer modèle IA',
        resourceType: ResourceType.AI_MODEL,
        action: Action.DELETE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de supprimer des modèles IA',
      },

      // === AI_PREDICTION ===
      {
        code: 'AI_PREDICTION_READ',
        name: 'Consulter prédictions IA',
        resourceType: ResourceType.AI_PREDICTION,
        action: Action.READ,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: true,
        description: 'Permet de consulter les résultats de prédictions IA',
      },
      {
        code: 'AI_PREDICTION_EXPORT',
        name: 'Exporter prédictions IA',
        resourceType: ResourceType.AI_PREDICTION,
        action: Action.EXPORT,
        scope: PermissionScope.SYSTEM,
        requiresConsent: true,
        description: 'Permet d\'exporter les prédictions IA',
      },

      // === USER ===
      {
        code: 'USER_CREATE',
        name: 'Créer utilisateur',
        resourceType: ResourceType.USER,
        action: Action.CREATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de créer des utilisateurs',
      },
      {
        code: 'USER_READ',
        name: 'Consulter utilisateurs',
        resourceType: ResourceType.USER,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de consulter les utilisateurs',
      },
      {
        code: 'USER_UPDATE',
        name: 'Modifier utilisateur',
        resourceType: ResourceType.USER,
        action: Action.UPDATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de modifier les utilisateurs',
      },
      {
        code: 'USER_DELETE',
        name: 'Supprimer utilisateur',
        resourceType: ResourceType.USER,
        action: Action.DELETE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de supprimer des utilisateurs',
      },

      // === ROLE ===
      {
        code: 'ROLE_CREATE',
        name: 'Créer rôle',
        resourceType: ResourceType.ROLE,
        action: Action.CREATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de créer des rôles',
      },
      {
        code: 'ROLE_READ',
        name: 'Consulter rôles',
        resourceType: ResourceType.ROLE,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de consulter les rôles',
      },
      {
        code: 'ROLE_UPDATE',
        name: 'Modifier rôle',
        resourceType: ResourceType.ROLE,
        action: Action.UPDATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de modifier les rôles',
      },
      {
        code: 'ROLE_DELETE',
        name: 'Supprimer rôle',
        resourceType: ResourceType.ROLE,
        action: Action.DELETE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de supprimer des rôles',
      },

      // === CONSENT ===
      {
        code: 'CONSENT_READ',
        name: 'Consulter consentements',
        resourceType: ResourceType.CONSENT,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de consulter les consentements',
      },
      {
        code: 'CONSENT_CREATE',
        name: 'Créer consentement',
        resourceType: ResourceType.CONSENT,
        action: Action.CREATE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de créer des consentements',
      },
      {
        code: 'CONSENT_UPDATE',
        name: 'Modifier consentement',
        resourceType: ResourceType.CONSENT,
        action: Action.UPDATE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de modifier des consentements',
      },
      {
        code: 'CONSENT_DELETE',
        name: 'Révoquer consentement',
        resourceType: ResourceType.CONSENT,
        action: Action.DELETE,
        scope: PermissionScope.SELF,
        requiresConsent: false,
        description: 'Permet de révoquer des consentements',
      },

      // === HOSPITAL ===
      {
        code: 'HOSPITAL_CREATE',
        name: 'Créer hôpital',
        resourceType: ResourceType.HOSPITAL,
        action: Action.CREATE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de créer des hôpitaux',
      },
      {
        code: 'HOSPITAL_READ',
        name: 'Consulter hôpitaux',
        resourceType: ResourceType.HOSPITAL,
        action: Action.READ,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de consulter les hôpitaux',
      },
      {
        code: 'HOSPITAL_UPDATE',
        name: 'Modifier hôpital',
        resourceType: ResourceType.HOSPITAL,
        action: Action.UPDATE,
        scope: PermissionScope.SYSTEM,
        requiresConsent: false,
        description: 'Permet de modifier les hôpitaux',
      },

      // === DEPARTMENT ===
      {
        code: 'DEPARTMENT_CREATE',
        name: 'Créer département',
        resourceType: ResourceType.DEPARTMENT,
        action: Action.CREATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de créer des départements',
      },
      {
        code: 'DEPARTMENT_READ',
        name: 'Consulter départements',
        resourceType: ResourceType.DEPARTMENT,
        action: Action.READ,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de consulter les départements',
      },
      {
        code: 'DEPARTMENT_UPDATE',
        name: 'Modifier département',
        resourceType: ResourceType.DEPARTMENT,
        action: Action.UPDATE,
        scope: PermissionScope.HOSPITAL,
        requiresConsent: false,
        description: 'Permet de modifier les départements',
      },

      // === SERVICE ===
      {
        code: 'SERVICE_CREATE',
        name: 'Créer service',
        resourceType: ResourceType.SERVICE,
        action: Action.CREATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de créer des services',
      },
      {
        code: 'SERVICE_READ',
        name: 'Consulter services',
        resourceType: ResourceType.SERVICE,
        action: Action.READ,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de consulter les services',
      },
      {
        code: 'SERVICE_UPDATE',
        name: 'Modifier service',
        resourceType: ResourceType.SERVICE,
        action: Action.UPDATE,
        scope: PermissionScope.DEPARTMENT,
        requiresConsent: false,
        description: 'Permet de modifier les services',
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const permData of permissions) {
      const existing = await this.permissionRepository.findOne({
        where: { code: permData.code },
      });

      if (!existing) {
        const permission = this.permissionRepository.create(permData);
        await this.permissionRepository.save(permission);
        createdCount++;
      } else {
        // Mettre à jour si différent
        Object.assign(existing, permData);
        await this.permissionRepository.save(existing);
        updatedCount++;
      }
    }

    return {
      message: `${createdCount} permissions créées, ${updatedCount} mises à jour`,
      total: permissions.length,
    };
  }

  /**
   * Récupérer les permissions par ressource
   */
  async findByResource(resourceType: ResourceType) {
    return this.permissionRepository.find({
      where: { resourceType },
      order: { action: 'ASC' },
    });
  }

  /**
   * Grouper les permissions par ressource
   */
  async groupByResource() {
    const permissions = await this.permissionRepository.find({
      order: { resourceType: 'ASC', action: 'ASC' },
    });

    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.resourceType]) {
        acc[perm.resourceType] = [];
      }
      acc[perm.resourceType].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);

    return grouped;
  }

  /**
   * Récupérer toutes les permissions d'un rôle, catégorisées par resourceType
   */
  async getPermissionsByRole(roleId: string) {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: ['permission'],
    });

    // Regrouper par resourceType
    const grouped = rolePermissions.reduce((acc, rp) => {
      const resource = rp.permission.resourceType;
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push({
        ...rp.permission,
        isGranted: rp.isGranted,
        constraints: rp.constraints,
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Transformer en tableau pour un meilleur affichage (optionnel)
    const result = Object.entries(grouped).map(([resourceType, permissions]) => ({
      resourceType,
      permissions,
    }));

    return result;
  }
}