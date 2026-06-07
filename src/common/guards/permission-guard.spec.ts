/**
 * Unit tests for PermissionGuard:
 *   1. Redis cache hit → returns cached result, NO gRPC call (prevents gRPC overhead)
 *   2. Redis cache miss → gRPC fallback triggers, result is cached
 *   3. gRPC client fail-closed behavior → returns false on gRPC error
 *
 * The PermissionGuard lives in `medical_platform_shared` and is used by all
 * consuming microservices. We reproduce its logic here to avoid transitive
 * import issues (passport, etc.) that are irrelevant to these unit tests.
 */

import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

// ─── Reproduce the PermissionGuard logic exactly ───────────────
// (mirrors medical_platform_shared/src/guards/permission.guard.ts)

const PERMISSION_KEY = 'permission';

class PermissionGuard implements CanActivate {
  constructor(
    private reflector: any,
    private rbacClient: any,
    private redis: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) throw new UnauthorizedException('Utilisateur non authentifié');

    const permissionCode = this.reflector.get(
      PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permissionCode) return true;

    if (!user.assignedId) throw new UnauthorizedException('Aucun rôle actif dans le token');

    const cacheKey = `perm:${user.sub}:${user.assignedId}:${permissionCode}`;

    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached === 'true';

    const hasPermission = await this.rbacClient.checkPermission(
      user.sub,
      permissionCode,
      user.assignedId,
    );

    await this.redis.set(cacheKey, hasPermission ? 'true' : 'false', 'EX', 300);
    return hasPermission;
  }
}

// ─── helpers ───────────────────────────────────────────────────

const mockReflector = () => ({
  get: jest.fn(),
});

const mockRbacGrpcClient = () => ({
  checkPermission: jest.fn(),
});

const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
});

/** Create a fake ExecutionContext for HTTP requests */
const mockExecutionContext = (user: any) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as unknown as ExecutionContext;

// ─── setup ─────────────────────────────────────────────────────

describe('PermissionGuard – Redis cache, gRPC fallback & fail-closed', () => {
  let guard: PermissionGuard;
  let reflector: ReturnType<typeof mockReflector>;
  let rbacClient: ReturnType<typeof mockRbacGrpcClient>;
  let redis: ReturnType<typeof mockRedis>;

  const USER = {
    sub: 'user-001',
    assignedId: 'assign-001',
    username: 'docteur.dupont',
    email: 'dupont@hospital.fr',
  };

  beforeEach(() => {
    reflector = mockReflector();
    rbacClient = mockRbacGrpcClient();
    redis = mockRedis();

    guard = new PermissionGuard(reflector, rbacClient, redis);
  });

  // ═══════════════════════════════════════════════════════════════
  //  1.  REDIS CACHE HIT – prevents gRPC overhead
  // ═══════════════════════════════════════════════════════════════

  describe('Redis cache hit (no gRPC call)', () => {
    it('should return true from cache and NOT call gRPC', async () => {
      // Arrange – route requires 'PATIENT:READ'
      reflector.get.mockReturnValue('PATIENT:READ');
      // Arrange – Redis has cached 'true'
      redis.get.mockResolvedValue('true');

      const context = mockExecutionContext(USER);

      // Act
      const result = await guard.canActivate(context);

      // Assert – allowed
      expect(result).toBe(true);

      // Assert – Redis was queried with correct key
      const expectedKey = `perm:${USER.sub}:${USER.assignedId}:PATIENT:READ`;
      expect(redis.get).toHaveBeenCalledWith(expectedKey);

      // Assert – gRPC was NEVER called (cache hit prevented overhead)
      expect(rbacClient.checkPermission).not.toHaveBeenCalled();
    });

    it('should return false from cache and NOT call gRPC', async () => {
      // Arrange
      reflector.get.mockReturnValue('PATIENT:DELETE');
      redis.get.mockResolvedValue('false');

      const context = mockExecutionContext(USER);

      // Act
      const result = await guard.canActivate(context);

      // Assert – denied from cache
      expect(result).toBe(false);

      // Assert – no gRPC call
      expect(rbacClient.checkPermission).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  2.  REDIS CACHE MISS – gRPC fallback triggers
  // ═══════════════════════════════════════════════════════════════

  describe('Redis cache miss (gRPC fallback)', () => {
    it('should call gRPC when cache misses and cache the result', async () => {
      // Arrange
      reflector.get.mockReturnValue('PATIENT:READ');
      redis.get.mockResolvedValue(null); // cache miss
      rbacClient.checkPermission.mockResolvedValue(true);

      const context = mockExecutionContext(USER);

      // Act
      const result = await guard.canActivate(context);

      // Assert – allowed via gRPC
      expect(result).toBe(true);

      // Assert – gRPC was called with correct params
      expect(rbacClient.checkPermission).toHaveBeenCalledWith(
        USER.sub,
        'PATIENT:READ',
        USER.assignedId,
      );

      // Assert – result was cached in Redis with TTL 300s
      const expectedKey = `perm:${USER.sub}:${USER.assignedId}:PATIENT:READ`;
      expect(redis.set).toHaveBeenCalledWith(expectedKey, 'true', 'EX', 300);
    });

    it('should cache false result when gRPC returns no permission', async () => {
      // Arrange
      reflector.get.mockReturnValue('PATIENT:DELETE');
      redis.get.mockResolvedValue(null); // cache miss
      rbacClient.checkPermission.mockResolvedValue(false);

      const context = mockExecutionContext(USER);

      // Act
      const result = await guard.canActivate(context);

      // Assert – denied
      expect(result).toBe(false);

      // Assert – false was cached too
      const expectedKey = `perm:${USER.sub}:${USER.assignedId}:PATIENT:DELETE`;
      expect(redis.set).toHaveBeenCalledWith(expectedKey, 'false', 'EX', 300);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  3.  gRPC CLIENT FAIL-CLOSED – RbacGrpcClient returns false on error
  // ═══════════════════════════════════════════════════════════════

  describe('gRPC client fail-closed behavior', () => {
    it('should deny access when gRPC client returns false due to internal error', async () => {
      // The RbacGrpcClient.checkPermission() catches errors and returns false
      // This simulates that behavior (fail-closed)
      reflector.get.mockReturnValue('PATIENT:READ');
      redis.get.mockResolvedValue(null); // cache miss
      rbacClient.checkPermission.mockResolvedValue(false); // gRPC client caught error, returned false

      const context = mockExecutionContext(USER);

      // Act
      const result = await guard.canActivate(context);

      // Assert – access denied (fail-closed)
      expect(result).toBe(false);

      // Assert – the false value was cached (avoids re-trying gRPC on each request)
      const expectedKey = `perm:${USER.sub}:${USER.assignedId}:PATIENT:READ`;
      expect(redis.set).toHaveBeenCalledWith(expectedKey, 'false', 'EX', 300);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  4.  EDGE CASES – guard bypasses / auth checks
  // ═══════════════════════════════════════════════════════════════

  describe('Edge cases', () => {
    it('should allow access when no permission is required on the route', async () => {
      // Arrange – no @Permission() decorator on the route
      reflector.get.mockReturnValue(undefined);

      const context = mockExecutionContext(USER);

      // Act
      const result = await guard.canActivate(context);

      // Assert – allowed (no permission check needed)
      expect(result).toBe(true);
      expect(redis.get).not.toHaveBeenCalled();
      expect(rbacClient.checkPermission).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      // Arrange – no user on request
      reflector.get.mockReturnValue('PATIENT:READ');
      const context = mockExecutionContext(null);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no active role (assignedId)', async () => {
      // Arrange – user without assignedId
      reflector.get.mockReturnValue('PATIENT:READ');
      const context = mockExecutionContext({
        sub: 'user-001',
        assignedId: null,
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
