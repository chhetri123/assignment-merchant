import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_INFO = 'REQUEST_INFO',
}

export class ReviewDecisionDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @ApiPropertyOptional({ example: 'Volume inconsistent with bank statements' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
