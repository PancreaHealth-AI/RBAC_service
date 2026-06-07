/**
 * Unit tests for RbacGrpcServer:
 *   - gRPC fallback mechanism and fail-closed behavior on error
 *   - Verifies that errors from AssignmentsService propagate correctly
 *     (fail-closed: access denied when the service is unreachable/errors)
 */

import { RbacGrpcServer } from './rbac-grpc.server';

// ─── helpers ───────────────────────────────────────────────────

const mockAssignmentsService = () => ({
  checkPermissionForAssignment: jest.fn(),
  getUserRoles: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string, defaultVal?: any) => {
    if (key === 'GRPC_PORT') return 3003;
    if (key === 'RBAC_PROTO_PATH') return './src/proto/rbac.proto';
    return defaultVal;
  }),
});

// ─── setup ─────────────────────────────────────────────────────

describe('RbacGrpcServer – gRPC fallback & fail-closed behavior', () => {
  let server: RbacGrpcServer;
  let assignmentsService: ReturnType<typeof mockAssignmentsService>;
  let configService: ReturnType<typeof mockConfigService>;

  beforeEach(() => {
    assignmentsService = mockAssignmentsService();
    configService = mockConfigService();

    server = new RbacGrpcServer(
      assignmentsService as any,
      configService as any,
    );
  });

  // ═══════════════════════════════════════════════════════════════
  //  CheckPermission
  // ═══════════════════════════════════════════════════════════════

  describe('CheckPermission', () => {
    it('should return has_permission=true when the user has the permission', async () => {
      // Arrange
      assignmentsService.checkPermissionForAssignment.mockResolvedValue(true);

      const call = {
        request: {
          user_id: 'user-001',
          permission_code: 'PATIENT:READ',
          assignment_id: 'assign-001',
        },
      };
      const callback = jest.fn();

      // Act – invoke the private method via bracket notation
      await (server as any).checkPermission(call, callback);

      // Assert
      expect(callback).toHaveBeenCalledWith(null, { has_permission: true });
      expect(assignmentsService.checkPermissionForAssignment).toHaveBeenCalledWith(
        'user-001',
        'assign-001',
        'PATIENT:READ',
      );
    });

    it('should return has_permission=false when the user does NOT have the permission', async () => {
      // Arrange
      assignmentsService.checkPermissionForAssignment.mockResolvedValue(false);

      const call = {
        request: {
          user_id: 'user-001',
          permission_code: 'PATIENT:DELETE',
          assignment_id: 'assign-001',
        },
      };
      const callback = jest.fn();

      // Act
      await (server as any).checkPermission(call, callback);

      // Assert
      expect(callback).toHaveBeenCalledWith(null, { has_permission: false });
    });

    it('FAIL-CLOSED: should call callback with error when the service throws', async () => {
      // Arrange – simulate a service-level error (DB down, etc.)
      const serviceError = new Error('Database connection lost');
      assignmentsService.checkPermissionForAssignment.mockRejectedValue(serviceError);

      const call = {
        request: {
          user_id: 'user-001',
          permission_code: 'PATIENT:READ',
          assignment_id: 'assign-001',
        },
      };
      const callback = jest.fn();

      // Act
      await (server as any).checkPermission(call, callback);

      // Assert – error is forwarded (fail-closed: caller receives an error, NOT a false-positive)
      expect(callback).toHaveBeenCalledWith(serviceError, null);
    });

    it('should return has_permission=false when no assignment_id is provided', async () => {
      // Arrange – no assignment_id means checkPermissionForAssignment is not called
      // The current implementation only calls the service when assignment_id is truthy
      const call = {
        request: {
          user_id: 'user-001',
          permission_code: 'PATIENT:READ',
          assignment_id: '', // empty = falsy
        },
      };
      const callback = jest.fn();

      // Act
      await (server as any).checkPermission(call, callback);

      // Assert – default false when no assignmentId
      expect(callback).toHaveBeenCalledWith(null, { has_permission: false });
      expect(assignmentsService.checkPermissionForAssignment).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  GetUserRoles
  // ═══════════════════════════════════════════════════════════════

  describe('GetUserRoles', () => {
    it('should return mapped roles on success', async () => {
      // Arrange
      assignmentsService.getUserRoles.mockResolvedValue([
        {
          id: 'assign-001',
          roleId: 'role-001',
          roleName: 'Médecin',
          roleCode: 'DOCTOR',
          roleType: 'SYSTEM',
          scopeType: 'HOSPITAL',
          scopeId: 'hosp-001',
        },
      ]);

      const call = { request: { user_id: 'user-001' } };
      const callback = jest.fn();

      // Act
      await (server as any).getUserRoles(call, callback);

      // Assert
      expect(callback).toHaveBeenCalledWith(null, {
        roles: [
          {
            assignment_id: 'assign-001',
            role_id: 'role-001',
            role_name: 'Médecin',
            role_code: 'DOCTOR',
            role_type: 'SYSTEM',
            scope_type: 'HOSPITAL',
            scope_id: 'hosp-001',
          },
        ],
      });
    });

    it('should return empty roles when user has no roles', async () => {
      // Arrange
      assignmentsService.getUserRoles.mockResolvedValue([]);

      const call = { request: { user_id: 'user-002' } };
      const callback = jest.fn();

      // Act
      await (server as any).getUserRoles(call, callback);

      // Assert
      expect(callback).toHaveBeenCalledWith(null, { roles: [] });
    });

    it('FAIL-CLOSED: should call callback with error when the service throws', async () => {
      // Arrange – service is down
      const serviceError = new Error('Service unavailable');
      assignmentsService.getUserRoles.mockRejectedValue(serviceError);

      const call = { request: { user_id: 'user-001' } };
      const callback = jest.fn();

      // Act
      await (server as any).getUserRoles(call, callback);

      // Assert – error is forwarded to the gRPC caller (fail-closed)
      expect(callback).toHaveBeenCalledWith(serviceError, null);
    });
  });
});
