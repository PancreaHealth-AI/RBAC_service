import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MessagingService } from '../../modules/rbac/messaging-module/messaging.service';
import { Request, Response } from 'express';

@Catch()
export class TechnicalExceptionFilter implements ExceptionFilter {
  constructor(private readonly messagingService: MessagingService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    const errorMsg =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    // Classer l'action technique selon le message d'erreur
    let action = 'SYSTEM_EXCEPTION';
    const errorStr = (
      String(exception) +
      ' ' +
      errorMsg +
      ' ' +
      (stack ?? '')
    ).toLowerCase();

    if (
      errorStr.includes('database') ||
      errorStr.includes('query') ||
      errorStr.includes('typeorm') ||
      errorStr.includes('postgres') ||
      errorStr.includes('relation') ||
      errorStr.includes('sql')
    ) {
      if (errorStr.includes('connect') || errorStr.includes('connection')) {
        action = 'DATABASE_CONNECTION_ERROR';
      } else {
        action = 'DATABASE_QUERY_ERROR';
      }
    } else if (
      errorStr.includes('redis') ||
      errorStr.includes('ioredis') ||
      errorStr.includes('connection to redis')
    ) {
      action = 'REDIS_CONNECTION_ERROR';
    } else if (
      errorStr.includes('kafka') ||
      errorStr.includes('kafkajs') ||
      errorStr.includes('producer') ||
      errorStr.includes('broker') ||
      errorStr.includes('metadata request failed')
    ) {
      action = 'KAFKA_PRODUCER_ERROR';
    } else if (
      errorStr.includes('http') ||
      errorStr.includes('axios') ||
      errorStr.includes('fetch') ||
      errorStr.includes('gateway')
    ) {
      action = 'EXTERNAL_API_ERROR';
    }

    // Émission du log technique vers Kafka de manière asynchrone (fire-and-forget)
    try {
      this.messagingService.logTechnical({
        action,
        userId: (request as any).user?.sub ?? null,
        resource: request.url,
        status: 'FAILED',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          error: errorMsg,
          stack,
          statusCode: status,
          path: request.url,
          method: request.method,
        },
      });
    } catch (err) {
      console.error('Failed to emit technical log to Kafka:', err);
    }

    // Renvoyer la réponse HTTP standard
    if (response && typeof response.status === 'function') {
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      });
    }
  }
}
