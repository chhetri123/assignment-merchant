import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { AccessTokenPayload, AuthenticatedUser } from '../authenticated-user';

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
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (payload.type !== 'access' || !user || !user.isActive || user.role !== payload.role) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
