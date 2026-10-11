import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuthorizationModule } from './authorization/authorization.module';
import { PoliciesGuard } from './authorization/guards/policies.guard';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    RedisModule,
    // Redis-backed so the limit is shared by every API instance.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(config.getOrThrow<number>('throttle.ttlSeconds')),
            limit: config.getOrThrow<number>('throttle.defaultLimit'),
          },
        ],
        storage: new ThrottlerStorageRedisService({
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          db: config.get<number>('redis.db') ?? 0,
        }),
      }),
    }),
    AuthorizationModule,
    AuthModule,
    ApplicationsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Runs before authentication, so unauthenticated floods are capped too.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
  ],
})
export class AppModule {}
