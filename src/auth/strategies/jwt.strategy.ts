import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { type AuthenticatedUser, isAccessTokenPayload } from '../authenticated-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  // Re-reads the user so deactivation applies before the token expires.
  async validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isAccessTokenPayload(payload)) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive || user.role !== payload.role) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
