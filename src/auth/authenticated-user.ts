import { UserRole } from '../users/user.entity';

// Attached to `request.user` after the token is validated.
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  // Session id; must still exist in Redis.
  jti: string;
}
