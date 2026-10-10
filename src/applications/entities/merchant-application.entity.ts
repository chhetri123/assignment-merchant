import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { encryptedColumn } from '../../common/security/encryption';
import { User } from '../../users/user.entity';

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  INFO_REQUESTED = 'INFO_REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RiskStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum BusinessType {
  SOLE_PROPRIETORSHIP = 'SOLE_PROPRIETORSHIP',
  PARTNERSHIP = 'PARTNERSHIP',
  LLC = 'LLC',
  CORPORATION = 'CORPORATION',
  NON_PROFIT = 'NON_PROFIT',
}

@Entity('merchant_applications')
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  businessName: string;

  @Column({ type: 'varchar', length: 200 })
  legalBusinessName: string;

  @Column({ type: 'enum', enum: BusinessType })
  businessType: BusinessType;

  @Column({ type: 'varchar', length: 120 })
  ownerFullName: string;

  @Column({ type: 'varchar', length: 255 })
  ownerEmail: string;

  @Column({ type: 'varchar', length: 32 })
  ownerPhone: string;

  // AES-256-GCM at rest, masked on read.
  @Column({ type: 'text', nullable: true, transformer: encryptedColumn })
  ownerTaxId: string | null;

  @Column({ type: 'varchar', length: 160 })
  addressLine1: string;

  @Column({ type: 'varchar', length: 80 })
  city: string;

  @Column({ type: 'varchar', length: 80 })
  state: string;

  @Column({ type: 'varchar', length: 16 })
  postalCode: string;

  @Column({ type: 'char', length: 2 })
  country: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  requestedMonthlyVolume: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  averageTicketSize: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'char', length: 4 })
  mcc: string;

  @Index()
  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  @Index()
  @Column({ type: 'enum', enum: RiskStatus, default: RiskStatus.NOT_STARTED })
  riskStatus: RiskStatus;

  @Column({ type: 'int', nullable: true })
  riskScore: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  riskReference: string | null;

  @Column({ type: 'text', nullable: true })
  riskReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  riskCheckedAt: Date | null;

  @Index()
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assignedReviewerId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedReviewerId' })
  assignedReviewer: User | null;

  @Column({ type: 'text', nullable: true })
  decisionReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  // Bumped on every write; useful for change tracking and conflict debugging.
  @VersionColumn()
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
