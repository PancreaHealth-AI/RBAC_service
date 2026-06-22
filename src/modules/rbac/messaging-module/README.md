# Messaging Module (Kafka résilient) — PancreaHealth-AI

Module NestJS mutualisé pour émettre **logs** (audit / sécurité / technique) et
**notifications** vers Kafka, sans jamais bloquer le service ni le faire échouer
si Kafka est indisponible.

## Installation
1. Copier le dossier `messaging/` dans `src/shared/` du service
   (ou dans `medical_platform_shared/src/` pour la mutualisation).
2. Ajouter la dépendance :
   ```bash
   npm install kafkajs
   ```
3. Variables d'environnement (`.env`) :
   ```env
   KAFKA_BROKERS=kafka:29092
   KAFKA_CLIENT_ID=rbac-service-producer
   NOTIFICATION_TOPIC=notifications.events
   # optionnels :
   KAFKA_BUFFER_MAX=10000
   KAFKA_BACKOFF_INIT_MS=1000
   KAFKA_BACKOFF_MAX_MS=30000
   KAFKA_FLUSH_BATCH=500
   ```

## Enregistrement (app.module.ts)
```ts
import { MessagingModule } from './shared/messaging/messaging.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ...
    MessagingModule.forService('rbac-service'), // lit l'environnement
  ],
})
export class AppModule {}
```

## Utilisation (n'importe quel service)
```ts
constructor(private readonly messaging: MessagingService) {}

// Log d'audit métier
this.messaging.logAudit({
  eventType: 'ROLE_ASSIGNED',
  action: 'ASSIGN_ROLE',
  userId: actorId,
  resource: 'role_assignment',
  resourceId: assignment.id,
  metadata: { roleId, targetUserId },
});

// Log de sécurité
this.messaging.logSecurity({
  eventType: 'PERMISSION_DENIED',
  action: 'ACCESS_DENIED',
  userId,
  resource: 'permission',
  severity: Severity.HIGH,
});

// Notification
this.messaging.notify({
  recipientId: targetUserId,
  channel: NotificationChannel.IN_APP,
  template: 'ROLE_GRANTED',
  data: { roleName },
});
```

## Garanties
- Démarrage indépendant de Kafka (connexion non bloquante).
- `emit/log/notify` *fire-and-forget* : aucune exception remontée au métier.
- Buffer borné (drop-oldest) rejoué automatiquement à la reconnexion.
- Reconnexion illimitée, backoff exponentiel plafonné.

## Observabilité
`messaging.health()` → `{ connected, buffered, dropped }` (utile pour un
endpoint `/health`).
