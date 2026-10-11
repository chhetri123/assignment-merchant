import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { DECIMAL_PATTERN } from '../../common/money';
import { IsPositiveAmount } from '../../common/validators/is-positive-amount.validator';
import { BusinessType } from '../entities/merchant-application.entity';

export class CreateApplicationDto {
  @ApiProperty({ example: 'Himalaya Coffee' })
  @IsString()
  @MaxLength(160)
  businessName: string;

  @ApiProperty({ example: 'Himalaya Coffee Pvt Ltd' })
  @IsString()
  @MaxLength(200)
  legalBusinessName: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType: BusinessType;

  @ApiProperty({ example: 'Pemba Sherpa' })
  @IsString()
  @MaxLength(120)
  ownerFullName: string;

  @ApiProperty({ example: 'owner@himalayacoffee.test' })
  @IsEmail()
  @MaxLength(255)
  ownerEmail: string;

  @ApiProperty({ example: '+9779800000000' })
  @IsPhoneNumber()
  ownerPhone: string;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'Tax id / EIN. Encrypted at rest and returned masked.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9-]{9,20}$/, { message: 'ownerTaxId must contain 9-20 digits or dashes' })
  ownerTaxId?: string;

  @ApiProperty({ example: 'Thamel Marg 24' })
  @IsString()
  @MaxLength(160)
  addressLine1: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsString()
  @MaxLength(80)
  city: string;

  @ApiProperty({ example: 'Bagmati' })
  @IsString()
  @MaxLength(80)
  state: string;

  @ApiProperty({ example: '44600' })
  @IsString()
  @MaxLength(16)
  postalCode: string;

  @ApiProperty({ example: 'NP', description: 'ISO 3166-1 alpha-2' })
  @IsISO31661Alpha2()
  country: string;

  @ApiProperty({
    example: '25000.50',
    description: 'Expected monthly card volume, decimal string with up to 2 places',
  })
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'requestedMonthlyVolume must be a positive decimal amount' })
  @IsPositiveAmount()
  requestedMonthlyVolume: string;

  @ApiProperty({ example: '45.75', description: 'Decimal string with up to 2 places' })
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'averageTicketSize must be a positive decimal amount' })
  @IsPositiveAmount()
  averageTicketSize: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be an ISO 4217 code' })
  currency: string;

  @ApiProperty({ example: '5812', description: 'Merchant category code' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'mcc must be 4 digits' })
  mcc: string;
}
