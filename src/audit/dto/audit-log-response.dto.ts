import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditLog } from '../audit-log.entity';

export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AuditAction }) action: AuditAction;
  @ApiPropertyOptional() actorId: string | null;
  @ApiPropertyOptional({ example: 'SALES' }) actorRole: string | null;
  @ApiProperty({ example: { status: 'DRAFT' }, description: 'Sensitive keys are redacted on write' })
  metadata: Record<string, unknown>;
  @ApiProperty() createdAt: Date;

  static fromEntity(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      action: log.action,
      actorId: log.actorId,
      actorRole: log.actorRole ?? null,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }
}
