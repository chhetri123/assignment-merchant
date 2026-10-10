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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && Object.values<string>(UserRole).includes(value);

// Decoded JWT payloads arrive untyped, so narrow them before use.
export function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  return (
    isRecord(payload) &&
    payload.type === 'access' &&
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    isUserRole(payload.role)
  );
}

export function isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
  return (
    isRecord(payload) &&
    payload.type === 'refresh' &&
    typeof payload.sub === 'string' &&
    typeof payload.jti === 'string'
  );
}
