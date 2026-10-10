import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Action } from '../authorization/ability.factory';
import { CheckAbility } from '../authorization/decorators/check-ability.decorator';
import { AuditLog } from '../audit/audit-log.entity';
import { AuditLogResponseDto } from '../audit/dto/audit-log-response.dto';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { ApplicationsService } from './applications.service';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications.query.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { MerchantApplication } from './entities/merchant-application.entity';

@ApiTags('applications')
@ApiBearerAuth('bearer')
@Controller({ path: 'applications', version: '1' })
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @CheckAbility({ action: Action.Create, subject: MerchantApplication })
  @ApiOperation({ summary: 'Create a merchant application in DRAFT' })
  @ApiCreatedResponse({ type: ApplicationResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applications.create(user, dto);
  }

  @Get()
  @CheckAbility({ action: Action.Read, subject: MerchantApplication })
  @ApiOperation({ summary: 'List applications; SALES users only see their own' })
  @ApiOkResponse({ type: PaginatedDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<PaginatedDto<ApplicationResponseDto>> {
    return this.applications.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single application' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown id, or not visible to the caller' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return this.applications.findOne(user, id);
  }

  @Get(':id/audit')
  @CheckAbility({ action: Action.Read, subject: AuditLog })
  @ApiOperation({ summary: 'Audit trail of an application (ADMIN and REVIEWER)' })
  @ApiOkResponse({ type: AuditLogResponseDto, isArray: true })
  auditTrail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditLogResponseDto[]> {
    return this.applications.findAuditTrail(user, id);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: MerchantApplication })
  @ApiOperation({ summary: 'Update an application while it is still editable' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiForbiddenResponse({ description: 'Not the owner of the application' })
  @ApiConflictResponse({ description: 'Application is no longer editable' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applications.update(user, id, dto);
  }

  @Post(':id/submit')
  @CheckAbility({ action: Action.Submit, subject: MerchantApplication })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an application for risk review' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiConflictResponse({ description: 'Invalid status transition' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return this.applications.submit(user, id);
  }

  @Post(':id/assign')
  @CheckAbility({ action: Action.Assign, subject: MerchantApplication })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a reviewer (ADMIN only)' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignReviewerDto,
  ): Promise<ApplicationResponseDto> {
    return this.applications.assignReviewer(user, id, dto);
  }

  // Reviewers only, narrowed to the assigned one by the record check.
  @Post(':id/decision')
  @CheckAbility({ action: Action.Decide, subject: MerchantApplication })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a risk decision; assigned reviewer only' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiForbiddenResponse({ description: 'Caller is not the assigned reviewer' })
  @ApiConflictResponse({ description: 'Application is not awaiting a decision' })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ): Promise<ApplicationResponseDto> {
    return this.applications.recordDecision(user, id, dto);
  }
}
