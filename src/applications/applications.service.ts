import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { RiskReviewQueue } from '../risk/risk-review.queue';
import { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AbilityFactory, Action, AppAbility } from '../authorization/ability.factory';
import { readScope } from '../authorization/ability-scope';
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
      const application = manager.getRepository(MerchantApplication).create({
        ...dto,
        requestedMonthlyVolume: dto.requestedMonthlyVolume.toFixed(2),
        averageTicketSize: dto.averageTicketSize.toFixed(2),
        createdById: user.id,
        status: ApplicationStatus.DRAFT,
        riskStatus: RiskStatus.NOT_STARTED,
      });

      const result = await manager.getRepository(MerchantApplication).save(application);
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
    const { application, ability } = await this.loadForUser(user, id);
    assertCanUpdate(ability, application);
    assertEditable(application.status);

    const changes: Record<string, unknown> = { ...dto };
    if (dto.requestedMonthlyVolume !== undefined) {
      changes.requestedMonthlyVolume = dto.requestedMonthlyVolume.toFixed(2);
    }
    if (dto.averageTicketSize !== undefined) {
      changes.averageTicketSize = dto.averageTicketSize.toFixed(2);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      const result = await repository.save(repository.merge(application, changes));

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

      return result;
    });

    return ApplicationResponseDto.fromEntity(saved);
  }

  async submit(user: AuthenticatedUser, id: string): Promise<ApplicationResponseDto> {
    const { application, ability } = await this.loadForUser(user, id);
    assertCanSubmit(ability, application);
    assertTransition(application.status, ApplicationStatus.SUBMITTED);

    const saved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      application.status = ApplicationStatus.SUBMITTED;
      application.submittedAt = new Date();
      application.riskStatus = RiskStatus.PENDING;
      const result = await repository.save(application);

      await this.audit.record(
        {
          action: AuditAction.APPLICATION_SUBMITTED,
          entityType: 'MerchantApplication',
          entityId: id,
          actor: user,
          metadata: { submittedAt: result.submittedAt },
        },
        manager,
      );

      return result;
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
    const { application } = await this.loadForUser(user, id);

    const reviewer = await this.users.findActiveByIdAndRole(dto.reviewerId, UserRole.REVIEWER);
    if (!reviewer) {
      throw new BadRequestException('Reviewer must be an active user with the REVIEWER role');
    }
    if (
      ![ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW].includes(application.status)
    ) {
      throw new BadRequestException(
        `Applications in status ${application.status} cannot be assigned`,
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      const previousReviewerId = application.assignedReviewerId;
      application.assignedReviewerId = reviewer.id;
      const result = await repository.save(application);

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

      return result;
    });

    return ApplicationResponseDto.fromEntity(saved);
  }

  async recordDecision(
    user: AuthenticatedUser,
    id: string,
    dto: ReviewDecisionDto,
  ): Promise<ApplicationResponseDto> {
    const { application, ability } = await this.loadForUser(user, id);
    assertCanDecide(ability, application);

    const nextStatus = DECISION_STATUS[dto.decision];
    assertTransition(application.status, nextStatus);

    if (dto.decision !== ReviewDecision.APPROVE && !dto.reason) {
      throw new BadRequestException('A reason is required when rejecting or requesting info');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MerchantApplication);
      application.status = nextStatus;
      application.decisionReason = dto.reason ?? null;
      application.decidedAt = new Date();
      const result = await repository.save(application);

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

      return result;
    });

    return ApplicationResponseDto.fromEntity(saved);
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
