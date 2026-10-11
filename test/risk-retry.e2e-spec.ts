import { RiskStatus } from '../src/applications/entities/merchant-application.entity';
import { RiskProviderService } from '../src/risk/risk-provider.service';
import { RiskReviewQueue } from '../src/risk/risk-review.queue';
import {
  type TestContext,
  USERS,
  applicationPayload,
  bearer,
  createTestApp,
  jsonBody,
  login,
  resetDatabase,
  waitForRiskReview,
} from './utils/test-app';

// Drives the real BullMQ worker rather than a hand-built Job, so the retry and
// backoff behaviour being asserted is the library's, not an assumption.
describe('Risk review retries (e2e)', () => {
  let ctx: TestContext;
  let salesToken: string;
  let calls = 0;
  let failuresBeforeSuccess = 0;

  const flakyProvider = {
    evaluate: () => {
      calls += 1;
      if (calls <= failuresBeforeSuccess) {
        return Promise.reject(new Error('risk provider timeout'));
      }
      return Promise.resolve({
        reference: 'kyb_retry',
        score: 90,
        status: RiskStatus.PASSED,
        reason: 'matched after retry',
      });
    },
  };

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideProvider(RiskProviderService).useValue(flakyProvider),
    );
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
    calls = 0;
    salesToken = (await login(ctx, USERS.sales)).accessToken;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function submitApplication(): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/applications')
      .set('Authorization', bearer(salesToken))
      .send(applicationPayload())
      .expect(201);

    const { id } = jsonBody<{ id: string }>(created);
    await ctx
      .http()
      .post(`/api/v1/applications/${id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);

    return id;
  }

  it('retries a failing provider and succeeds on a later attempt', async () => {
    failuresBeforeSuccess = 2;
    const id = await submitApplication();

    const reviewed = await waitForRiskReview(ctx, id, salesToken);

    expect(reviewed.riskStatus).toBe('PASSED');
    expect(calls).toBe(3);

    const [entry] = await ctx.dataSource.query(
      `SELECT metadata FROM audit_logs WHERE "entityId" = $1 AND action = 'RISK_REVIEW_COMPLETED'`,
      [id],
    );
    // BullMQ counts the attempt, so the third call is attempt 3.
    expect(entry.metadata.attempt).toBe(3);
  });

  it('parks the application for manual review once the attempts are exhausted', async () => {
    failuresBeforeSuccess = Number.MAX_SAFE_INTEGER;
    const id = await submitApplication();

    const reviewed = await waitForRiskReview(ctx, id, salesToken);

    expect(reviewed.riskStatus).toBe('MANUAL_REVIEW');
    expect(reviewed.status).toBe('UNDER_REVIEW');
    expect(calls).toBe(3);

    const [entry] = await ctx.dataSource.query(
      `SELECT metadata FROM audit_logs WHERE "entityId" = $1 AND action = 'RISK_REVIEW_COMPLETED'`,
      [id],
    );
    expect(entry.metadata.riskStatus).toBe('MANUAL_REVIEW');
  });

  it('drops a duplicate job for the same submission', async () => {
    failuresBeforeSuccess = 0;
    const id = await submitApplication();
    await waitForRiskReview(ctx, id, salesToken);

    const [application] = await ctx.dataSource.query(
      `SELECT * FROM merchant_applications WHERE id = $1`,
      [id],
    );

    // Same submittedAt means the same job id, so BullMQ keeps the first job.
    await ctx.app.get(RiskReviewQueue).enqueue(application);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int FROM audit_logs WHERE "entityId" = $1 AND action = 'RISK_REVIEW_COMPLETED'`,
      [id],
    );
    expect(count).toBe(1);
  });
});
