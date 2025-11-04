import {
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateEventSessionDto } from './update-event-session.dto';

export class UpdateEventDateDto {
  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsDateString()
  date?: Date;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateEventSessionDto)
  date_sessions?: UpdateEventSessionDto[];
}
