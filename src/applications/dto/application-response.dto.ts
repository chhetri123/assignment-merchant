import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { maskTail } from '../../common/security/redact';
import {
  ApplicationStatus,
  BusinessType,
  MerchantApplication,
  RiskStatus,
} from '../entities/merchant-application.entity';

export class ApplicationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() businessName: string;
  @ApiProperty() legalBusinessName: string;
  @ApiProperty({ enum: BusinessType }) businessType: BusinessType;
  @ApiProperty() ownerFullName: string;
  @ApiProperty() ownerEmail: string;
  @ApiProperty() ownerPhone: string;

  @ApiPropertyOptional({ example: '*****6789', description: 'Masked; never returned in full' })
  ownerTaxIdMasked: string | null;

  @ApiProperty() addressLine1: string;
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() postalCode: string;
  @ApiProperty() country: string;
  @ApiProperty({ example: 25000.5 }) requestedMonthlyVolume: number;
  @ApiProperty({ example: 45.75 }) averageTicketSize: number;
  @ApiProperty() currency: string;
  @ApiProperty() mcc: string;
  @ApiProperty({ enum: ApplicationStatus }) status: ApplicationStatus;
  @ApiProperty({ enum: RiskStatus }) riskStatus: RiskStatus;
  @ApiPropertyOptional() riskScore: number | null;
  @ApiPropertyOptional() riskReason: string | null;
  @ApiPropertyOptional() riskCheckedAt: Date | null;
  @ApiProperty() createdById: string;
  @ApiPropertyOptional() assignedReviewerId: string | null;
  @ApiPropertyOptional() decisionReason: string | null;
  @ApiPropertyOptional() decidedAt: Date | null;
  @ApiPropertyOptional() submittedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(application: MerchantApplication): ApplicationResponseDto {
    return {
      id: application.id,
      businessName: application.businessName,
      legalBusinessName: application.legalBusinessName,
      businessType: application.businessType,
      ownerFullName: application.ownerFullName,
      ownerEmail: application.ownerEmail,
      ownerPhone: application.ownerPhone,
      ownerTaxIdMasked: maskTail(application.ownerTaxId),
      addressLine1: application.addressLine1,
      city: application.city,
      state: application.state,
      postalCode: application.postalCode,
      country: application.country,
      // numeric columns arrive as strings from the pg driver.
      requestedMonthlyVolume: Number(application.requestedMonthlyVolume),
      averageTicketSize: Number(application.averageTicketSize),
      currency: application.currency,
      mcc: application.mcc,
      status: application.status,
      riskStatus: application.riskStatus,
      riskScore: application.riskScore,
      riskReason: application.riskReason,
      riskCheckedAt: application.riskCheckedAt,
      createdById: application.createdById,
      assignedReviewerId: application.assignedReviewerId,
      decisionReason: application.decisionReason,
      decidedAt: application.decidedAt,
      submittedAt: application.submittedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}
