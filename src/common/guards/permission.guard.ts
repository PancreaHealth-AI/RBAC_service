import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGrpcClient } from 'medical_platform_shared';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { MessagingService } from '../../modules/rbac/messaging-module/messaging.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacClient: RbacGrpcClient,
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

    // 1. Cache Redis
    const cached = await this.redis.get(cacheKey);
    console.log(`Cache check for key Auth service ${cacheKey}: ${cached}`);
    if (cached !== null) {
      const allowed = cached === 'true';
      if (!allowed) {
        this.messagingService.logSecurity({
          action: 'auth.permission_denied',
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

    // 2. Appel gRPC RBAC
    const hasPermission = await this.rbacClient.checkPermission(
      user.sub,
      permissionCode,
      assignmentId,
    );

    // 3. Stocker en cache 15 minutes
    await this.redis.set(cacheKey, hasPermission ? 'true' : 'false', 'EX', 900);

    if (!hasPermission) {
      this.messagingService.logSecurity({
        action: 'auth.permission_denied',
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
