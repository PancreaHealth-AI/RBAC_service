import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Permission } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

// ─── Constants ───────────────────────────────────────────────────────────────
const PERMISSION_ID = 'perm-001';
const ROLE_ID       = 'role-001';

// ─── Mock factory ─────────────────────────────────────────────────────────────
const makePermission = (overrides = {}) => ({
  id: PERMISSION_ID,
  code: 'PATIENT:READ',
  name: 'Consulter un patient',
  resourceType: 'PATIENT',
  action: 'READ',
  scope: 'HOSPITAL',
  requiresConsent: true,
  description: 'Permet de consulter les informations d\'un patient',
  deletedAt: null,
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('PermissionsService', () => {
  let service: PermissionsService;

  let permissionRepo: Record<string, jest.Mock>;
  let rolePermissionRepo: Record<string, jest.Mock>;

  // QueryBuilder mock (needed by findAll / groupByResource / getPermissionsByRole)
  let qbMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    qbMock = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    permissionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    rolePermissionRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findByIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(Permission),    useValue: permissionRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rolePermissionRepo },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  // ═══════════════════════════════════════════════════════════════
  //  create
  // ═══════════════════════════════════════════════════════════════
  describe('create', () => {
    const createDto = {
      code: 'PATIENT:READ',
      name: 'Consulter un patient',
      resourceType: 'PATIENT',
      action: 'READ',
      scope: 'HOSPITAL',
      requiresConsent: true,
      description: 'Permet de consulter les informations d\'un patient',
    };

    it('should create and return a new permission', async () => {
      permissionRepo.findOne.mockResolvedValue(null); // code doesn't exist yet
      permissionRepo.create.mockReturnValue(makePermission());
      permissionRepo.save.mockResolvedValue(makePermission());

      const result = await service.create(createDto as any, 'admin-001');

      expect(permissionRepo.findOne).toHaveBeenCalledWith({ where: { code: createDto.code } });
      expect(permissionRepo.create).toHaveBeenCalledWith(createDto);
      expect(permissionRepo.save).toHaveBeenCalled();
      expect(result.code).toBe('PATIENT:READ');
    });

    it('should throw ConflictException when a permission with the same code already exists', async () => {
      permissionRepo.findOne.mockResolvedValue(makePermission()); // duplicate

      await expect(service.create(createDto as any, 'admin-001')).rejects.toThrow(ConflictException);
      expect(permissionRepo.save).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findAll
  // ═══════════════════════════════════════════════════════════════
  describe('findAll', () => {
    it('should return paginated permissions with metadata', async () => {
      const perms = [makePermission(), makePermission({ id: 'perm-002', code: 'PATIENT:WRITE' })];
      qbMock.getManyAndCount.mockResolvedValue([perms, 2]);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toMatchObject({ total: 2, page: 1, limit: 10, totalPages: 1 });
    });

    it('should apply the search filter when provided', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'patient', page: 1, limit: 10 } as any);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%patient%' }),
      );
    });

    it('should apply resourceType filter when provided', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ resourceType: 'PATIENT', page: 1, limit: 10 } as any);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('resourceType'),
        { resourceType: 'PATIENT' },
      );
    });

    it('should return empty results when no permissions match filters', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ resourceType: 'NONEXISTENT' } as any);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findOne
  // ═══════════════════════════════════════════════════════════════
  describe('findOne', () => {
    it('should return the permission enriched with its role usage count', async () => {
      permissionRepo.findOne.mockResolvedValue(makePermission());
      rolePermissionRepo.count.mockResolvedValue(3);

      const result = await service.findOne(PERMISSION_ID);

      expect(permissionRepo.findOne).toHaveBeenCalledWith({ where: { id: PERMISSION_ID } });
      expect(rolePermissionRepo.count).toHaveBeenCalledWith({
        where: { permissionId: PERMISSION_ID, isGranted: true },
      });
      expect(result.usedByRolesCount).toBe(3);
      expect(result.code).toBe('PATIENT:READ');
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findByCode
  // ═══════════════════════════════════════════════════════════════
  describe('findByCode', () => {
    it('should return the permission matching the given code', async () => {
      permissionRepo.findOne.mockResolvedValue(makePermission());

      const result = await service.findByCode('PATIENT:READ');

      expect(permissionRepo.findOne).toHaveBeenCalledWith({ where: { code: 'PATIENT:READ' } });
      expect(result?.code).toBe('PATIENT:READ');
    });

    it('should return null when no permission matches the code', async () => {
      permissionRepo.findOne.mockResolvedValue(null);

      const result = await service.findByCode('UNKNOWN:CODE');

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  update
  // ═══════════════════════════════════════════════════════════════
  describe('update', () => {
    it('should update and save a permission', async () => {
      const perm = makePermission();
      permissionRepo.findOne.mockResolvedValue(perm);
      permissionRepo.save.mockResolvedValue({ ...perm, name: 'Nouveau nom' });

      const result = await service.update(PERMISSION_ID, { name: 'Nouveau nom' } as any);

      expect(permissionRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Nouveau nom');
    });

    it('should throw NotFoundException when permission to update does not exist', async () => {
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.update('bad-id', { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  remove
  // ═══════════════════════════════════════════════════════════════
  describe('remove', () => {
    it('should soft-delete a permission when it is not used by any role', async () => {
      permissionRepo.findOne.mockResolvedValue(makePermission());
      rolePermissionRepo.count.mockResolvedValue(0); // not used
      permissionRepo.save.mockResolvedValue({ ...makePermission(), deletedAt: new Date() });

      const result = await service.remove(PERMISSION_ID);

      expect(permissionRepo.save).toHaveBeenCalled();
      expect(result.message).toMatch(/supprimée/i);
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when permission is still used by roles', async () => {
      permissionRepo.findOne.mockResolvedValue(makePermission());
      rolePermissionRepo.count.mockResolvedValue(2); // 2 roles use it

      await expect(service.remove(PERMISSION_ID)).rejects.toThrow(BadRequestException);
      expect(permissionRepo.save).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findByResource
  // ═══════════════════════════════════════════════════════════════
  describe('findByResource', () => {
    it('should return permissions filtered by resourceType', async () => {
      const patientPerms = [
        makePermission({ code: 'PATIENT:READ' }),
        makePermission({ id: 'perm-002', code: 'PATIENT:WRITE' }),
      ];
      permissionRepo.find.mockResolvedValue(patientPerms);

      const result = await service.findByResource('PATIENT' as any);

      expect(permissionRepo.find).toHaveBeenCalledWith({
        where: { resourceType: 'PATIENT' },
        order: { action: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  groupByResource
  // ═══════════════════════════════════════════════════════════════
  describe('groupByResource', () => {
    it('should group permissions by their resourceType', async () => {
      permissionRepo.find.mockResolvedValue([
        makePermission({ resourceType: 'PATIENT', code: 'PATIENT:READ' }),
        makePermission({ id: 'perm-002', resourceType: 'ROLE', code: 'ROLE:READ' }),
      ]);

      const result = await service.groupByResource();

      expect(result['PATIENT']).toHaveLength(1);
      expect(result['ROLE']).toHaveLength(1);
      expect(result['PATIENT'][0].code).toBe('PATIENT:READ');
    });

    it('should return an empty object when no permissions exist', async () => {
      permissionRepo.find.mockResolvedValue([]);

      const result = await service.groupByResource();

      expect(result).toEqual({});
    });
  });
});
