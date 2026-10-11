import { durationToSeconds } from '../common/duration';
import { AUTH_RATE_LIMIT, DEFAULT_RATE_LIMIT, RATE_TTL_SECONDS } from './throttle';

export interface AppConfig {
  env: string;
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    db: number;
  };
  jwt: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshSecret: string;
    refreshTtlSeconds: number;
  };
  encryptionKey: string;
  risk: {
    attempts: number;
    backoffMs: number;
  };
  throttle: {
    defaultLimit: number;
    authLimit: number;
    ttlSeconds: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtlSeconds: durationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN ?? '15m'),
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtlSeconds: durationToSeconds(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'),
  },
  encryptionKey: process.env.ENCRYPTION_KEY as string,
  risk: {
    attempts: parseInt(process.env.RISK_JOB_ATTEMPTS ?? '3', 10),
    backoffMs: parseInt(process.env.RISK_JOB_BACKOFF_MS ?? '1000', 10),
  },
  throttle: {
    defaultLimit: DEFAULT_RATE_LIMIT,
    authLimit: AUTH_RATE_LIMIT,
    ttlSeconds: RATE_TTL_SECONDS,
  },
});
