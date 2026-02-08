import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { community_type, gender, participant_type } from 'src/common/constants/enums';

export class CreateParticipantDto {
  @IsOptional()
  @IsString()
  external_participant_id?: string;

  @IsString()
  first_name: string;

  @IsString()
  father_name: string;

  @IsEnum(gender)
  gender: gender;

  @IsString()
  Grandfather_name?: string

  @IsString()
  phone: string;

  @IsString()
  age: string;

  @IsString()
  disability: string;

  @IsString()
  occupation: string;

  @IsString()
  organization?: string;

  @IsEnum(community_type)
  community_type: community_type;

  @IsEnum(participant_type)
  participant_type: participant_type;

  @IsString()
  letracy_level: string
 
  @IsUUID()
    clusterId: string;


  @IsString()
  region: string;

  @IsString()
  zone: string;

  @IsString()
  woreda: string;
  @IsString()
  location_code?: string

  // @IsString()
  // location_id?:string

  @IsString()
  kebele: string;
  @IsString()
  created_by: string

  @IsUUID()
  eventId?: string
}
