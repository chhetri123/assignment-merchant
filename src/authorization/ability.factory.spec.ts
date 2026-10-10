import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  assertCanDecide,
  assertCanRead,
  assertCanUpdate,
} from '../applications/application-access';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { UserRole } from '../users/user.entity';
import { readScope } from './ability-scope';
import { AbilityFactory, Action } from './ability.factory';

const SALES: AuthenticatedUser = { id: 'sales-1', email: 's1@test', role: UserRole.SALES };
const OTHER_SALES: AuthenticatedUser = { id: 'sales-2', email: 's2@test', role: UserRole.SALES };
const REVIEWER: AuthenticatedUser = { id: 'rev-1', email: 'r1@test', role: UserRole.REVIEWER };
const OTHER_REVIEWER: AuthenticatedUser = { id: 'rev-2', email: 'r2@test', role: UserRole.REVIEWER };
const ADMIN: AuthenticatedUser = { id: 'admin-1', email: 'a@test', role: UserRole.ADMIN };

function application(createdById: string, assignedReviewerId: string | null = null) {
  return Object.assign(new MerchantApplication(), { id: 'app-1', createdById, assignedReviewerId });
}

describe('AbilityFactory', () => {
  const factory = new AbilityFactory();
  const ownedBySales = application(SALES.id);

  describe('SALES', () => {
    const ability = factory.createForUser(SALES);

    it('can read and update its own application', () => {
      expect(ability.can(Action.Read, ownedBySales)).toBe(true);
      expect(ability.can(Action.Update, ownedBySales)).toBe(true);
      expect(ability.can(Action.Submit, ownedBySales)).toBe(true);
    });

    it('cannot touch an application created by someone else', () => {
      const foreign = application(OTHER_SALES.id);
      expect(ability.can(Action.Read, foreign)).toBe(false);
      expect(ability.can(Action.Update, foreign)).toBe(false);
      expect(() => { assertCanRead(ability, foreign); }).toThrow(NotFoundException);
      expect(() => { assertCanUpdate(ability, foreign); }).toThrow(NotFoundException);
    });

    it('cannot assign or decide', () => {
      expect(ability.can(Action.Assign, ownedBySales)).toBe(false);
      expect(ability.can(Action.Decide, ownedBySales)).toBe(false);
    });

    it('scopes list queries to its own records', () => {
      expect(readScope(ability, MerchantApplication)).toEqual({ createdById: SALES.id });
    });
  });

  describe('REVIEWER', () => {
    const ability = factory.createForUser(REVIEWER);

    it('can decide only when assigned to the application', () => {
      const assigned = application(SALES.id, REVIEWER.id);
      const assignedToOther = application(SALES.id, OTHER_REVIEWER.id);
      const unassigned = application(SALES.id, null);

      expect(ability.can(Action.Decide, assigned)).toBe(true);
      expect(ability.can(Action.Decide, assignedToOther)).toBe(false);
      expect(ability.can(Action.Decide, unassigned)).toBe(false);
      expect(() => { assertCanDecide(ability, assignedToOther); }).toThrow(ForbiddenException);
    });

    it('can read every application but not edit them', () => {
      expect(ability.can(Action.Read, ownedBySales)).toBe(true);
      expect(ability.can(Action.Update, ownedBySales)).toBe(false);
      expect(readScope(ability, MerchantApplication)).toEqual({});
    });
  });

  describe('subject detection', () => {
    const ability = factory.createForUser(ADMIN);

    it('raises on a subject it does not know', () => {
      expect(() => ability.can(Action.Read, { createdById: SALES.id })).toThrow(
        /Unknown authorization subject/,
      );
    });
  });

  describe('ADMIN', () => {
    const ability = factory.createForUser(ADMIN);

    it('can manage applications but never record a decision', () => {
      expect(ability.can(Action.Read, ownedBySales)).toBe(true);
      expect(ability.can(Action.Update, ownedBySales)).toBe(true);
      expect(ability.can(Action.Assign, ownedBySales)).toBe(true);
      expect(ability.can(Action.Decide, application(SALES.id, ADMIN.id))).toBe(false);
    });
  });
});
