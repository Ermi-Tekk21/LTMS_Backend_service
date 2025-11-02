import { IsEmail, IsString } from 'class-validator';

export class CreateParticipantDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  gender: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  address: string;

}
