/** Noms de topics par défaut. Surchargés via MessagingOptions.topics. */
export const DEFAULT_TOPICS = {
  auditLogs: 'audit.logs',
  securityLogs: 'security.logs',
  technicalLogs: 'technical.logs',
  notifications: 'notifications.events',
  resetPassword: 'reset.password',
  verifyCode: 'verify.code',
  emergencyAccess: 'emergency.access',
  forgetPassword: 'forgetPassword.event',
  userEvents: 'user.events',
} as const;
