import {
  type TestContext,
  USERS,
  applicationPayload,
  bearer,
  createTestApp,
  login,
  resetDatabase,
  waitForRiskReview,
  jsonBody,
} from './utils/test-app';

interface AuditEntry {
  action: string;
  actorRole: string;
  metadata: { riskReference?: string };
}

describe('Application lifecycle (e2e)', () => {
  let ctx: TestContext;
  let salesToken: string;
  let adminToken: string;
  let reviewerToken: string;
  let reviewerId: string;

  const create = (payload = applicationPayload()) =>
    ctx
      .http()
      .post('/api/v1/applications')
      .set('Authorization', bearer(salesToken))
      .send(payload)
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
    salesToken = (await login(ctx, USERS.sales)).accessToken;
    adminToken = (await login(ctx, USERS.admin)).accessToken;

    const reviewer = await login(ctx, USERS.reviewer);
    reviewerToken = reviewer.accessToken;
    reviewerId = reviewer.user.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('runs create → submit → risk review → assign → decision', async () => {
    const created = await create();
    expect(created.body).toMatchObject({ status: 'DRAFT', riskStatus: 'NOT_STARTED' });

    const submitted = await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);
    expect(submitted.body).toMatchObject({ status: 'SUBMITTED', riskStatus: 'PENDING' });

    const reviewed = await waitForRiskReview(ctx, created.body.id, salesToken);
    expect(reviewed.status).toBe('UNDER_REVIEW');
    expect(['PASSED', 'FAILED', 'MANUAL_REVIEW']).toContain(reviewed.riskStatus);
    expect(reviewed.riskScore).not.toBeNull();
    expect(reviewed.riskCheckedAt).not.toBeNull();

    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ reviewerId })
      .expect(200);

    const decided = await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/decision`)
      .set('Authorization', bearer(reviewerToken))
      .send({ decision: 'REJECT', reason: 'Volume inconsistent with statements' })
      .expect(200);

    expect(decided.body).toMatchObject({
      status: 'REJECTED',
      decisionReason: 'Volume inconsistent with statements',
    });
    expect(decided.body.decidedAt).not.toBeNull();
  });

  it('records the full audit trail of an application', async () => {
    const created = await create();
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);
    await waitForRiskReview(ctx, created.body.id, salesToken);

    const trail = await ctx
      .http()
      .get(`/api/v1/applications/${created.body.id}/audit`)
      .set('Authorization', bearer(adminToken))
      .expect(200);

    const entries = jsonBody<AuditEntry[]>(trail);
    const actions = entries.map((entry) => entry.action);
    expect(actions).toEqual([
      'APPLICATION_CREATED',
      'APPLICATION_SUBMITTED',
      'RISK_REVIEW_COMPLETED',
    ]);

    const riskEntry = entries[2];
    expect(riskEntry.actorRole).toBe('SYSTEM');
    expect(riskEntry.metadata.riskReference).toMatch(/^kyb_/);
  });

  it('does not run the risk review twice for one submission', async () => {
    const created = await create();
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);
    await waitForRiskReview(ctx, created.body.id, salesToken);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int FROM audit_logs WHERE "entityId" = $1 AND action = 'RISK_REVIEW_COMPLETED'`,
      [created.body.id],
    );
    expect(count).toBe(1);
  });

  it('allows editing in DRAFT and INFO_REQUESTED only', async () => {
    const created = await create();

    await ctx
      .http()
      .patch(`/api/v1/applications/${created.body.id}`)
      .set('Authorization', bearer(salesToken))
      .send({ city: 'Pokhara' })
      .expect(200);

    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);

    await ctx
      .http()
      .patch(`/api/v1/applications/${created.body.id}`)
      .set('Authorization', bearer(salesToken))
      .send({ city: 'Lalitpur' })
      .expect(409);
  });

  it('rejects invalid transitions', async () => {
    const created = await create();

    // Decision before the application has been reviewed.
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);

    // Submitting twice.
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(409);

    // Assigning a user who is not a reviewer.
    const sales = await login(ctx, USERS.sales);
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ reviewerId: sales.user.id })
      .expect(400);

    // Rejecting without a reason.
    await waitForRiskReview(ctx, created.body.id, salesToken);
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ reviewerId })
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/decision`)
      .set('Authorization', bearer(reviewerToken))
      .send({ decision: 'REJECT' })
      .expect(400);
  });

  it('serialises concurrent submits of the same application', async () => {
    const created = await create();
    const submit = () =>
      ctx
        .http()
        .post(`/api/v1/applications/${created.body.id}/submit`)
        .set('Authorization', bearer(salesToken));

    const [first, second] = await Promise.all([submit(), submit()]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int FROM audit_logs WHERE "entityId" = $1 AND action = 'APPLICATION_SUBMITTED'`,
      [created.body.id],
    );
    expect(count).toBe(1);
  });

  it('serialises concurrent decisions on the same application', async () => {
    const created = await create();
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);
    await waitForRiskReview(ctx, created.body.id, salesToken);
    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ reviewerId })
      .expect(200);

    const decide = (decision: string, reason: string) =>
      ctx
        .http()
        .post(`/api/v1/applications/${created.body.id}/decision`)
        .set('Authorization', bearer(reviewerToken))
        .send({ decision, reason });

    const [first, second] = await Promise.all([
      decide('APPROVE', 'looks good'),
      decide('REJECT', 'concurrent'),
    ]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int FROM audit_logs WHERE "entityId" = $1 AND action = 'REVIEW_DECISION_RECORDED'`,
      [created.body.id],
    );
    expect(count).toBe(1);
  });

  it('cannot be assigned before submission', async () => {
    const created = await create();

    await ctx
      .http()
      .post(`/api/v1/applications/${created.body.id}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ reviewerId })
      .expect(400);
  });

  it('filters and paginates the list', async () => {
    const first = await create();
    await create(applicationPayload({ businessName: 'Everest Gear' }));
    await ctx
      .http()
      .post(`/api/v1/applications/${first.body.id}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);

    const drafts = await ctx
      .http()
      .get('/api/v1/applications?status=DRAFT')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    expect(drafts.body.meta.total).toBe(1);
    expect(drafts.body.data[0].status).toBe('DRAFT');

    const paged = await ctx
      .http()
      .get('/api/v1/applications?page=2&limit=1')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    expect(paged.body.meta).toMatchObject({ total: 2, page: 2, limit: 1, totalPages: 2 });
    expect(paged.body.data).toHaveLength(1);
  });

  it('keeps money as an exact decimal string', async () => {
    const created = await create(
      applicationPayload({ requestedMonthlyVolume: '999999999999.99', averageTicketSize: '0.07' }),
    );

    expect(created.body.requestedMonthlyVolume).toBe('999999999999.99');
    expect(created.body.averageTicketSize).toBe('0.07');

    const [row] = await ctx.dataSource.query(
      `SELECT "requestedMonthlyVolume", "averageTicketSize" FROM merchant_applications WHERE id = $1`,
      [created.body.id],
    );
    expect(row.requestedMonthlyVolume).toBe('999999999999.99');
    expect(row.averageTicketSize).toBe('0.07');
  });

  it('rejects amounts that are not positive two-place decimals', async () => {
    for (const amount of ['1.234', '-5.00', '0.00', 'abc', '1e5']) {
      await ctx
        .http()
        .post('/api/v1/applications')
        .set('Authorization', bearer(salesToken))
        .send(applicationPayload({ requestedMonthlyVolume: amount }))
        .expect(400);
    }
  });

  it('validates the payload and rejects unknown fields', async () => {
    const response = await ctx
      .http()
      .post('/api/v1/applications')
      .set('Authorization', bearer(salesToken))
      .send(applicationPayload({ mcc: '12', currency: 'usd', unexpected: true }))
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property unexpected should not exist',
        'mcc must be 4 digits',
        'currency must be an ISO 4217 code',
      ]),
    );
  });
});
