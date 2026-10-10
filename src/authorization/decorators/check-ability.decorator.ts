import { SetMetadata } from '@nestjs/common';
import { type Action, type Subjects } from '../ability.factory';

export const ABILITY_RULES_KEY = 'ability_rules';

export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

// Route-level gate only; the record check happens in the service.
export const CheckAbility = (...rules: RequiredRule[]) => SetMetadata(ABILITY_RULES_KEY, rules);
