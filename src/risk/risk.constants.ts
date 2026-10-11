export const RISK_QUEUE = 'risk-review';

export interface RiskReviewJobData {
  applicationId: string;
  // Submission timestamp, part of the job id so a resubmission gets a new job.
  submittedAt: string;
  // Id of the request that submitted the application, for tracing.
  requestId?: string;
}
