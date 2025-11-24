import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { attendance } from 'src/common/enums/status_enums';

export class UpdateSessionParticipantStatusDto {
  @IsUUID()
  sessionParticipantMapId : string;

  @IsEnum(attendance)
  status: string;
}

export class UpdateDateParticipantStatusDto {
  @IsUUID()
  eventDateId : string;

  @IsUUID()
  participantId : string;

  @IsEnum(attendance)
  status: string;
}

export class UpdateSessionParticipantMapDto {
  @IsOptional()
  sessionParticipantMaps?: UpdateSessionParticipantStatusDto[];
}

export class UpdateDateParticipantMapDto {
  @IsOptional()
  dateParticipantMaps?: UpdateDateParticipantStatusDto[];
}

