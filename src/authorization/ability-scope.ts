import { type RuleOf } from '@casl/ability';
import { ForbiddenException } from '@nestjs/common';
import { type FindOptionsWhere, type ObjectLiteral } from 'typeorm';
import { Action, type AppAbility, type Subjects } from './ability.factory';

type ConditionValue = string | number | boolean | null;

const isConditionValue = (value: unknown): value is ConditionValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

// Builds the list query's where clause from the caller's own read rule, so the
// rule is not restated in the service. CASL conditions and TypeORM's where are
// unrelated types, so this is the single place they are bridged; only flat
// equality conditions are accepted and anything else fails closed.
export function readScope<T extends ObjectLiteral>(
  ability: AppAbility,
  subject: Extract<Subjects, new (...args: never[]) => unknown>,
): FindOptionsWhere<T> {
  const rules: RuleOf<AppAbility>[] = ability
    .rulesFor(Action.Read, subject)
    .filter((rule) => !rule.inverted);

  if (rules.length === 0) {
    throw new ForbiddenException('Not allowed to list this resource');
  }
  if (rules.length > 1) {
    throw new Error('Unsupported ability shape: more than one read rule');
  }

  const conditions = rules[0].conditions ?? {};
  const where: Record<string, ConditionValue> = {};

  for (const [field, value] of Object.entries(conditions)) {
    if (!isConditionValue(value)) {
      throw new Error(`Unsupported ability condition on "${field}"`);
    }
    where[field] = value;
  }

  return where as FindOptionsWhere<T>;
}
