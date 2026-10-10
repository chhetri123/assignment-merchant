import { RiskReviewProcessor } from '../src/risk/risk-review.processor';
import {
  type TestContext,
  USERS,
  applicationPayload,
  bearer,
  createTestApp,
  login,
  resetDatabase,
} from './utils/test-app';

describe('Risk review worker (e2e)', () => {
  let ctx: TestContext;
  let processor: RiskReviewProcessor;
  let salesToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    processor = ctx.app.get(RiskReviewProcessor);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
    salesToken = (await login(ctx, USERS.sales)).accessToken;
  });

  afterAll(async () => {
    await ctx.close();
  });

  // Put a row straight into SUBMITTED so the queue is not involved and the two
  // calls below are the only things touching it.
  async function submittedApplication(): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/applications')
      .set('Authorization', bearer(salesToken))
      .send(applicationPayload())
      .expect(201);

    const id: string = created.body.id;
    await ctx.dataSource.query(
      `UPDATE merchant_applications SET status = 'SUBMITTED', "riskStatus" = 'PENDING',
       "submittedAt" = now() WHERE id = $1`,
      [id],
    );
    return id;
  }

  it('reviews an application exactly once when two workers race', async () => {
    const id = await submittedApplication();

    const outcomes = await Promise.all([
      processor.review(id, 'job-a', 1),
      processor.review(id, 'job-b', 1),
    ]);

    const skipped = outcomes.filter((outcome) => 'skipped' in outcome);
    const reviewed = outcomes.filter((outcome) => 'status' in outcome);
    expect(reviewed).toHaveLength(1);
    expect(skipped).toHaveLength(1);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int FROM audit_logs WHERE "entityId" = $1 AND action = 'RISK_REVIEW_COMPLETED'`,
      [id],
    );
    expect(count).toBe(1);
  });

  it('does not re-review after the application has moved on', async () => {
    const id = await submittedApplication();

    await processor.review(id, 'job-a', 1);
    const second = await processor.review(id, 'job-a-retry', 2);

    expect(second).toEqual({ skipped: true });
  });

  it('parks an application for manual review only while it is still SUBMITTED', async () => {
    const id = await submittedApplication();

    await processor.parkForManualReview(id, 'job-c', 3);
    const [parked] = await ctx.dataSource.query(
      `SELECT status, "riskStatus" FROM merchant_applications WHERE id = $1`,
      [id],
    );
    expect(parked).toMatchObject({ status: 'UNDER_REVIEW', riskStatus: 'MANUAL_REVIEW' });

    // A late failure event for an application that already moved on is a no-op.
    await processor.parkForManualReview(id, 'job-c-late', 3);
    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int FROM audit_logs WHERE "entityId" = $1 AND action = 'RISK_REVIEW_COMPLETED'`,
      [id],
    );
    expect(count).toBe(1);
  });
});
