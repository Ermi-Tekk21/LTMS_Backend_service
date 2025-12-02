import { IsString, IsOptional, IsUUID, IsEmail, IsArray } from 'class-validator';

export class CreateTrainerDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsString()
  occupation:string;

   @IsOptional()
   @IsString()
   file_key: string;

  // Optional relation fields for linking to events or sessions
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  event_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  event_session_ids?: string[];
}
