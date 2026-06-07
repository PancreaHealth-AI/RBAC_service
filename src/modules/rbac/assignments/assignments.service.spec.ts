import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsService } from './assignments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { PermissionOverride, OverrideType } from '@database/entities/permission-override.entity';
import { Role } from '@database/entities/role.entity';
import { Permission } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

// ─── Constants ───────────────────────────────────────────────────────────────
const USER_ID       = 'user-001';
const ROLE_ID       = 'role-001';
const ASSIGNMENT_ID = 'assign-001';
const PERMISSION_ID = 'perm-001';
const ASSIGNED_BY   = 'admin-001';

// ─── Mock factories ───────────────────────────────────────────────────────────
const makeAssignment = (overrides = {}): RoleAssignment =>
  ({
    id: ASSIGNMENT_ID,
    userId: USER_ID,
    roleId: ROLE_ID,
    scopeType: 'HOSPITAL',
    scopeId: 'hosp-001',
    assignedBy: ASSIGNED_BY,
    isActive: true,
    expiresAt: null,
    assignedAt: new Date('2024-01-01'),
    get isExpired() { return false; },
    role: {
      id: ROLE_ID,
      name: 'Médecin',
      code: 'DOCTOR',
      roleType: 'SYSTEM',
      scopeType: 'HOSPITAL',
      scopeId: 'hosp-001',
    },
    ...overrides,
  } as any);

const makeRole = (overrides = {}) => ({
  id: ROLE_ID,
  name: 'Médecin',
  code: 'DOCTOR',
  scopeType: 'HOSPITAL',
  scopeId: 'hosp-001',
  isActive: true,
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('AssignmentsService', () => {
  let service: AssignmentsService;

  // Repository mocks
  let roleAssignmentRepo: Record<string, jest.Mock>;
  let permissionOverrideRepo: Record<string, jest.Mock>;
  let roleRepo: Record<string, jest.Mock>;
  let permissionRepo: Record<string, jest.Mock>;
  let rolePermissionRepo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  beforeEach(async () => {
    roleAssignmentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    permissionOverrideRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    roleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    permissionRepo = {
      findOne: jest.fn(),
    };
    rolePermissionRepo = {
      find: jest.fn(),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: getRepositoryToken(RoleAssignment),    useValue: roleAssignmentRepo },
        { provide: getRepositoryToken(PermissionOverride), useValue: permissionOverrideRepo },
        { provide: getRepositoryToken(Role),              useValue: roleRepo },
        { provide: getRepositoryToken(Permission),        useValue: permissionRepo },
        { provide: getRepositoryToken(RolePermission),    useValue: rolePermissionRepo },
        { provide: getRedisConnectionToken(),             useValue: redis },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  // ═══════════════════════════════════════════════════════════════
  //  assignRole
  // ═══════════════════════════════════════════════════════════════
  describe('assignRole', () => {
    it('should assign a role to a user and return the new assignment', async () => {
      const dto = { roleId: ROLE_ID, scopeType: 'HOSPITAL', scopeId: 'hosp-001' };
      const savedAssignment = makeAssignment();

      roleRepo.findOne.mockResolvedValue(makeRole());
      roleAssignmentRepo.findOne.mockResolvedValue(null); // no existing assignment
      roleAssignmentRepo.create.mockReturnValue(savedAssignment);
      roleAssignmentRepo.save.mockResolvedValue(savedAssignment);

      const result = await service.assignRole(USER_ID, dto as any, ASSIGNED_BY);

      expect(roleRepo.findOne).toHaveBeenCalledWith({ where: { id: ROLE_ID, isActive: true } });
      expect(roleAssignmentRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe(USER_ID);
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignRole(USER_ID, { roleId: 'invalid-role' } as any, ASSIGNED_BY),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when assignment already exists', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole());
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment()); // duplicate

      await expect(
        service.assignRole(USER_ID, { roleId: ROLE_ID } as any, ASSIGNED_BY),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  removeRole
  // ═══════════════════════════════════════════════════════════════
  describe('removeRole', () => {
    it('should delete an assignment and return a success message', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      roleAssignmentRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.removeRole(ASSIGNMENT_ID);

      expect(roleAssignmentRepo.delete).toHaveBeenCalledWith({ id: ASSIGNMENT_ID });
      expect(result.message).toMatch(/supprimée/i);
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(service.removeRole('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  updateAssignment
  // ═══════════════════════════════════════════════════════════════
  describe('updateAssignment', () => {
    it('should update isActive field and save the assignment', async () => {
      const assignment = makeAssignment();
      roleAssignmentRepo.findOne.mockResolvedValue(assignment);
      roleAssignmentRepo.save.mockResolvedValue({ ...assignment, isActive: false });

      const result = await service.updateAssignment(ASSIGNMENT_ID, { isActive: false } as any);

      expect(roleAssignmentRepo.save).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });

    it('should update expiresAt to null when null is provided', async () => {
      const assignment = makeAssignment({ expiresAt: new Date('2025-12-31') });
      roleAssignmentRepo.findOne.mockResolvedValue(assignment);
      roleAssignmentRepo.save.mockResolvedValue({ ...assignment, expiresAt: null });

      const result = await service.updateAssignment(ASSIGNMENT_ID, { expiresAt: null } as any);

      expect(result.expiresAt).toBeNull();
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateAssignment('bad-id', { isActive: false } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getUserAssignments
  // ═══════════════════════════════════════════════════════════════
  describe('getUserAssignments', () => {
    it('should return only non-expired active assignments', async () => {
      const validAssignment   = makeAssignment();
      const expiredAssignment = makeAssignment({ get isExpired() { return true; } });

      roleAssignmentRepo.find.mockResolvedValue([validAssignment, expiredAssignment]);

      const result = await service.getUserAssignments(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ASSIGNMENT_ID);
    });

    it('should return an empty array when user has no active assignments', async () => {
      roleAssignmentRepo.find.mockResolvedValue([]);

      const result = await service.getUserAssignments(USER_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getUserRoles
  // ═══════════════════════════════════════════════════════════════
  describe('getUserRoles', () => {
    it('should return mapped role objects for each active assignment', async () => {
      roleAssignmentRepo.find.mockResolvedValue([makeAssignment()]);

      const result = await service.getUserRoles(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        roleId: ROLE_ID,
        roleName: 'Médecin',
        roleCode: 'DOCTOR',
        scopeType: 'HOSPITAL',
        isActive: true,
      });
    });

    it('should return an empty array when user has no roles', async () => {
      roleAssignmentRepo.find.mockResolvedValue([]);

      const result = await service.getUserRoles(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getPermissionCodesByAssignment
  // ═══════════════════════════════════════════════════════════════
  describe('getPermissionCodesByAssignment', () => {
    it('should return permission codes from cache without hitting the DB', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      redis.get.mockResolvedValue(JSON.stringify(['PATIENT:READ', 'PATIENT:UPDATE']));

      const result = await service.getPermissionCodesByAssignment(USER_ID, ASSIGNMENT_ID);

      expect(redis.get).toHaveBeenCalled();
      expect(rolePermissionRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual(['PATIENT:READ', 'PATIENT:UPDATE']);
    });

    it('should query the DB on cache miss and persist the result in Redis', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      redis.get.mockResolvedValue(null); // cache miss

      rolePermissionRepo.find.mockResolvedValue([
        { permission: { code: 'PATIENT:READ' } },
      ]);
      permissionOverrideRepo.find.mockResolvedValue([]);
      redis.set.mockResolvedValue('OK');

      const result = await service.getPermissionCodesByAssignment(USER_ID, ASSIGNMENT_ID);

      expect(rolePermissionRepo.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
      expect(result).toContain('PATIENT:READ');
    });

    it('should throw ForbiddenException when assignment does not belong to the user', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPermissionCodesByAssignment(USER_ID, ASSIGNMENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  addPermissionOverride
  // ═══════════════════════════════════════════════════════════════
  describe('addPermissionOverride', () => {
    const overrideDto = {
      permissionId: PERMISSION_ID,
      overrideType: OverrideType.GRANT,
      reason: 'Urgence médicale',
    };

    it('should create a GRANT permission override for a valid assignment', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue({ id: PERMISSION_ID, code: 'PATIENT:DELETE' });
      permissionOverrideRepo.findOne.mockResolvedValue(null); // no existing override
      permissionOverrideRepo.create.mockReturnValue({ id: 'override-001', ...overrideDto });
      permissionOverrideRepo.save.mockResolvedValue({ id: 'override-001' });

      await service.addPermissionOverride(USER_ID, ROLE_ID, overrideDto as any, ASSIGNED_BY);

      expect(permissionOverrideRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when role assignment is not found', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addPermissionOverride(USER_ID, ROLE_ID, overrideDto as any, ASSIGNED_BY),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addPermissionOverride(USER_ID, ROLE_ID, overrideDto as any, ASSIGNED_BY),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when an active override already exists', async () => {
      roleAssignmentRepo.findOne.mockResolvedValue(makeAssignment());
      permissionRepo.findOne.mockResolvedValue({ id: PERMISSION_ID });
      permissionOverrideRepo.findOne.mockResolvedValue({ id: 'existing-override', isActive: true });

      await expect(
        service.addPermissionOverride(USER_ID, ROLE_ID, overrideDto as any, ASSIGNED_BY),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getUserOverrides
  // ═══════════════════════════════════════════════════════════════
  describe('getUserOverrides', () => {
    it('should return only active overrides mapped to their permission details', async () => {
      const activeOverride = {
        id: 'override-001',
        isActive: true,
        overrideType: OverrideType.GRANT,
        reason: 'Test',
        expiresAt: null,
        createdAt: new Date(),
        permission: { id: PERMISSION_ID, code: 'PATIENT:DELETE', name: 'Supprimer patient' },
        roleAssignment: { id: ASSIGNMENT_ID },
      };
      const expiredOverride = { ...activeOverride, id: 'override-002', isActive: false };

      // getUserOverrides calls getUserAssignments first
      roleAssignmentRepo.find.mockResolvedValue([
        makeAssignment(), // getUserAssignments
      ]);
      permissionOverrideRepo.find.mockResolvedValue([activeOverride, expiredOverride]);

      const result = await service.getUserOverrides(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].permission.code).toBe('PATIENT:DELETE');
    });
  });
});
