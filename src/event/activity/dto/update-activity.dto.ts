import { PartialType } from '@nestjs/mapped-types';
import { CreateActivityDto } from './create-activity.dto';
import { IsUUID, } from 'class-validator';

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @IsUUID()
  id: string;
}
