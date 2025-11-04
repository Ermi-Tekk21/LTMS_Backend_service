import { PartialType } from '@nestjs/mapped-types';
import { CreateEventSessionDto } from './create-event-session.dto';

export class UpdateEventSessionDto extends PartialType(CreateEventSessionDto) {

}
