import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_ACTION = 'audit_log_action';

export interface AuditLogOptions {
  action: string;
  resource?: string;
  extractResourceId?: (req: any) => string;
}

/**
 * Décorateur pour spécifier une action d'audit sur un endpoint HTTP.
 * Exemple : @AuditLog('patient.created') ou @AuditLog({ action: 'patient.updated', resource: 'patient' })
 */
export const AuditLog = (options: string | AuditLogOptions) => {
  const metaValue = typeof options === 'string' ? { action: options } : options;
  return SetMetadata(AUDIT_LOG_ACTION, metaValue);
};
