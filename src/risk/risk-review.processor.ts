import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Job } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { assertTransition } from '../applications/application-state.machine';
import {
  ApplicationStatus,
  MerchantApplication,
  RiskStatus,
} from '../applications/entities/merchant-application.entity';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { RiskProviderService } from './risk-provider.service';
import { RISK_QUEUE, type RiskReviewJobData } from './risk.constants';

export type RiskReviewOutcome = { status: RiskStatus } | { skipped: true };

export function isFinalAttempt(attemptsMade: number, attempts: number): boolean {
  return attemptsMade >= attempts;
}

@Processor(RISK_QUEUE, { concurrency: 5 })
export class RiskReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(RiskReviewProcessor.name);

  constructor(
    @InjectRepository(MerchantApplication)
    private readonly applications: Repository<MerchantApplication>,
    private readonly provider: RiskProviderService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  // Thin adapter: everything testable lives in review()/parkForManualReview().
  async process(job: Job<RiskReviewJobData>): Promise<RiskReviewOutcome> {
    return this.review(job.data.applicationId, job.id ?? 'unknown', job.attemptsMade + 1);
  }

  async review(applicationId: string, jobId: string, attempt: number): Promise<RiskReviewOutcome> {
    const application = await this.applications.findOne({ where: { id: applicationId } });

    if (!application) {
      // Nothing to retry for: drop the job instead of re-queueing.
      this.logger.warn(`Application ${applicationId} no longer exists, dropping job ${jobId}`);
      return { skipped: true };
    }

    // A retry or redelivery after a successful run finds the application
    // already moved on and does nothing.
    if (application.status !== ApplicationStatus.SUBMITTED) {
      this.logger.log(`Application ${applicationId} is ${application.status}, skipping ${jobId}`);
      return { skipped: true };
    }

    const assessment = await this.provider.evaluate(application);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      assertTransition(application.status, ApplicationStatus.UNDER_REVIEW);

      application.status = ApplicationStatus.UNDER_REVIEW;
      application.riskStatus = assessment.status;
      application.riskScore = assessment.score;
      application.riskReference = assessment.reference;
      application.riskReason = assessment.reason;
      application.riskCheckedAt = new Date();
      await repository.save(application);

      await this.audit.record(
        {
          action: AuditAction.RISK_REVIEW_COMPLETED,
          entityType: 'MerchantApplication',
          entityId: applicationId,
          metadata: {
            jobId,
            riskStatus: assessment.status,
            riskScore: assessment.score,
            riskReference: assessment.reference,
            attempt,
          },
        },
        manager,
      );
    });

    return { status: assessment.status };
  }

  // Park the application for a human instead of leaving it PENDING forever.
  async parkForManualReview(applicationId: string, jobId: string, attempts: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      const application = await repository.findOne({ where: { id: applicationId } });
      if (!application || application.status !== ApplicationStatus.SUBMITTED) {
        return;
      }

      application.status = ApplicationStatus.UNDER_REVIEW;
      application.riskStatus = RiskStatus.MANUAL_REVIEW;
      application.riskReason = 'Risk provider unavailable, manual review required';
      application.riskCheckedAt = new Date();
      await repository.save(application);

      await this.audit.record(
        {
          action: AuditAction.RISK_REVIEW_COMPLETED,
          entityType: 'MerchantApplication',
          entityId: application.id,
          metadata: { jobId, riskStatus: RiskStatus.MANUAL_REVIEW, attempts },
        },
        manager,
      );
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<RiskReviewJobData>, error: Error): Promise<void> {
    const attempts = job.opts.attempts ?? 1;
    const jobId = job.id ?? 'unknown';
    this.logger.warn(
      `Risk job ${jobId} failed on attempt ${job.attemptsMade}/${attempts}: ${error.message}`,
    );

    if (isFinalAttempt(job.attemptsMade, attempts)) {
      await this.parkForManualReview(job.data.applicationId, jobId, attempts);
    }
  }
}
