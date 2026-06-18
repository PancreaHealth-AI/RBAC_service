import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MessagingService } from '../../modules/rbac/messaging-module/messaging.service';
import {
  AUDIT_LOG_ACTION,
  AuditLogOptions,
} from '../decorators/audit-log.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly messagingService: MessagingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const auditOptions = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_ACTION,
      handler,
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap({
        next: (data) => {
          let resourceId = auditOptions.extractResourceId
            ? auditOptions.extractResourceId(request)
            : undefined;

          // Si aucune fonction d'extraction, deviner depuis les paramètres d'URL
          if (
            !resourceId &&
            request.params &&
            (request.params.id || request.params.userId)
          ) {
            resourceId = request.params.id || request.params.userId;
          }

          // Si toujours pas d'identifiant et qu'il y a un ID dans la réponse
          if (!resourceId && data && data.id) {
            resourceId = data.id;
          }

          this.messagingService.logAudit({
            action: auditOptions.action,
            userId: user?.sub ?? null,
            resource: auditOptions.resource ?? request.url,
            resourceId: resourceId,
            status: 'SUCCESS',
            ipAddress: ip,
            userAgent: userAgent,
            metadata: {
              method: request.method,
              url: request.url,
              params: request.params,
              query: request.query,
              body: this.sanitizeBody(request.body),
            },
          });
        },
        error: (error) => {
          let resourceId = auditOptions.extractResourceId
            ? auditOptions.extractResourceId(request)
            : undefined;

          if (
            !resourceId &&
            request.params &&
            (request.params.id || request.params.userId)
          ) {
            resourceId = request.params.id || request.params.userId;
          }

          this.messagingService.logAudit({
            action: auditOptions.action,
            userId: user?.sub ?? null,
            resource: auditOptions.resource ?? request.url,
            resourceId: resourceId,
            status: 'FAILED',
            ipAddress: ip,
            userAgent: userAgent,
            metadata: {
              method: request.method,
              url: request.url,
              error: error.message || String(error),
            },
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'mfaCode',
      'code',
    ];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '********';
      }
    }
    return sanitized;
  }
}
