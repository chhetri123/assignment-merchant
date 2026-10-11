import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const PING_TIMEOUT_MS = 2000;

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);

    try {
      // The client is configured with maxRetriesPerRequest: null for BullMQ,
      // so a command queues forever while Redis is down; the race is what
      // turns an unreachable Redis into a failed probe instead of a hang.
      await Promise.race([this.redis.ping(), rejectAfter(PING_TIMEOUT_MS)]);
      return check.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis unreachable';
      return check.down({ message });
    }
  }
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Redis did not answer within ${ms}ms`));
    }, ms);
    timer.unref();
  });
}
