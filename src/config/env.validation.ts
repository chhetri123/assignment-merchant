import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, validateSync } from 'class-validator';
import { Type } from 'class-transformer';
import { DURATION_PATTERN } from '../common/duration';

// Fails the boot instead of a request later.
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @Type(() => Number)
  @IsInt()
  REDIS_PORT: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  REDIS_DB?: number;

  @IsString()
  @Matches(/^.{32,}$/, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @Matches(/^.{32,}$/, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @Matches(DURATION_PATTERN, { message: 'JWT_ACCESS_EXPIRES_IN must look like 15m, 2h or 7d' })
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @Matches(DURATION_PATTERN, { message: 'JWT_REFRESH_EXPIRES_IN must look like 15m, 2h or 7d' })
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)' })
  ENCRYPTION_KEY: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  return config;
}
