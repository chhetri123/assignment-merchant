import {
  AbilityBuilder,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
  createMongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { UserRole } from '../users/user.entity';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Submit = 'submit',
  Assign = 'assign',
  Decide = 'decide',
}

export type Subjects = InferSubjects<typeof MerchantApplication | typeof AuditLog> | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

// Explicit instead of reading subject.constructor, so an unexpected subject
// raises instead of silently matching no rule.
function detectSubjectType(subject: object): ExtractSubjectType<Subjects> {
  if (subject instanceof MerchantApplication) {
    return MerchantApplication;
  }
  if (subject instanceof AuditLog) {
    return AuditLog;
  }
  throw new Error(`Unknown authorization subject: ${subject.constructor.name}`);
}

// All authorization rules. Conditions are matched against the loaded record.
@Injectable()
export class AbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.role) {
      case UserRole.ADMIN:
        can(Action.Manage, 'all');
        // A decision must belong to the assigned reviewer.
        cannot(Action.Decide, MerchantApplication);
        break;

      case UserRole.REVIEWER:
        can(Action.Read, MerchantApplication);
        can(Action.Decide, MerchantApplication, { assignedReviewerId: user.id });
        can(Action.Read, AuditLog);
        break;

      case UserRole.SALES:
        can(Action.Create, MerchantApplication);
        can([Action.Read, Action.Update, Action.Submit], MerchantApplication, {
          createdById: user.id,
        });
        break;
    }

    return build({ detectSubjectType });
  }
}
