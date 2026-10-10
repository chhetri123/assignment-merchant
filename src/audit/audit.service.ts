import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { redact } from '../common/security/redact';
import { AuditAction, AuditLog } from './audit-log.entity';

export interface AuditEntryInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actor?: AuthenticatedUser;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  // Pass `manager` to write the trail in the caller's transaction.
  async record(entry: AuditEntryInput, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(AuditLog) : this.logs;

    await repository.save(
      repository.create({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorId: entry.actor?.id ?? null,
        actorRole: entry.actor?.role ?? 'SYSTEM',
        metadata: redact(entry.metadata ?? {}) as Record<string, unknown>,
      }),
    );
  }

  findForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.logs.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }
}
