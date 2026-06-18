import { Injectable, Inject } from '@nestjs/common';
import { ResilientKafkaProducer } from './resilient-kafka.producer';
import {
  MESSAGING_OPTIONS,
  MessagingTopics,
  resolveTopics,
} from './messaging.config';
import type { MessagingOptions } from './messaging.config';
import { LogType } from './enums/log-type.enum';
import { Severity } from './enums/severity.enum';
import { LogEvent } from './interfaces/log-event.interface';
import { NotificationEvent } from './interfaces/notification-event.interface';

/**
 * API de haut niveau injectée dans n'importe quel service.
 * Émet logs (audit / sécurité / technique) et notifications, sans jamais
 * bloquer ni faire échouer la logique métier appelante.
 */
@Injectable()
export class MessagingService {
  public readonly topics: MessagingTopics;
  private readonly serviceName: string;

  constructor(
    private readonly producer: ResilientKafkaProducer,
    @Inject(MESSAGING_OPTIONS) opts: MessagingOptions,
  ) {
    this.topics = resolveTopics(opts);
    this.serviceName = opts.serviceName;
  }

  logAudit(event: LogEvent): void {
    this.emitLog(LogType.AUDIT, this.topics.auditLogs, event, Severity.LOW);
  }

  logSecurity(event: LogEvent): void {
    this.emitLog(
      LogType.SECURITY,
      this.topics.securityLogs,
      event,
      Severity.HIGH,
    );
  }

  logTechnical(event: LogEvent): void {
    this.emitLog(
      LogType.TECHNICAL,
      this.topics.technicalLogs,
      event,
      Severity.MEDIUM,
    );
  }

  notify(event: NotificationEvent, topic?: string): void {
    const key = event.recipientId ?? event.userId;
    this.producer.emit(topic ?? this.topics.notifications, key, {
      ...event,
      templateCode: event.templateCode ?? event.template,
      variables: event.variables ?? event.data,
      sourceService: this.serviceName,
      timestamp: new Date().toISOString(),
    });
  }

  private emitLog(
    logType: LogType,
    topic: string,
    event: LogEvent,
    defaultSeverity: Severity,
  ) {
    const payload = {
      logType,
      service: this.serviceName,
      severity: event.severity ?? defaultSeverity,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.producer.emit(topic, event.userId ?? null, payload);
  }

  health() {
    return this.producer.health();
  }
}
