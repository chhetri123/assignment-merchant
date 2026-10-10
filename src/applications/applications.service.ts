import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditLogResponseDto } from '../audit/dto/audit-log-response.dto';
import { AuditService } from '../audit/audit.service';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { RiskReviewQueue } from '../risk/risk-review.queue';
import { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AbilityFactory, type AppAbility } from '../authorization/ability.factory';
import { readScope } from '../authorization/ability-scope';
import { toApplicationColumns } from './application-columns';
import {
  assertCanDecide,
  assertCanRead,
  assertCanSubmit,
  assertCanUpdate,
} from './application-access';
import { assertEditable, assertTransition } from './application-state.machine';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications.query.dto';
import { ReviewDecision, ReviewDecisionDto } from './dto/review-decision.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import {
  ApplicationStatus,
  MerchantApplication,
  RiskStatus,
} from './entities/merchant-application.entity';

const ASSIGNABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
];

const DECISION_STATUS: Record<ReviewDecision, ApplicationStatus> = {
  [ReviewDecision.APPROVE]: ApplicationStatus.APPROVED,
  [ReviewDecision.REJECT]: ApplicationStatus.REJECTED,
  [ReviewDecision.REQUEST_INFO]: ApplicationStatus.INFO_REQUESTED,
};

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(MerchantApplication)
    private readonly applications: Repository<MerchantApplication>,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly abilityFactory: AbilityFactory,
    private readonly riskQueue: RiskReviewQueue,
    private readonly dataSource: DataSource,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateApplicationDto): Promise<ApplicationResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      const application = repository.create(toApplicationColumns(dto));
      application.createdById = user.id;
      application.status = ApplicationStatus.DRAFT;
      application.riskStatus = RiskStatus.NOT_STARTED;

      const result = await repository.save(application);
      await this.audit.record(
        {
          action: AuditAction.APPLICATION_CREATED,
          entityType: 'MerchantApplication',
          entityId: result.id,
          actor: user,
          metadata: { businessName: result.businessName, status: result.status },
        },
        manager,
      );

      return result;
    });

    return ApplicationResponseDto.fromEntity(saved);
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<ApplicationResponseDto> {
    const { application } = await this.loadForUser(user, id);
    return ApplicationResponseDto.fromEntity(application);
  }

  async findAuditTrail(user: AuthenticatedUser, id: string): Promise<AuditLogResponseDto[]> {
    await this.loadForUser(user, id);
    const logs = await this.audit.findForEntity('MerchantApplication', id);
    return logs.map((log) => AuditLogResponseDto.fromEntity(log));
  }

  async list(
    user: AuthenticatedUser,
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedDto<ApplicationResponseDto>> {
    const ability = this.abilityFactory.createForUser(user);

    // Scoped in SQL, so SALES cannot page through other users' records.
    const where: FindOptionsWhere<MerchantApplication> = {
      ...readScope<MerchantApplication>(ability, MerchantApplication),
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.riskStatus) {
      where.riskStatus = query.riskStatus;
    }
    if (query.assignedReviewerId) {
      where.assignedReviewerId = query.assignedReviewerId;
    }

    const [rows, total] = await this.applications.findAndCount({
      where,
      order: { [query.sortBy]: query.sortOrder },
      skip: query.skip,
      take: query.limit,
    });

    return new PaginatedDto(
      rows.map((row) => ApplicationResponseDto.fromEntity(row)),
      total,
      query.page,
      query.limit,
    );
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const changes = toApplicationColumns(dto);

    const saved = await this.mutateLocked(user, id, async ({ application, ability, manager }) => {
      assertCanUpdate(ability, application);
      assertEditable(application.status);
      manager.getRepository(MerchantApplication).merge(application, changes);

      await this.audit.record(
        {
          action: AuditAction.APPLICATION_UPDATED,
          entityType: 'MerchantApplication',
          entityId: id,
          actor: user,
          metadata: { fields: Object.keys(dto) },
        },
        manager,
      );
    });

    return ApplicationResponseDto.fromEntity(saved);
  }

  async submit(user: AuthenticatedUser, id: string): Promise<ApplicationResponseDto> {
    const saved = await this.mutateLocked(user, id, async ({ application, ability, manager }) => {
      assertCanSubmit(ability, application);
      assertTransition(application.status, ApplicationStatus.SUBMITTED);
      application.status = ApplicationStatus.SUBMITTED;
      application.submittedAt = new Date();
      application.riskStatus = RiskStatus.PENDING;

      await this.audit.record(
        {
          action: AuditAction.APPLICATION_SUBMITTED,
          entityType: 'MerchantApplication',
          entityId: id,
          actor: user,
          metadata: { submittedAt: application.submittedAt },
        },
        manager,
      );
    });

    // Enqueued after commit, so the worker cannot read a row that does not exist yet.
    await this.riskQueue.enqueue(saved);

    return ApplicationResponseDto.fromEntity(saved);
  }

  async assignReviewer(
    user: AuthenticatedUser,
    id: string,
    dto: AssignReviewerDto,
  ): Promise<ApplicationResponseDto> {
    // Looked up before the transaction so no query runs while the row is locked.
    const reviewer = await this.users.findActiveByIdAndRole(dto.reviewerId, UserRole.REVIEWER);
    if (!reviewer) {
      throw new BadRequestException('Reviewer must be an active user with the REVIEWER role');
    }

    const saved = await this.mutateLocked(user, id, async ({ application, manager }) => {
      if (!ASSIGNABLE_STATUSES.includes(application.status)) {
        throw new BadRequestException(
          `Applications in status ${application.status} cannot be assigned`,
        );
      }

      const previousReviewerId = application.assignedReviewerId;
      application.assignedReviewerId = reviewer.id;

      await this.audit.record(
        {
          action: AuditAction.REVIEWER_ASSIGNED,
          entityType: 'MerchantApplication',
          entityId: id,
          actor: user,
          metadata: { reviewerId: reviewer.id, previousReviewerId },
        },
        manager,
      );
    });

    return ApplicationResponseDto.fromEntity(saved);
  }

  async recordDecision(
    user: AuthenticatedUser,
    id: string,
    dto: ReviewDecisionDto,
  ): Promise<ApplicationResponseDto> {
    const nextStatus = DECISION_STATUS[dto.decision];

    if (dto.decision !== ReviewDecision.APPROVE && !dto.reason) {
      throw new BadRequestException('A reason is required when rejecting or requesting info');
    }

    const saved = await this.mutateLocked(user, id, async ({ application, ability, manager }) => {
      assertCanDecide(ability, application);
      assertTransition(application.status, nextStatus);
      application.status = nextStatus;
      application.decisionReason = dto.reason ?? null;
      application.decidedAt = new Date();

      await this.audit.record(
        {
          action: AuditAction.REVIEW_DECISION_RECORDED,
          entityType: 'MerchantApplication',
          entityId: id,
          actor: user,
          metadata: { decision: dto.decision, status: nextStatus, reason: dto.reason ?? null },
        },
        manager,
      );
    });

    return ApplicationResponseDto.fromEntity(saved);
  }

  // Every write goes through here: the row is read once under a lock, and the
  // authorization and state checks run on that locked row, so nothing can
  // change between the check and the write.
  // The lock is held until commit, so `mutate` must not do slow work such as
  // calling another service.
  private async mutateLocked(
    user: AuthenticatedUser,
    id: string,
    mutate: (context: {
      application: MerchantApplication;
      ability: AppAbility;
      manager: EntityManager;
    }) => Promise<void>,
  ): Promise<MerchantApplication> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      const application = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('Application not found');
      }

      const ability = this.abilityFactory.createForUser(user);
      assertCanRead(ability, application);

      await mutate({ application, ability, manager });
      return repository.save(application);
    });
  }

  private async loadForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ application: MerchantApplication; ability: AppAbility }> {
    const application = await this.applications.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const ability = this.abilityFactory.createForUser(user);
    assertCanRead(ability, application);

    return { application, ability };
  }
}
