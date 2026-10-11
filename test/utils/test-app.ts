import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { type Queue } from 'bullmq';
import * as bcrypt from 'bcryptjs';
import type Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { RISK_QUEUE } from '../../src/risk/risk.constants';
import { User, UserRole } from '../../src/users/user.entity';

export const TEST_PASSWORD = 'TestPassw0rd!';

export const USERS = {
  admin: 'admin@test.local',
  reviewer: 'reviewer@test.local',
  reviewer2: 'reviewer2@test.local',
  sales: 'sales@test.local',
  sales2: 'sales2@test.local',
};

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  redis: Redis;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

// Mirrors the global pipes and filters from main.ts so responses match
// production. `configure` lets a spec swap a provider, e.g. a failing risk
// provider, before the module is compiled.
export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestContext> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  const moduleRef = await (configure ? configure(builder) : builder).compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  const dataSource = app.get(DataSource);
  const redis = app.get<Redis>(REDIS_CLIENT);

  return {
    app,
    dataSource,
    redis,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
    },
  };
}

export async function resetDatabase(ctx: TestContext): Promise<void> {
  await ctx.dataSource.query(
    'TRUNCATE TABLE audit_logs, merchant_applications, users RESTART IDENTITY CASCADE',
  );

  const users = ctx.dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);

  await users.save([
    users.create({ email: USERS.admin, fullName: 'Admin', role: UserRole.ADMIN, passwordHash }),
    users.create({ email: USERS.reviewer, fullName: 'Reviewer One', role: UserRole.REVIEWER, passwordHash }),
    users.create({ email: USERS.reviewer2, fullName: 'Reviewer Two', role: UserRole.REVIEWER, passwordHash }),
    users.create({ email: USERS.sales, fullName: 'Sales One', role: UserRole.SALES, passwordHash }),
    users.create({ email: USERS.sales2, fullName: 'Sales Two', role: UserRole.SALES, passwordHash }),
  ]);

  const keys = await ctx.redis.keys('refresh:*');
  if (keys.length > 0) {
    await ctx.redis.del(...keys);
  }

  // ThrottlerStorageRedisService writes `{<hash>:<name>}:hits` / `:blocked`.
  const throttleKeys = await ctx.redis.keys('{*}:*');
  if (throttleKeys.length > 0) {
    await ctx.redis.del(...throttleKeys);
  }

  // Jobs left by a previous test would otherwise be retried against rows that
  // no longer exist and slow the next test down. Drained rather than
  // obliterated: deleting the queue from under a running worker makes it stall.
  const queue = ctx.app.get<Queue>(getQueueToken(RISK_QUEUE));
  await queue.drain(true);
  await queue.clean(0, 1000, 'completed');
  await queue.clean(0, 1000, 'failed');
}

export async function login(ctx: TestContext, email: string) {
  const response = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return response.body as { accessToken: string; refreshToken: string; user: { id: string } };
}

// supertest types the response body as `any`; this is the only place that
// boundary is narrowed, so specs stay type-safe.
export function jsonBody<T>(response: request.Response): T {
  return response.body as T;
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

export const applicationPayload = (overrides: Record<string, unknown> = {}) => ({
  businessName: 'Himalaya Coffee',
  legalBusinessName: 'Himalaya Coffee Pvt Ltd',
  businessType: 'LLC',
  ownerFullName: 'Pemba Sherpa',
  ownerEmail: 'owner@himalayacoffee.test',
  ownerPhone: '+9779800000000',
  ownerTaxId: '123456789',
  addressLine1: 'Thamel Marg 24',
  city: 'Kathmandu',
  state: 'Bagmati',
  postalCode: '44600',
  country: 'NP',
  requestedMonthlyVolume: '25000.50',
  averageTicketSize: '45.75',
  currency: 'USD',
  mcc: '5812',
  ...overrides,
});

export interface ApplicationResponse {
  id: string;
  status: string;
  riskStatus: string;
  riskScore: number | null;
  riskCheckedAt: string | null;
}

// Polls until the worker has moved the application off PENDING.
export async function waitForRiskReview(
  ctx: TestContext,
  id: string,
  token: string,
  timeoutMs = 15000,
): Promise<ApplicationResponse> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await ctx
      .http()
      .get(`/api/v1/applications/${id}`)
      .set('Authorization', bearer(token));
    const application = jsonBody<ApplicationResponse>(response);
    if (application.riskStatus !== 'PENDING') {
      return application;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Risk review for ${id} did not complete within ${timeoutMs}ms`);
}
