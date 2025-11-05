import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { Participant } from '../../participant/entities/participant.entity';
import { EventSession } from 'src/event/event_session/entities/event_session.entity';

@Entity('session_participant_map')
export class SessionParticipantMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Participant, (participant) => participant.session_participant_maps, {
    onDelete: 'CASCADE',
  })
  participant: Participant;

  @ManyToOne(() => EventSession, (eventSession) => eventSession.session_participant_maps, {
    onDelete: 'CASCADE',
  })
  event_session: EventSession;

  @Column({ type: 'json', nullable: true })
  attendance: Record<string, any>;
}
