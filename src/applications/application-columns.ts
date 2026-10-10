import { type DeepPartial } from 'typeorm';
import { type CreateApplicationDto } from './dto/create-application.dto';
import { type UpdateApplicationDto } from './dto/update-application.dto';
import { type MerchantApplication } from './entities/merchant-application.entity';

// Explicit mapping instead of spreading the DTO: the API shape and the column
// shape stay independent, and money is handed to the driver as a decimal string.
export function toApplicationColumns(
  dto: CreateApplicationDto | UpdateApplicationDto,
): DeepPartial<MerchantApplication> {
  const fields: DeepPartial<MerchantApplication> = {};

  if (dto.businessName !== undefined) fields.businessName = dto.businessName;
  if (dto.legalBusinessName !== undefined) fields.legalBusinessName = dto.legalBusinessName;
  if (dto.businessType !== undefined) fields.businessType = dto.businessType;
  if (dto.ownerFullName !== undefined) fields.ownerFullName = dto.ownerFullName;
  if (dto.ownerEmail !== undefined) fields.ownerEmail = dto.ownerEmail;
  if (dto.ownerPhone !== undefined) fields.ownerPhone = dto.ownerPhone;
  if (dto.ownerTaxId !== undefined) fields.ownerTaxId = dto.ownerTaxId;
  if (dto.addressLine1 !== undefined) fields.addressLine1 = dto.addressLine1;
  if (dto.city !== undefined) fields.city = dto.city;
  if (dto.state !== undefined) fields.state = dto.state;
  if (dto.postalCode !== undefined) fields.postalCode = dto.postalCode;
  if (dto.country !== undefined) fields.country = dto.country;
  if (dto.currency !== undefined) fields.currency = dto.currency;
  if (dto.mcc !== undefined) fields.mcc = dto.mcc;
  if (dto.requestedMonthlyVolume !== undefined) {
    fields.requestedMonthlyVolume = dto.requestedMonthlyVolume.toFixed(2);
  }
  if (dto.averageTicketSize !== undefined) {
    fields.averageTicketSize = dto.averageTicketSize.toFixed(2);
  }

  return fields;
}
