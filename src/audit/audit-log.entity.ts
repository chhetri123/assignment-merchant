import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../users/user.entity';

export enum AuditAction {
  APPLICATION_CREATED = 'APPLICATION_CREATED',
  APPLICATION_UPDATED = 'APPLICATION_UPDATED',
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  REVIEWER_ASSIGNED = 'REVIEWER_ASSIGNED',
  RISK_REVIEW_COMPLETED = 'RISK_REVIEW_COMPLETED',
  REVIEW_DECISION_RECORDED = 'REVIEW_DECISION_RECORDED',
}

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable because worker-driven events have no human actor.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actorRole: UserRole | 'SYSTEM' | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 40 })
  entityType: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
