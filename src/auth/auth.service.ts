import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import {
  type AccessTokenPayload,
  type RefreshTokenPayload,
  isRefreshTokenPayload,
} from './authenticated-user';
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
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );

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

    const accessTtl = this.config.getOrThrow<number>('jwt.accessTtlSeconds');
    const refreshTtl = this.config.getOrThrow<number>('jwt.refreshTtlSeconds');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshTtl,
      }),
    ]);

    await this.sessions.save(user.id, refreshPayload.jti, refreshTtl);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtl,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
      if (!isRefreshTokenPayload(payload)) {
        throw new Error('wrong token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }
}
