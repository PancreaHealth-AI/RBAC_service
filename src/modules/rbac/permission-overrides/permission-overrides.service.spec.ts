import { Test, TestingModule } from '@nestjs/testing';
import { PermissionOverridesService } from './permission-overrides.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionOverride, OverrideType } from '@database/entities/permission-override.entity';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { Permission } from '@database/entities/permission.entity';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

// ─── Constants ───────────────────────────────────────────────────────────────
const OVERRIDE_ID     = 'override-001';
const ASSIGNMENT_ID   = 'assign-001';
const PERMISSION_ID   = 'perm-001';
const USER_ID         = 'user-001';
const ROLE_ID         = 'role-001';
const APPROVED_BY     = 'admin-001';

// ─── Mock factories ───────────────────────────────────────────────────────────
const makeOverride = (overrides = {}): Partial<PermissionOverride> => ({
  id: OVERRIDE_ID,
  roleAssignmentId: ASSIGNMENT_ID,
  permissionId: PERMISSION_ID,
  overrideType: OverrideType.GRANT,
  reason: 'Urgence médicale',
  approvedBy: APPROVED_BY,
  expiresAt: null as any,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  permission: {
    id: PERMISSION_ID,
    code: 'PATIENT:DELETE',
    name: 'Supprimer patient',
    resourceType: 'PATIENT',
    action: 'DELETE',
  } as any,
  roleAssignment: {
    id: ASSIGNMENT_ID,
    userId: USER_ID,
    roleId: ROLE_ID,
    role: { id: ROLE_ID, name: 'Médecin' },
  } as any,
  ...overrides,
});

const makeAssignment = (overrides = {}) => ({
  id: ASSIGNMENT_ID,
  userId: USER_ID,
  roleId: ROLE_ID,
  isActive: true,
  role: { id: ROLE_ID, name: 'Médecin' },
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('PermissionOverridesService', () => {
  let service: PermissionOverridesService;

  let overrideRepo: Record<string, jest.Mock>;
  let roleAssignmentRepo: Record<string, jest.Mock>;
  let permissionRepo: Record<string, jest.Mock>;

  // QueryBuilder mock (needed by findAll / getUserOverrides / getAssignmentOverrides)
  let qbMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    overrideRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    roleAssignmentRepo = {
      findOne: jest.fn(),
    };

    permissionRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionOverridesService,
        { provide: getRepositoryToken(PermissionOverride), useValue: overrideRepo },
        { provide: getRepositoryToken(RoleAssignment),    useValue: roleAssignmentRepo },
        { provide: getRepositoryToken(Permission),        useValue: permissionRepo },
      ],
    }).compile();

    service = module.get<PermissionOverridesService>(PermissionOverridesService);
  });

  // ═══════════════════════════════════════════════════════════════
  //  create
  // ═══════════════════════════════════════════════════════════════
  describe('create', () => {
    const createDto = {
      roleAssignmentId: ASSIGNMENT_ID,
      permissionId: PERMISSION_ID,
      overrideType: OverrideType.GRANT,
      reason: 'Urgence médicale',
    };

    it('should create a GRANT override and return it enriched', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue({ id: PERMISSION_ID, code: 'PATIENT:DELETE' });
      overrideRepo.findOne
        .mockResolvedValueOnce(null)           // conflict check: none
        .mockResolvedValueOnce(makeOverride()); // findOne at end of create()

      overrideRepo.create.mockReturnValue(makeOverride());
      overrideRepo.save.mockResolvedValue({ id: OVERRIDE_ID });

      const result = await service.create(createDto as any, APPROVED_BY);

      expect(roleAssignmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: ASSIGNMENT_ID },
        relations: ['role'],
      });
      expect(overrideRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(OVERRIDE_ID);
      expect(result.permission.code).toBe('PATIENT:DELETE');
    });

    it('should create a REVOKE override for an existing role permission', async () => {
      const revokeDto = { ...createDto, overrideType: OverrideType.REVOKE };

      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue({ id: PERMISSION_ID });
      overrideRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeOverride({ overrideType: OverrideType.REVOKE }));

      overrideRepo.create.mockReturnValue(makeOverride({ overrideType: OverrideType.REVOKE }));
      overrideRepo.save.mockResolvedValue({ id: OVERRIDE_ID });

      const result = await service.create(revokeDto as any, APPROVED_BY);

      expect(overrideRepo.save).toHaveBeenCalled();
      expect(result.overrideType).toBe(OverrideType.REVOKE);
    });

    it('should throw NotFoundException when the role assignment does not exist', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDto as any, APPROVED_BY)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the permission does not exist', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDto as any, APPROVED_BY)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when an active override already exists', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue({ id: PERMISSION_ID });
      overrideRepo.findOne.mockResolvedValue(makeOverride({ isActive: true })); // conflict

      await expect(service.create(createDto as any, APPROVED_BY)).rejects.toThrow(ConflictException);
      expect(overrideRepo.save).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findOne
  // ═══════════════════════════════════════════════════════════════
  describe('findOne', () => {
    it('should return the override enriched with permission and assignment details', async () => {
      overrideRepo.findOne.mockResolvedValue(makeOverride());

      const result = await service.findOne(OVERRIDE_ID);

      expect(overrideRepo.findOne).toHaveBeenCalledWith({
        where: { id: OVERRIDE_ID },
        relations: ['permission', 'roleAssignment', 'roleAssignment.role'],
      });
      expect(result.permission).toMatchObject({ code: 'PATIENT:DELETE', action: 'DELETE' });
      expect(result.roleAssignment).toMatchObject({ userId: USER_ID, roleName: 'Médecin' });
    });

    it('should throw NotFoundException when override does not exist', async () => {
      overrideRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  update
  // ═══════════════════════════════════════════════════════════════
  describe('update', () => {
    it('should update the reason and save the override', async () => {
      const override = makeOverride() as any;
      overrideRepo.findOne
        .mockResolvedValueOnce(override)      // initial lookup
        .mockResolvedValueOnce(makeOverride({ reason: 'Nouvelle raison' })); // findOne at end

      overrideRepo.save.mockResolvedValue({ ...override, reason: 'Nouvelle raison' });

      const result = await service.update(OVERRIDE_ID, { reason: 'Nouvelle raison' } as any);

      expect(overrideRepo.save).toHaveBeenCalled();
      expect(result.reason).toBe('Nouvelle raison');
    });

    it('should update the expiresAt date when provided', async () => {
      const override = makeOverride() as any;
      const newExpiry = '2025-12-31T00:00:00Z';

      overrideRepo.findOne
        .mockResolvedValueOnce(override)
        .mockResolvedValueOnce(makeOverride({ expiresAt: new Date(newExpiry) }));

      overrideRepo.save.mockResolvedValue(override);

      const result = await service.update(OVERRIDE_ID, { expiresAt: newExpiry } as any);

      const savedArg = overrideRepo.save.mock.calls[0][0];
      expect(savedArg.expiresAt).toBeInstanceOf(Date);
    });

    it('should change the overrideType when provided', async () => {
      const override = makeOverride({ overrideType: OverrideType.GRANT }) as any;

      overrideRepo.findOne
        .mockResolvedValueOnce(override)
        .mockResolvedValueOnce(makeOverride({ overrideType: OverrideType.REVOKE }));

      overrideRepo.save.mockResolvedValue(override);

      const result = await service.update(OVERRIDE_ID, { overrideType: OverrideType.REVOKE } as any);

      expect(result.overrideType).toBe(OverrideType.REVOKE);
    });

    it('should throw NotFoundException when override does not exist', async () => {
      overrideRepo.findOne.mockResolvedValue(null);

      await expect(service.update('bad-id', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  remove
  // ═══════════════════════════════════════════════════════════════
  describe('remove', () => {
    it('should remove the override and return a success message', async () => {
      const override = makeOverride() as any;
      overrideRepo.findOne.mockResolvedValue(override);
      overrideRepo.remove.mockResolvedValue(override);

      const result = await service.remove(OVERRIDE_ID);

      expect(overrideRepo.remove).toHaveBeenCalledWith(override);
      expect(result.message).toMatch(/supprimée/i);
    });

    it('should throw NotFoundException when override does not exist', async () => {
      overrideRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  revoke
  // ═══════════════════════════════════════════════════════════════
  describe('revoke', () => {
    it('should set expiresAt to now, effectively revoking the override', async () => {
      const override = makeOverride({ expiresAt: null }) as any;
      overrideRepo.findOne.mockResolvedValue(override);
      overrideRepo.save.mockResolvedValue(override);

      const before = new Date();
      const result = await service.revoke(OVERRIDE_ID);
      const after = new Date();

      const savedArg = overrideRepo.save.mock.calls[0][0];
      expect(savedArg.expiresAt).toBeInstanceOf(Date);
      expect(savedArg.expiresAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(savedArg.expiresAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.message).toMatch(/révoquée/i);
    });

    it('should append the revocation reason to the existing reason', async () => {
      const override = makeOverride({ reason: 'Urgence' }) as any;
      overrideRepo.findOne.mockResolvedValue(override);
      overrideRepo.save.mockResolvedValue(override);

      await service.revoke(OVERRIDE_ID, 'Situation résolue');

      const savedArg = overrideRepo.save.mock.calls[0][0];
      expect(savedArg.reason).toContain('RÉVOQUÉE');
      expect(savedArg.reason).toContain('Situation résolue');
    });

    it('should throw NotFoundException when override does not exist', async () => {
      overrideRepo.findOne.mockResolvedValue(null);

      await expect(service.revoke('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getPermissionOverrides
  // ═══════════════════════════════════════════════════════════════
  describe('getPermissionOverrides', () => {
    it('should return all overrides for a given permission with user and role info', async () => {
      overrideRepo.find.mockResolvedValue([makeOverride()]);

      const result = await service.getPermissionOverrides(PERMISSION_ID);

      expect(overrideRepo.find).toHaveBeenCalledWith({
        where: { permissionId: PERMISSION_ID },
        relations: ['roleAssignment', 'roleAssignment.role'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: USER_ID,
        roleName: 'Médecin',
        overrideType: OverrideType.GRANT,
      });
    });

    it('should return an empty array when no overrides exist for the permission', async () => {
      overrideRepo.find.mockResolvedValue([]);

      const result = await service.getPermissionOverrides('nonexistent-perm');

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  cleanExpiredOverrides
  // ═══════════════════════════════════════════════════════════════
  describe('cleanExpiredOverrides', () => {
    it('should delete all expired overrides and report the count', async () => {
      qbMock.execute.mockResolvedValue({ affected: 5 });

      const result = await service.cleanExpiredOverrides();

      expect(qbMock.delete).toHaveBeenCalled();
      expect(qbMock.where).toHaveBeenCalledWith(
        'expiresAt < :now',
        expect.objectContaining({ now: expect.any(Date) }),
      );
      expect(result.message).toContain('5');
    });

    it('should report 0 when no expired overrides are found', async () => {
      qbMock.execute.mockResolvedValue({ affected: 0 });

      const result = await service.cleanExpiredOverrides();

      expect(result.message).toContain('0');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getStatistics
  // ═══════════════════════════════════════════════════════════════
  describe('getStatistics', () => {
    it('should return total, active, expired counts and a byType breakdown', async () => {
      overrideRepo.count.mockResolvedValue(10);
      qbMock.getCount.mockResolvedValue(7);
      qbMock.getRawMany.mockResolvedValue([
        { type: 'GRANT', count: '6' },
        { type: 'REVOKE', count: '4' },
      ]);

      const result = await service.getStatistics();

      expect(result.total).toBe(10);
      expect(result.active).toBe(7);
      expect(result.expired).toBe(3); // 10 - 7
      expect(result.byType).toEqual({ GRANT: 6, REVOKE: 4 });
    });
  });
});
