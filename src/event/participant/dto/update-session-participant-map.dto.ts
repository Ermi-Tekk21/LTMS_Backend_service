import { PartialType } from '@nestjs/mapped-types';
import { CreateSessionParticipantMapDto } from './create-session-participant-map.dto';

export class UpdateSessionParticipantMapDto extends PartialType(CreateSessionParticipantMapDto) {

}
