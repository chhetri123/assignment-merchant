import { Job } from 'bullmq';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  ApplicationStatus,
  MerchantApplication,
  RiskStatus,
} from '../applications/entities/merchant-application.entity';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { RiskProviderService } from './risk-provider.service';
import { RiskReviewProcessor } from './risk-review.processor';
import { RiskReviewJobData } from './risk.constants';

function buildApplication(overrides: Partial<MerchantApplication> = {}): MerchantApplication {
  return Object.assign(new MerchantApplication(), {
    id: 'app-1',
    status: ApplicationStatus.SUBMITTED,
    riskStatus: RiskStatus.PENDING,
    requestedMonthlyVolume: '1000.00',
    ownerTaxId: '123456789',
    ...overrides,
  });
}

function buildJob(attemptsMade = 0, attempts = 3): Job<RiskReviewJobData> {
  return {
    id: 'job-1',
    data: { applicationId: 'app-1', submittedAt: new Date().toISOString() },
    attemptsMade,
    opts: { attempts },
  } as Job<RiskReviewJobData>;
}

describe('RiskReviewProcessor', () => {
  let repository: jest.Mocked<Pick<Repository<MerchantApplication>, 'findOne' | 'save'>>;
  let provider: jest.Mocked<Pick<RiskProviderService, 'evaluate'>>;
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;
  let processor: RiskReviewProcessor;

  beforeEach(() => {
    repository = { findOne: jest.fn(), save: jest.fn((entity) => entity) } as never;
    provider = { evaluate: jest.fn() } as never;
    audit = { record: jest.fn() } as never;

    const manager = { getRepository: () => repository } as unknown as EntityManager;
    const dataSource = {
      transaction: (runner: (m: EntityManager) => Promise<unknown>) => runner(manager),
    } as DataSource;

    processor = new RiskReviewProcessor(
      repository as never,
      provider as never,
      audit as never,
      dataSource,
    );
  });

  it('persists the assessment and moves the application to review', async () => {
    const application = buildApplication();
    repository.findOne.mockResolvedValue(application);
    provider.evaluate.mockResolvedValue({
      reference: 'kyb_1',
      score: 82,
      status: RiskStatus.PASSED,
      reason: 'matched',
    });

    const result = await processor.process(buildJob());

    expect(result).toEqual({ status: RiskStatus.PASSED });
    expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(application.riskStatus).toBe(RiskStatus.PASSED);
    expect(application.riskScore).toBe(82);
    expect(application.riskReference).toBe('kyb_1');
    expect(application.riskCheckedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.RISK_REVIEW_COMPLETED }),
      expect.anything(),
    );
  });

  it('skips an application that is no longer SUBMITTED', async () => {
    repository.findOne.mockResolvedValue(
      buildApplication({ status: ApplicationStatus.UNDER_REVIEW, riskStatus: RiskStatus.PASSED }),
    );

    const result = await processor.process(buildJob(1));

    expect(result).toEqual({ skipped: true });
    expect(provider.evaluate).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('skips a deleted application instead of retrying forever', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(processor.process(buildJob())).resolves.toEqual({ skipped: true });
    expect(provider.evaluate).not.toHaveBeenCalled();
  });

  it('leaves the application pending while retries remain', async () => {
    await processor.onFailed(buildJob(1), new Error('provider timeout'));

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('parks the application for manual review after the last attempt', async () => {
    const application = buildApplication();
    repository.findOne.mockResolvedValue(application);

    await processor.onFailed(buildJob(3), new Error('provider timeout'));

    expect(application.riskStatus).toBe(RiskStatus.MANUAL_REVIEW);
    expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(audit.record).toHaveBeenCalled();
  });
});
