import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Action, AppAbility } from '../authorization/ability.factory';
import { MerchantApplication } from './entities/merchant-application.entity';

// 404 rather than 403, so ids are not disclosed.
export function assertCanRead(ability: AppAbility, application: MerchantApplication): void {
  if (!ability.can(Action.Read, application)) {
    throw new NotFoundException('Application not found');
  }
}

export function assertCanUpdate(ability: AppAbility, application: MerchantApplication): void {
  assertCanRead(ability, application);
  if (!ability.can(Action.Update, application)) {
    throw new ForbiddenException('You cannot modify this application');
  }
}

export function assertCanSubmit(ability: AppAbility, application: MerchantApplication): void {
  assertCanRead(ability, application);
  if (!ability.can(Action.Submit, application)) {
    throw new ForbiddenException('You cannot submit this application');
  }
}

export function assertCanDecide(ability: AppAbility, application: MerchantApplication): void {
  assertCanRead(ability, application);
  if (!ability.can(Action.Decide, application)) {
    throw new ForbiddenException('Only the assigned reviewer can record a decision');
  }
}
