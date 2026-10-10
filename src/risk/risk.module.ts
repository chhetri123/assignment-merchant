import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { AuditModule } from '../audit/audit.module';
import { RiskProviderService } from './risk-provider.service';
import { RiskReviewProcessor } from './risk-review.processor';
import { RiskReviewQueue } from './risk-review.queue';
import { RISK_QUEUE } from './risk.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerchantApplication]),
    AuditModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({ name: RISK_QUEUE }),
  ],
  providers: [RiskProviderService, RiskReviewProcessor, RiskReviewQueue],
  exports: [RiskReviewQueue],
})
export class RiskModule {}
