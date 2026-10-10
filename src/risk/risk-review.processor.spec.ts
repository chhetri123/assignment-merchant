import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  ApplicationStatus,
  MerchantApplication,
  RiskStatus,
} from '../applications/entities/merchant-application.entity';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { RiskProviderService } from './risk-provider.service';
import { RiskReviewProcessor, isFinalAttempt } from './risk-review.processor';

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

describe('RiskReviewProcessor', () => {
  const findOne = jest.fn<Promise<MerchantApplication | null>, [unknown]>();
  const save = jest.fn((entity: MerchantApplication) => Promise.resolve(entity));
  const evaluate =
    jest.fn<Promise<Awaited<ReturnType<RiskProviderService['evaluate']>>>, [unknown]>();
  const record = jest.fn<Promise<void>, [unknown, unknown]>();

  let processor: RiskReviewProcessor;

  beforeEach(async () => {
    jest.resetAllMocks();

    const repository = { findOne, save };
    const manager = { getRepository: () => repository };
    const dataSource = {
      transaction: (runner: (m: typeof manager) => Promise<unknown>) => runner(manager),
    };

    // Mocks are supplied through Nest DI by token, so nothing has to be cast
    // into the full TypeORM repository or service classes.
    const moduleRef = await Test.createTestingModule({
      providers: [
        RiskReviewProcessor,
        { provide: getRepositoryToken(MerchantApplication), useValue: repository },
        { provide: RiskProviderService, useValue: { evaluate } },
        { provide: AuditService, useValue: { record } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    processor = moduleRef.get(RiskReviewProcessor);
  });

  it('persists the assessment and moves the application to review', async () => {
    const application = buildApplication();
    findOne.mockResolvedValue(application);
    evaluate.mockResolvedValue({
      reference: 'kyb_1',
      score: 82,
      status: RiskStatus.PASSED,
      reason: 'matched',
    });

    const result = await processor.review('app-1', 'job-1', 1);

    expect(result).toEqual({ status: RiskStatus.PASSED });
    expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(application.riskStatus).toBe(RiskStatus.PASSED);
    expect(application.riskScore).toBe(82);
    expect(application.riskReference).toBe('kyb_1');
    expect(application.riskCheckedAt).toBeInstanceOf(Date);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.RISK_REVIEW_COMPLETED }),
      expect.anything(),
    );
  });

  it('skips an application that is no longer SUBMITTED', async () => {
    findOne.mockResolvedValue(
      buildApplication({ status: ApplicationStatus.UNDER_REVIEW, riskStatus: RiskStatus.PASSED }),
    );

    const result = await processor.review('app-1', 'job-1', 2);

    expect(result).toEqual({ skipped: true });
    expect(evaluate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('skips when another worker reviewed the application first', async () => {
    // Passes the pre-check, then the locked read sees the committed change.
    findOne
      .mockResolvedValueOnce(buildApplication())
      .mockResolvedValueOnce(buildApplication({ status: ApplicationStatus.UNDER_REVIEW }));
    evaluate.mockResolvedValue({
      reference: 'kyb_2',
      score: 70,
      status: RiskStatus.PASSED,
      reason: 'matched',
    });

    const result = await processor.review('app-1', 'job-2', 1);

    expect(result).toEqual({ skipped: true });
    expect(save).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('skips a deleted application instead of retrying forever', async () => {
    findOne.mockResolvedValue(null);

    await expect(processor.review('app-1', 'job-1', 1)).resolves.toEqual({ skipped: true });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('treats only the last attempt as final', () => {
    expect(isFinalAttempt(1, 3)).toBe(false);
    expect(isFinalAttempt(2, 3)).toBe(false);
    expect(isFinalAttempt(3, 3)).toBe(true);
  });

  it('parks the application for manual review when the provider gives up', async () => {
    const application = buildApplication();
    findOne.mockResolvedValue(application);

    await processor.parkForManualReview('app-1', 'job-1', 3);

    expect(application.riskStatus).toBe(RiskStatus.MANUAL_REVIEW);
    expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(record).toHaveBeenCalled();
  });

  it('leaves an application alone if it already moved on', async () => {
    findOne.mockResolvedValue(buildApplication({ status: ApplicationStatus.APPROVED }));

    await processor.parkForManualReview('app-1', 'job-1', 3);

    expect(save).not.toHaveBeenCalled();
  });
});
