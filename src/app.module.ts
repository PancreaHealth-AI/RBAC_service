import { Module } from '@nestjs/common';
import { RolesModule } from './modules/rbac/roles/roles.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { getRedisConfig } from './config/redis.config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { APP_GUARD } from '@nestjs/core';
import { JwtGatewayGuard } from './common/guards/jwt-gateway.guard';
import { PermissionsModule } from './modules/rbac/permissions/permissions.module';
import { AssignmentsModule } from './modules/rbac/assignments/assignments.module';
import { PermissionOverridesModule } from './modules/rbac/permission-overrides/permission-overrides.module';
import { RbacGrpcServer } from './grpc/rbac-grpc.server';
//  a integre apres
// import { JwtGatewayGuard } from 'medical_platform_shared';



@Module({
  imports: [
     ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),

    // redis
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = getRedisConfig(configService);
        return { ...config, type: 'single' as const };
      },
    }),
    
    
    RolesModule,
    PermissionsModule,
    AssignmentsModule,
    PermissionOverridesModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGatewayGuard,
    },
    RbacGrpcServer
  ]
})
export class AppModule {}
