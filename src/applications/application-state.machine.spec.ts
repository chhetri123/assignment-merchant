import { ConflictException } from '@nestjs/common';
import {
  assertEditable,
  assertTransition,
  canTransition,
  isEditable,
} from './application-state.machine';
import { ApplicationStatus } from './entities/merchant-application.entity';

describe('application state machine', () => {
  it('allows the submit, review and decision path', () => {
    expect(canTransition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED)).toBe(true);
    expect(canTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW)).toBe(true);
    expect(canTransition(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.APPROVED)).toBe(true);
    expect(canTransition(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED)).toBe(true);
    expect(canTransition(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.INFO_REQUESTED)).toBe(
      true,
    );
    expect(canTransition(ApplicationStatus.INFO_REQUESTED, ApplicationStatus.SUBMITTED)).toBe(true);
  });

  it('rejects skipping review', () => {
    expect(canTransition(ApplicationStatus.DRAFT, ApplicationStatus.APPROVED)).toBe(false);
    expect(canTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED)).toBe(false);
  });

  it('rejects re-submitting and re-deciding', () => {
    expect(canTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.SUBMITTED)).toBe(false);
    expect(canTransition(ApplicationStatus.APPROVED, ApplicationStatus.REJECTED)).toBe(false);
    expect(canTransition(ApplicationStatus.REJECTED, ApplicationStatus.UNDER_REVIEW)).toBe(false);
  });

  it('throws a conflict on an invalid transition', () => {
    expect(() => assertTransition(ApplicationStatus.APPROVED, ApplicationStatus.REJECTED)).toThrow(
      ConflictException,
    );
    expect(() =>
      assertTransition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED),
    ).not.toThrow();
  });

  it('is editable only in DRAFT and INFO_REQUESTED', () => {
    expect(isEditable(ApplicationStatus.DRAFT)).toBe(true);
    expect(isEditable(ApplicationStatus.INFO_REQUESTED)).toBe(true);
    expect(isEditable(ApplicationStatus.SUBMITTED)).toBe(false);
    expect(isEditable(ApplicationStatus.UNDER_REVIEW)).toBe(false);
    expect(isEditable(ApplicationStatus.APPROVED)).toBe(false);
    expect(() => assertEditable(ApplicationStatus.SUBMITTED)).toThrow(ConflictException);
  });
});
