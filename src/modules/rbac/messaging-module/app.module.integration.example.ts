// EXEMPLE d'intégration dans le service RBAC (NestJS 11) — à adapter.
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from '../../../config/database.config';
import { MessagingModule } from './messaging.module';
// ... autres imports existants

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => getDatabaseConfig(c),
    }),

    // 👇 une seule ligne ; MessagingService devient injectable partout
    MessagingModule.forService('rbac-service'),

    // RolesModule, PermissionsModule, AssignmentsModule, ...
  ],
})
export class AppModule {}
