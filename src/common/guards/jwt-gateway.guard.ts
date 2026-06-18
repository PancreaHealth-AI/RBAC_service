import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class JwtGatewayGuard implements CanActivate {
  private publicKey: string;

  constructor(
    private configService: ConfigService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {
    const keyPath = this.configService.get<string>('JWT_PUBLIC_KEY_PATH');
    if (!keyPath) {
      throw new Error('JWT_PUBLIC_KEY_PATH is not defined in configuration');
    }
    this.publicKey = fs.readFileSync(keyPath, 'utf8');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }

    try {
      const payload = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as any;

      const sessionId = payload.sessionId;

      // CHECK REDIS BLACKLIST
      const blacklistKey = `blacklist:session:${sessionId}`;
      const isRevoked = await this.redis.get(blacklistKey);

      if (isRevoked) {
        throw new UnauthorizedException('Session révoquée');
      }

      request.user = {
        sub: payload.sub,
        username: payload.username,
        email: payload.email,
        sessionId: payload.sessionId,
        role: payload.role ?? null,
        assignedId: payload.assignedId ?? null,
        scope: payload.scope ?? null,
        scopeId: payload.scopeId ?? null,
        hospitalId: payload.hospitalId ?? null,
        departmentId: payload.departmentId ?? null,
        serviceId: payload.serviceId ?? null,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}