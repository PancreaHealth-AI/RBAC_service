import { Module } from '@nestjs/common';
import { RolesModule } from 'modules/rbac/roles/roles.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { getRedisConfig } from 'config/redis.config';
import { RedisModule } from '@nestjs-modules/ioredis';


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
    
    
    RolesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
