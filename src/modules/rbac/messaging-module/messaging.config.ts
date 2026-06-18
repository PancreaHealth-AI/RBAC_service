import { DEFAULT_TOPICS } from './topics';

export const MESSAGING_OPTIONS = 'MESSAGING_OPTIONS';

export interface MessagingTopics {
  auditLogs: string;
  securityLogs: string;
  technicalLogs: string;
  notifications: string;
  resetPassword: string;
  verifyCode: string;
  emergencyAccess: string;
  forgetPassword: string;
  userEvents: string;
}

export interface MessagingOptions {
  /** Nom du service émetteur, injecté dans chaque événement. */
  serviceName: string;
  brokers: string[];
  clientId?: string;
  /** Taille max du buffer en mémoire (débordement = drop-oldest). */
  bufferMaxSize?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  /** Nb max de messages envoyés par batch lors d'un flush. */
  flushBatchSize?: number;
  topics?: Partial<MessagingTopics>;
}

/** Construit les options à partir des variables d'environnement. */
export function messagingOptionsFromEnv(serviceName: string): MessagingOptions {
  return {
    serviceName,
    brokers: (
      process.env.KAFKA_BROKERS ||
      process.env.KAFKA_BROKER ||
      'localhost:9092'
    ).split(','),
    clientId: process.env.KAFKA_CLIENT_ID || `${serviceName}-producer`,
    bufferMaxSize: Number(process.env.KAFKA_BUFFER_MAX || 10000),
    initialBackoffMs: Number(process.env.KAFKA_BACKOFF_INIT_MS || 1000),
    maxBackoffMs: Number(process.env.KAFKA_BACKOFF_MAX_MS || 30000),
    flushBatchSize: Number(process.env.KAFKA_FLUSH_BATCH || 500),
    topics: {
      auditLogs: process.env.AUDIT_LOG_TOPIC || DEFAULT_TOPICS.auditLogs,
      securityLogs:
        process.env.SECURITY_LOG_TOPIC || DEFAULT_TOPICS.securityLogs,
      technicalLogs:
        process.env.TECHNICAL_LOG_TOPIC || DEFAULT_TOPICS.technicalLogs,
      notifications:
        process.env.NOTIFICATION_TOPIC || DEFAULT_TOPICS.notifications,
      resetPassword:
        process.env.RESET_PASSWORD_TOPIC || DEFAULT_TOPICS.resetPassword,
      verifyCode: process.env.VERIFY_CODE_TOPIC || DEFAULT_TOPICS.verifyCode,
      emergencyAccess:
        process.env.EMERGENCY_ACCESS_TOPIC || DEFAULT_TOPICS.emergencyAccess,
      forgetPassword:
        process.env.FORGET_PASSWORD_TOPIC || DEFAULT_TOPICS.forgetPassword,
      userEvents:
        process.env.USER_EVENTS_TOPIC || DEFAULT_TOPICS.userEvents,
    },
  };
}

export function resolveTopics(opts: MessagingOptions): MessagingTopics {
  return { ...DEFAULT_TOPICS, ...(opts.topics || {}) };
}
