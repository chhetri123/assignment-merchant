import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  MerchantApplication,
  RiskStatus,
} from '../applications/entities/merchant-application.entity';
import { toMinorUnits } from '../common/money';

const HIGH_VOLUME = 100_000_00n;
const ELEVATED_VOLUME = 50_000_00n;

export interface RiskAssessment {
  reference: string;
  score: number;
  status: RiskStatus;
  reason: string;
}

// Stand-in for a third-party risk/KYB provider. Deterministic per application
// so repeated runs and tests agree on the outcome.
@Injectable()
export class RiskProviderService {
  private readonly logger = new Logger(RiskProviderService.name);

  async evaluate(application: MerchantApplication): Promise<RiskAssessment> {
    await this.simulateLatency();

    const score = this.scoreFor(application);
    const { status, reason } = this.classify(score, application);

    this.logger.log(`Risk check for ${application.id}: score=${score} status=${status}`);

    return { reference: `kyb_${randomUUID()}`, score, status, reason };
  }

  // 0-100, derived from the id plus the requested volume.
  private scoreFor(application: MerchantApplication): number {
    const digest = createHash('sha256').update(application.id).digest();
    const base = digest.readUInt16BE(0) % 101;
    const volume = toMinorUnits(application.requestedMonthlyVolume);
    const volumePenalty = volume > HIGH_VOLUME ? 25 : volume > ELEVATED_VOLUME ? 10 : 0;

    return Math.max(0, base - volumePenalty);
  }

  private classify(
    score: number,
    application: MerchantApplication,
  ): { status: RiskStatus; reason: string } {
    if (!application.ownerTaxId) {
      return { status: RiskStatus.MANUAL_REVIEW, reason: 'Tax id missing, KYB incomplete' };
    }
    if (score >= 70) {
      return { status: RiskStatus.PASSED, reason: 'Identity and business records matched' };
    }
    if (score >= 40) {
      return {
        status: RiskStatus.MANUAL_REVIEW,
        reason: 'Partial match, manual verification needed',
      };
    }
    return { status: RiskStatus.FAILED, reason: 'Business records could not be verified' };
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 150));
  }
}
