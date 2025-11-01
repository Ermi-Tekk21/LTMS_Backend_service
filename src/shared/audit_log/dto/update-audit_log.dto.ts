import { PartialType } from '@nestjs/mapped-types';
import { CreateActivityDto } from './create-audit_log.dto';

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}
