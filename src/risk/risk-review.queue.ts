import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { RISK_QUEUE, RiskReviewJobData } from './risk.constants';

@Injectable()
export class RiskReviewQueue {
  private readonly logger = new Logger(RiskReviewQueue.name);

  constructor(
    @InjectQueue(RISK_QUEUE) private readonly queue: Queue<RiskReviewJobData>,
    private readonly config: ConfigService,
  ) {}

  // The job id is derived from the submission, so a duplicate enqueue for the
  // same submission is dropped by BullMQ instead of running twice.
  async enqueue(application: MerchantApplication): Promise<void> {
    const submittedAt = application.submittedAt ?? new Date();
    // BullMQ does not allow ':' in a custom job id.
    const jobId = `${application.id}_${submittedAt.getTime()}`;

    await this.queue.add(
      'review',
      { applicationId: application.id, submittedAt: submittedAt.toISOString() },
      {
        jobId,
        attempts: this.config.get<number>('risk.attempts') ?? 3,
        backoff: {
          type: 'exponential',
          delay: this.config.get<number>('risk.backoffMs') ?? 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    this.logger.log(`Queued risk review job ${jobId}`);
  }
}
