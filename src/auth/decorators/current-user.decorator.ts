import { type ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { type Request } from 'express';
import { type AuthenticatedUser } from '../authenticated-user';

// Only valid on guarded routes; a missing user means the guard did not run.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const { user } = ctx.switchToHttp().getRequest<Request>();
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  },
);
