/**
 * Unit tests for AssignmentsService:
 *   1. Validation of Redis cache hits (preventing gRPC overhead / DB queries)
 *   2. Application of permission overrides (GRANT / REVOKE)
 */

import { AssignmentsService } from './assignments.service';
import { OverrideType } from '@database/entities/permission-override.entity';

// ─── helpers ───────────────────────────────────────────────────

/** Build a minimal mock repository with jest.fn() stubs */
const mockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

/** Build a minimal mock Redis client */
const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
});

// ─── setup ─────────────────────────────────────────────────────

describe('AssignmentsService – Redis cache & permission overrides', () => {
  let service: AssignmentsService;
  let roleAssignmentRepo: ReturnType<typeof mockRepository>;
  let permissionOverrideRepo: ReturnType<typeof mockRepository>;
  let roleRepo: ReturnType<typeof mockRepository>;
  let permissionRepo: ReturnType<typeof mockRepository>;
  let rolePermissionRepo: ReturnType<typeof mockRepository>;
  let redis: ReturnType<typeof mockRedis>;

  const USER_ID = 'user-001';
  const ASSIGNMENT_ID = 'assign-001';
  const ROLE_ID = 'role-001';

  beforeEach(() => {
    roleAssignmentRepo = mockRepository();
    permissionOverrideRepo = mockRepository();
    roleRepo = mockRepository();
    permissionRepo = mockRepository();
    rolePermissionRepo = mockRepository();
    redis = mockRedis();

    // Instantiate service directly, injecting mocks in constructor order
    service = new AssignmentsService(
      roleAssignmentRepo as any,
      permissionOverrideRepo as any,
      roleRepo as any,
      permissionRepo as any,
      rolePermissionRepo as any,
      redis as any,
    );
  });

  // ═══════════════════════════════════════════════════════════════
  //  1.  REDIS CACHE HITS – preventing DB / gRPC overhead
  // ═══════════════════════════════════════════════════════════════

  describe('Redis cache hits (getPermissionCodesForAssignment)', () => {
    it('should return cached permission codes from Redis without querying DB', async () => {
      // Arrange – assignment exists
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });

      // Arrange – Redis has the cached result
      const cachedPermissions = ['PATIENT:READ', 'PATIENT:UPDATE'];
      redis.get.mockResolvedValue(JSON.stringify(cachedPermissions));

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – returned cached data
      expect(result).toEqual(cachedPermissions);

      // Assert – Redis was queried with the correct key
      const expectedKey = `user:${USER_ID}:assignment:${ASSIGNMENT_ID}:permcodes`;
      expect(redis.get).toHaveBeenCalledWith(expectedKey);

      // Assert – DB repos were NEVER called (cache hit skipped DB)
      expect(rolePermissionRepo.find).not.toHaveBeenCalled();
      expect(permissionOverrideRepo.find).not.toHaveBeenCalled();
    });

    it('should query DB and cache the result on Redis cache miss', async () => {
      // Arrange – assignment exists
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });

      // Arrange – Redis returns null (cache miss)
      redis.get.mockResolvedValue(null);

      // Arrange – DB returns base role permissions
      rolePermissionRepo.find.mockResolvedValue([
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:READ' } },
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:CREATE' } },
      ]);

      // Arrange – no overrides
      permissionOverrideRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – DB was queried
      expect(rolePermissionRepo.find).toHaveBeenCalled();
      expect(permissionOverrideRepo.find).toHaveBeenCalled();

      // Assert – correct permissions returned
      expect(result).toEqual(expect.arrayContaining(['PATIENT:READ', 'PATIENT:CREATE']));
      expect(result).toHaveLength(2);

      // Assert – result was stored in Redis with TTL 300s
      const expectedKey = `user:${USER_ID}:assignment:${ASSIGNMENT_ID}:permcodes`;
      expect(redis.set).toHaveBeenCalledWith(
        expectedKey,
        JSON.stringify(result),
        'EX',
        300,
      );
    });

    it('should also use Redis cache in getPermissionCodesByAssignment', async () => {
      // Arrange – assignment exists
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
      });

      // Arrange – Redis has cached data
      const cached = ['ENCOUNTER:READ'];
      redis.get.mockResolvedValue(JSON.stringify(cached));

      // Act
      const result = await service.getPermissionCodesByAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – returned cached data, no DB calls
      expect(result).toEqual(cached);
      expect(rolePermissionRepo.find).not.toHaveBeenCalled();
      expect(permissionOverrideRepo.find).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  2.  APPLICATION OF PERMISSION OVERRIDES (GRANT / REVOKE)
  // ═══════════════════════════════════════════════════════════════

  describe('Permission overrides – GRANT', () => {
    it('should add a GRANT override permission to the effective set', async () => {
      // Arrange – assignment exists
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });

      // Arrange – cache miss
      redis.get.mockResolvedValue(null);

      // Arrange – base role permissions
      rolePermissionRepo.find.mockResolvedValue([
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:READ' } },
      ]);

      // Arrange – GRANT override adds a new permission
      permissionOverrideRepo.find.mockResolvedValue([
        {
          roleAssignmentId: ASSIGNMENT_ID,
          overrideType: OverrideType.GRANT,
          permission: { code: 'PATIENT:DELETE' },
        },
      ]);

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – both the base and the granted override permission are present
      expect(result).toContain('PATIENT:READ');
      expect(result).toContain('PATIENT:DELETE');
      expect(result).toHaveLength(2);
    });

    it('should not duplicate a GRANT override if the permission already exists in role', async () => {
      // Arrange
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });
      redis.get.mockResolvedValue(null);

      rolePermissionRepo.find.mockResolvedValue([
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:READ' } },
      ]);

      // GRANT override for the same permission that already exists
      permissionOverrideRepo.find.mockResolvedValue([
        {
          roleAssignmentId: ASSIGNMENT_ID,
          overrideType: OverrideType.GRANT,
          permission: { code: 'PATIENT:READ' },
        },
      ]);

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – no duplicate
      expect(result).toEqual(['PATIENT:READ']);
    });
  });

  describe('Permission overrides – REVOKE', () => {
    it('should remove a REVOKE override permission from the effective set', async () => {
      // Arrange
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });
      redis.get.mockResolvedValue(null);

      rolePermissionRepo.find.mockResolvedValue([
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:READ' } },
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:DELETE' } },
      ]);

      // REVOKE overrides removes PATIENT:DELETE
      permissionOverrideRepo.find.mockResolvedValue([
        {
          roleAssignmentId: ASSIGNMENT_ID,
          overrideType: OverrideType.REVOKE,
          permission: { code: 'PATIENT:DELETE' },
        },
      ]);

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – PATIENT:DELETE was removed
      expect(result).toContain('PATIENT:READ');
      expect(result).not.toContain('PATIENT:DELETE');
      expect(result).toHaveLength(1);
    });

    it('should handle REVOKE for a permission not in the base role (no-op)', async () => {
      // Arrange
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });
      redis.get.mockResolvedValue(null);

      rolePermissionRepo.find.mockResolvedValue([
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:READ' } },
      ]);

      // REVOKE for a permission that doesn't exist in base role
      permissionOverrideRepo.find.mockResolvedValue([
        {
          roleAssignmentId: ASSIGNMENT_ID,
          overrideType: OverrideType.REVOKE,
          permission: { code: 'NONEXISTENT:PERM' },
        },
      ]);

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert – no change to base permissions
      expect(result).toEqual(['PATIENT:READ']);
    });
  });

  describe('Permission overrides – combined GRANT + REVOKE', () => {
    it('should apply GRANT and REVOKE overrides correctly together', async () => {
      // Arrange
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });
      redis.get.mockResolvedValue(null);

      rolePermissionRepo.find.mockResolvedValue([
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:READ' } },
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:UPDATE' } },
        { roleId: ROLE_ID, isGranted: true, permission: { code: 'PATIENT:DELETE' } },
      ]);

      permissionOverrideRepo.find.mockResolvedValue([
        // GRANT adds AI_MODEL:EXECUTE
        {
          roleAssignmentId: ASSIGNMENT_ID,
          overrideType: OverrideType.GRANT,
          permission: { code: 'AI_MODEL:EXECUTE' },
        },
        // REVOKE removes PATIENT:DELETE
        {
          roleAssignmentId: ASSIGNMENT_ID,
          overrideType: OverrideType.REVOKE,
          permission: { code: 'PATIENT:DELETE' },
        },
      ]);

      // Act
      const result = await service.getPermissionCodesForAssignment(USER_ID, ASSIGNMENT_ID);

      // Assert
      expect(result).toContain('PATIENT:READ');
      expect(result).toContain('PATIENT:UPDATE');
      expect(result).toContain('AI_MODEL:EXECUTE');
      expect(result).not.toContain('PATIENT:DELETE');
      expect(result).toHaveLength(3);
    });
  });

  describe('checkPermissionForAssignment', () => {
    it('should return true when the user has the permission (from cache)', async () => {
      // Arrange – cache returns the permission list
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });
      redis.get.mockResolvedValue(JSON.stringify(['PATIENT:READ', 'PATIENT:UPDATE']));

      // Act
      const result = await service.checkPermissionForAssignment(
        USER_ID,
        ASSIGNMENT_ID,
        'PATIENT:READ',
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when the user does NOT have the permission', async () => {
      // Arrange
      roleAssignmentRepo.findOne.mockResolvedValue({
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        isActive: true,
        role: { id: ROLE_ID },
      });
      redis.get.mockResolvedValue(JSON.stringify(['PATIENT:READ']));

      // Act
      const result = await service.checkPermissionForAssignment(
        USER_ID,
        ASSIGNMENT_ID,
        'PATIENT:DELETE',
      );

      // Assert
      expect(result).toBe(false);
    });
  });
});
