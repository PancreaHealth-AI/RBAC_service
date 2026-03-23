import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (configService: ConfigService) => ({
  type: 'single',
  url: `redis://${configService.get<string>('REDIS_HOST')}:${configService.get<number>('REDIS_PORT')}`,
  options: {
    password: configService.get<string>('REDIS_PASSWORD'),
    db: configService.get<number>('REDIS_DB', 0),
  },
});


// # 3. Démarrer Redis
// brew services start redis

// # 4. Vérifier que Redis fonctionne
// redis-cli ping