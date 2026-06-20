import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { MessagingService } from '../../modules/rbac/messaging-module/messaging.service';
import { AssignmentsService } from '../../modules/rbac/assignments/assignments.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private assignmentsService: AssignmentsService,
    @InjectRedis() private readonly redis: Redis,
    private readonly messagingService: MessagingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      this.messagingService.logSecurity({
        action: 'UNAUTHORIZED_ACCESS',
        status: 'FAILED',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          path: request.url,
          method: request.method,
          reason: 'Utilisateur non authentifie',
        },
      });
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const permissionCode = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );

    if (!permissionCode) {
      return true;
    }

    const assignmentId = user.assignedId;
    if (!assignmentId) {
      this.messagingService.logSecurity({
        action: 'UNAUTHORIZED_ACCESS',
        userId: user.sub,
        status: 'FAILED',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          path: request.url,
          method: request.method,
          reason: 'Aucun role actif dans le token',
        },
      });
      throw new UnauthorizedException('Aucun rôle actif dans le token');
    }

    const cacheKey = `perm:${user.sub}:${assignmentId}:${permissionCode}`;

    // 1. Cache Redis avec tolérance aux pannes
    let cached: string | null = null;
    try {
      cached = await this.redis.get(cacheKey);
      console.log(`Cache check for key dme service ${cacheKey}: ${cached}`);
    } catch (err) {
      this.messagingService.logTechnical({
        action: 'REDIS_QUERY_FAILURE',
        status: 'FAILED',
        metadata: {
          error: err.message,
          operation: 'get',
          key: cacheKey,
        },
      });
    }

    if (cached !== null) {
      const allowed = cached === 'true';
      console.log(`Permission ${permissionCode} for user ${user.sub} with assignment ${assignmentId}: ${allowed}`);
      if (!allowed) {
        this.messagingService.logSecurity({
          action: 'INSUFFICIENT_PERMISSIONS',
          userId: user.sub,
          resource: 'permission',
          target: permissionCode,
          status: 'FAILED',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            assignmentId,
            permissionCode,
            fromCache: true,
          },
        });
      }
      return allowed;
    }

    // 2. Appel local service
    const hasPermission = await this.assignmentsService.checkPermissionForAssignment(
      user.sub,
      assignmentId,
      permissionCode,
    );

    // 3. Stocker en cache 15 minutes avec tolérance aux pannes
    try {
      await this.redis.set(cacheKey, hasPermission ? 'true' : 'false', 'EX', 900);
    } catch (err) {
      this.messagingService.logTechnical({
        action: 'REDIS_QUERY_FAILURE',
        status: 'FAILED',
        metadata: {
          error: err.message,
          operation: 'set',
          key: cacheKey,
        },
      });
    }

    if (!hasPermission) {
      console.log("Permission denied for user", user.sub, "with permission", permissionCode);
      this.messagingService.logSecurity({
        action: 'INSUFFICIENT_PERMISSIONS',
        userId: user.sub,
        resource: 'permission',
        target: permissionCode,
        status: 'FAILED',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          assignmentId,
          permissionCode,
          fromCache: false,
        },
      });
    }

    return hasPermission;
  }
}
