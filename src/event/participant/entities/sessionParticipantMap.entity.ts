import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Participant } from '../../participant/entities/participant.entity';
import { EventSession } from 'src/event/schedule/entities/EventSession.entity';

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
