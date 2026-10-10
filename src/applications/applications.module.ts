import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RiskModule } from '../risk/risk.module';
import { UsersModule } from '../users/users.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { MerchantApplication } from './entities/merchant-application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchantApplication]), UsersModule, AuditModule, RiskModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
