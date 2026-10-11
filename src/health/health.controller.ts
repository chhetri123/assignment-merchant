import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@SkipThrottle()
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  // Liveness: the process is up. Used to decide whether to restart it.
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ description: 'Process is running' })
  live(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Readiness: dependencies answer. Used to decide whether to send traffic.
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe: Postgres and Redis' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  ready() {
    return this.health.check([
      () => this.database.pingCheck('postgres', { timeout: 2000 }),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
