import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsUUID,  } from 'class-validator';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsUUID()
  id: string;

 
}
