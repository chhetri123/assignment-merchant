import {
  TEST_PASSWORD,
  type TestContext,
  USERS,
  bearer,
  createTestApp,
  login,
  resetDatabase,
} from './utils/test-app';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('issues an access and refresh token pair', async () => {
    const response = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: USERS.sales, password: TEST_PASSWORD })
      .expect(200);

    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      user: { email: USERS.sales, role: 'SALES' },
    });
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });

  it('answers the same way for a wrong password and an unknown email', async () => {
    const wrongPassword = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: USERS.sales, password: 'WrongPassw0rd!' })
      .expect(401);

    const unknownEmail = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: TEST_PASSWORD })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    await ctx.http().get('/api/v1/applications').expect(401);
    await ctx.http().get('/api/v1/auth/me').expect(401);
  });

  it('rejects a refresh token used as an access token', async () => {
    const { refreshToken } = await login(ctx, USERS.sales);

    await ctx.http().get('/api/v1/auth/me').set('Authorization', bearer(refreshToken)).expect(401);
  });

  it('rotates the refresh token and revokes every session when one is replayed', async () => {
    const first = await login(ctx, USERS.sales);

    const rotated = await ctx
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    await ctx
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(rotated.body.accessToken))
      .expect(200);

    // Replaying the consumed token invalidates the rotated one as well.
    await ctx
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    await ctx
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('revokes the session on logout', async () => {
    const { refreshToken } = await login(ctx, USERS.sales);

    await ctx.http().post('/api/v1/auth/logout').send({ refreshToken }).expect(204);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });
});
