import {  IsString, IsUUID,IsEnum } from 'class-validator';
import { community_type } from 'src/common/enums/status_enums';

export class CreateParticipantDto {
  @IsString()
  first_name: string;

  @IsString()
  father_name: string;

  @IsString()
  gender: string;
 
  @IsString()
  Grandfather_name?:string

  @IsString()
  phone: string;

  @IsString()
  age: string;

  @IsString()
disability:string;

  @IsString()
  occupation: string;

  @IsString()
  organization?: string;

 @IsEnum(community_type)
community_type: community_type;


  @IsString()
  letracy_level:string 


   @IsString()
  region: string;

 @IsString()
  zone: string;

  @IsString()
  woreda: string;
 @IsString()
  location_code?:string

  // @IsString()
  // location_id?:string

  @IsString()
  kebele: string;
  @IsString()
   created_by:string

  @IsUUID()
  eventId?: string 
}
