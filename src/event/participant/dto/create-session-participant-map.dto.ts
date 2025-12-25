import {  IsUUID, IsObject } from 'class-validator';

export class CreateSessionParticipantMapDto {
  @IsUUID()
  participant_id: string;

  @IsUUID()
  event_session_id: string;

  @IsObject()
  attendance: Record<string, any>;
}
