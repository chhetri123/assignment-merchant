import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
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

// Mirrors the global pipes and filters from main.ts so responses match production.
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
}

export async function login(ctx: TestContext, email: string) {
  const response = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return response.body as { accessToken: string; refreshToken: string; user: { id: string } };
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
  requestedMonthlyVolume: 25000.5,
  averageTicketSize: 45.75,
  currency: 'USD',
  mcc: '5812',
  ...overrides,
});

// Polls until the worker has moved the application off PENDING.
export async function waitForRiskReview(
  ctx: TestContext,
  id: string,
  token: string,
  timeoutMs = 15000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await ctx.http().get(`/api/v1/applications/${id}`).set('Authorization', bearer(token));
    if (response.body.riskStatus !== 'PENDING') {
      return response.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Risk review for ${id} did not complete within ${timeoutMs}ms`);
}
