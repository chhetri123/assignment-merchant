import { PartialType } from '@nestjs/swagger';
import { CreateApplicationDto } from './create-application.dto';

// Same rules as create, every field optional. Only allowed while the
// application is in an editable status.
export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}
