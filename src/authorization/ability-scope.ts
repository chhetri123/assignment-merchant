import { ForbiddenException } from '@nestjs/common';
import { FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { Action, AppAbility, Subjects } from './ability.factory';

// Builds the list query's where clause from the caller's own read rule.
// Only flat equality conditions are supported; anything else fails closed.
export function readScope<T extends ObjectLiteral>(
  ability: AppAbility,
  subject: Extract<Subjects, new (...args: never[]) => unknown>,
): FindOptionsWhere<T> {
  const rules = ability
    .rulesFor(Action.Read, subject)
    .filter((rule: { inverted: boolean }) => !rule.inverted);

  if (rules.length === 0) {
    throw new ForbiddenException('Not allowed to list this resource');
  }
  if (rules.length > 1) {
    throw new Error('Unsupported ability shape: more than one read rule');
  }

  return (rules[0].conditions ?? {}) as FindOptionsWhere<T>;
}
