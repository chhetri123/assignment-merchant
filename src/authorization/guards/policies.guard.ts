import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { AbilityFactory } from '../ability.factory';
import { ABILITY_RULES_KEY, RequiredRule } from '../decorators/check-ability.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rules = this.reflector.getAllAndOverride<RequiredRule[]>(ABILITY_RULES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rules || rules.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const ability = this.abilityFactory.createForUser(user);
    const denied = rules.find((rule) => !ability.can(rule.action, rule.subject));
    if (denied) {
      throw new ForbiddenException(`Not allowed to ${denied.action} this resource`);
    }

    return true;
  }
}
