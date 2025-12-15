import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { activity_status_type, progres_status } from 'src/common/constants/enums';

export class CreateActivityDto {
  @IsEnum(activity_status_type)
  activity_status_type: activity_status_type;

  @IsEnum(progres_status)
  activity_status: progres_status;

  @IsOptional()
  @IsObject()
  request?: Record<string, any> | null;
}
