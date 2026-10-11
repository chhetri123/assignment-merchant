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

  it('rate limits repeated login attempts from the same client', async () => {
    const attempt = () =>
      ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: USERS.sales, password: 'WrongPassw0rd!' });

    const limit = Number(process.env.THROTTLE_AUTH_LIMIT);
    const statuses: number[] = [];
    for (let i = 0; i < limit + 2; i += 1) {
      const response = await attempt();
      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 401)).toHaveLength(limit);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);

    // A valid credential is refused too, so the limit cannot be walked past.
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: USERS.sales, password: TEST_PASSWORD })
      .expect(429);
  });

  it('returns a request id and echoes an inbound one', async () => {
    const generated = await ctx.http().get('/api/health').expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await ctx
      .http()
      .get('/api/health')
      .set('x-request-id', 'trace-abc-123')
      .expect(200);
    expect(echoed.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('includes the request id in an error response', async () => {
    const response = await ctx
      .http()
      .get('/api/v1/applications')
      .set('x-request-id', 'trace-error-1')
      .expect(401);

    expect(response.body.requestId).toBe('trace-error-1');
  });

  it('does not rate limit the health probe', async () => {
    for (let i = 0; i < 20; i += 1) {
      await ctx.http().get('/api/health').expect(200);
    }
  });

  it('revokes the session on logout', async () => {
    const { refreshToken } = await login(ctx, USERS.sales);

    await ctx.http().post('/api/v1/auth/logout').send({ refreshToken }).expect(204);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });
});
