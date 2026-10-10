import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AccessTokenPayload, RefreshTokenPayload } from './authenticated-user';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { RefreshTokenStore } from './refresh-token.store';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Keeps login timing flat when the email is unknown.
  private readonly dummyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), 10);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: RefreshTokenStore,
  ) {}

  async login(dto: LoginDto): Promise<TokenPairDto> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const passwordMatches = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);

    // Same error every time, so users cannot be enumerated.
    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  // Single-use. A replay means it leaked, so drop every session.
  async refresh(dto: RefreshTokenDto): Promise<TokenPairDto> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (!(await this.sessions.isActive(payload.sub, payload.jti))) {
      await this.sessions.revokeAll(payload.sub);
      this.logger.warn(`Refresh token replay detected for user ${payload.sub}; sessions revoked`);
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      await this.sessions.revokeAll(payload.sub);
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.sessions.revoke(payload.sub, payload.jti);
    return this.issueTokens(user);
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    await this.sessions.revoke(payload.sub, payload.jti);
  }

  private async issueTokens(user: User): Promise<TokenPairDto> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      type: 'refresh',
      jti: randomUUID(),
    };

    const accessExpiresIn = this.config.getOrThrow<string>('jwt.accessExpiresIn');
    const refreshExpiresIn = this.config.getOrThrow<string>('jwt.refreshExpiresIn');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      } as never),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      } as never),
    ]);

    await this.sessions.save(user.id, refreshPayload.jti, durationToSeconds(refreshExpiresIn));

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: durationToSeconds(accessExpiresIn),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
      if (payload.type !== 'refresh' || !payload.jti) {
        throw new Error('wrong token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }
}

export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    return Number(duration) || 900;
  }
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * multipliers[match[2]];
}
