import { type AuthenticatedUser } from '../auth/authenticated-user';

// Passport declares `Request.user` as `Express.User`. Merging our shape into it
// types `request.user` everywhere without a custom Request interface.
declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};
