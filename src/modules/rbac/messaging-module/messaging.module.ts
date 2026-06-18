import { DynamicModule, Global, Module } from '@nestjs/common';
import { ResilientKafkaProducer } from './resilient-kafka.producer';
import { MessagingService } from './messaging.service';
import {
  MESSAGING_OPTIONS,
  MessagingOptions,
  messagingOptionsFromEnv,
} from './messaging.config';

/**
 * Module Kafka mutualisé. À enregistrer UNE fois dans l'app.module de chaque
 * service ; MessagingService devient injectable partout (module @Global).
 *
 *   MessagingModule.forRoot({ serviceName: 'rbac-service', brokers: [...] })
 *   // ou, en lisant l'environnement :
 *   MessagingModule.forService('rbac-service')
 */
@Global()
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingOptions): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        { provide: MESSAGING_OPTIONS, useValue: options },
        ResilientKafkaProducer,
        MessagingService,
      ],
      exports: [MessagingService, ResilientKafkaProducer],
    };
  }

  static forService(serviceName: string): DynamicModule {
    return MessagingModule.forRoot(messagingOptionsFromEnv(serviceName));
  }
}
