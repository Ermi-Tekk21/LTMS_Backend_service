import {  IsString } from 'class-validator';
import { UUID } from 'typeorm/driver/mongodb/bson.typings.js';

export class CreateParticipantDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  gender: string;

  @IsString()
  phone: string;

  // @IsString()
  // age: string;

  @IsString()
  occupation: string;

  @IsString()
  organization?: string;

  @IsString()
  community_type: string;

  @IsString()
  letracy_level:string 


   @IsString()
  region: string;

  @IsString()
  woreda: string;

  @IsString()
  kebele: string;
  @IsString()
   created_by:string

  eventId?: string 
}
