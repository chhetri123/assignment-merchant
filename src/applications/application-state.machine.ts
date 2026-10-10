import { ConflictException } from '@nestjs/common';
import { ApplicationStatus } from './entities/merchant-application.entity';

// SUBMITTED -> UNDER_REVIEW is done by the risk worker, the rest by the API.
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.UNDER_REVIEW],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.INFO_REQUESTED,
  ],
  [ApplicationStatus.INFO_REQUESTED]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.APPROVED]: [],
  [ApplicationStatus.REJECTED]: [],
};

const EDITABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.INFO_REQUESTED,
];

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Cannot move application from ${from} to ${to}`);
  }
}

export function isEditable(status: ApplicationStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function assertEditable(status: ApplicationStatus): void {
  if (!isEditable(status)) {
    throw new ConflictException(`Application in status ${status} can no longer be edited`);
  }
}
