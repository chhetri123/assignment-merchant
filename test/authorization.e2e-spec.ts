import {
  type TestContext,
  USERS,
  applicationPayload,
  bearer,
  createTestApp,
  login,
  resetDatabase,
} from './utils/test-app';

describe('Object-level authorization (e2e)', () => {
  let ctx: TestContext;
  let salesToken: string;
  let otherSalesToken: string;
  let reviewerToken: string;
  let otherReviewerToken: string;
  let adminToken: string;
  let reviewerId: string;
  let applicationId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx);

    salesToken = (await login(ctx, USERS.sales)).accessToken;
    otherSalesToken = (await login(ctx, USERS.sales2)).accessToken;
    adminToken = (await login(ctx, USERS.admin)).accessToken;

    const reviewer = await login(ctx, USERS.reviewer);
    reviewerToken = reviewer.accessToken;
    reviewerId = reviewer.user.id;
    otherReviewerToken = (await login(ctx, USERS.reviewer2)).accessToken;

    const created = await ctx
      .http()
      .post('/api/v1/applications')
      .set('Authorization', bearer(salesToken))
      .send(applicationPayload())
      .expect(201);

    applicationId = created.body.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('a SALES user and another SALES user’s application', () => {
    it('cannot read it by id', async () => {
      await ctx
        .http()
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', bearer(otherSalesToken))
        .expect(404);
    });

    it('cannot change it by id', async () => {
      await ctx
        .http()
        .patch(`/api/v1/applications/${applicationId}`)
        .set('Authorization', bearer(otherSalesToken))
        .send({ businessName: 'Hijacked' })
        .expect(404);

      const unchanged = await ctx
        .http()
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', bearer(salesToken))
        .expect(200);

      expect(unchanged.body.businessName).toBe('Himalaya Coffee');
    });

    it('cannot submit it by id', async () => {
      await ctx
        .http()
        .post(`/api/v1/applications/${applicationId}/submit`)
        .set('Authorization', bearer(otherSalesToken))
        .expect(404);
    });

    it('cannot see it in a list or page to it', async () => {
      const own = await ctx
        .http()
        .get('/api/v1/applications?limit=100')
        .set('Authorization', bearer(otherSalesToken))
        .expect(200);

      expect(own.body.meta.total).toBe(0);
      expect(own.body.data).toEqual([]);
    });

    it('cannot read its audit trail', async () => {
      await ctx
        .http()
        .get(`/api/v1/applications/${applicationId}/audit`)
        .set('Authorization', bearer(otherSalesToken))
        .expect(403);
    });
  });

  it('only the assigned reviewer can record a decision', async () => {
    await ctx
      .http()
      .post(`/api/v1/applications/${applicationId}/submit`)
      .set('Authorization', bearer(salesToken))
      .expect(200);

    await ctx
      .http()
      .post(`/api/v1/applications/${applicationId}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ reviewerId })
      .expect(200);

    await ctx.dataSource.query('UPDATE merchant_applications SET status = $1 WHERE id = $2', [
      'UNDER_REVIEW',
      applicationId,
    ]);

    await ctx
      .http()
      .post(`/api/v1/applications/${applicationId}/decision`)
      .set('Authorization', bearer(otherReviewerToken))
      .send({ decision: 'APPROVE' })
      .expect(403);

    // An ADMIN has full operational access but cannot stand in for the reviewer.
    await ctx
      .http()
      .post(`/api/v1/applications/${applicationId}/decision`)
      .set('Authorization', bearer(adminToken))
      .send({ decision: 'APPROVE' })
      .expect(403);

    await ctx
      .http()
      .post(`/api/v1/applications/${applicationId}/decision`)
      .set('Authorization', bearer(reviewerToken))
      .send({ decision: 'APPROVE' })
      .expect(200);
  });

  it('blocks role-level actions that are not the caller’s', async () => {
    // SALES cannot assign reviewers.
    await ctx
      .http()
      .post(`/api/v1/applications/${applicationId}/assign`)
      .set('Authorization', bearer(salesToken))
      .send({ reviewerId })
      .expect(403);

    // REVIEWER cannot create or edit applications.
    await ctx
      .http()
      .post('/api/v1/applications')
      .set('Authorization', bearer(reviewerToken))
      .send(applicationPayload())
      .expect(403);

    await ctx
      .http()
      .patch(`/api/v1/applications/${applicationId}`)
      .set('Authorization', bearer(reviewerToken))
      .send({ city: 'Pokhara' })
      .expect(403);
  });

  it('never returns the tax id, only a masked form', async () => {
    const response = await ctx
      .http()
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', bearer(salesToken))
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain('123456789');
    expect(response.body.ownerTaxIdMasked).toBe('*****6789');
    expect(response.body.ownerTaxId).toBeUndefined();
  });
});
