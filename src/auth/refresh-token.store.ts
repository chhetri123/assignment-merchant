import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

// One key per session, holding the token id only. TTL = token lifetime.
@Injectable()
export class RefreshTokenStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(userId: string, tokenId: string): string {
    return `refresh:${userId}:${tokenId}`;
  }

  async save(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(userId, tokenId), '1', 'EX', ttlSeconds);
  }

  async isActive(userId: string, tokenId: string): Promise<boolean> {
    return (await this.redis.exists(this.key(userId, tokenId))) === 1;
  }

  async revoke(userId: string, tokenId: string): Promise<void> {
    await this.redis.del(this.key(userId, tokenId));
  }

  // Called when a rotated token is replayed.
  async revokeAll(userId: string): Promise<number> {
    let cursor = '0';
    let removed = 0;

    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        this.key(userId, '*'),
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length > 0) {
        removed += await this.redis.del(...keys);
      }
    } while (cursor !== '0');

    return removed;
  }
}
