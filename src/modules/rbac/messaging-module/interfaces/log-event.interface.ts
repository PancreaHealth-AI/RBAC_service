import { Severity } from '../enums/severity.enum';

/** Charge utile métier d'un log (le producteur ajoute logType/service/timestamp). */
export interface LogEvent {
  action: string;
  serviceName?: string;
  userId?: string;
  resource?: string;
  resourceId?: string;
  target?: string;
  severity?: Severity;
  status?: 'SUCCESS' | 'FAILED' | 'PENDING';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}
