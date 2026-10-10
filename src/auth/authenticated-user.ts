import { UserRole } from '../users/user.entity';

// Shape attached to `request.user` after access-token validation.
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
  // Session id; the matching Redis key must exist for the token to be usable.
  jti: string;
}
