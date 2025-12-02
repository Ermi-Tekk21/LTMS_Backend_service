import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
} from 'typeorm';
import { Event } from 'src/event/entities/event.entity';
import { EventSession } from 'src/event/event_session/entities/event_session.entity';

@Entity({ name: 'trainer' })
export class Trainer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  first_name: string;

  @Column({ type: 'text' })
  last_name: string;

  @Column({ type: 'text' })
  phone: string;

  
  @Column({ type: 'text',nullable: true  })
  email: string;

  @Column({ type: 'text' })
  occupation: string;

  @Column({ type: 'text', nullable: true })
  file_key: string;

  @Column({ type: "uuid", nullable: true })
  created_by: string

  @Column({ type: "uuid", nullable: true })
  updated_by: string

  @Column({ type: "uuid", nullable: true })
  deleted_by: string | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @DeleteDateColumn({ type: "timestamp", nullable: true, default: null })
  deleted_at: Date | null;

  @ManyToMany(() => Event, (event) => event.trainers)
  events: Event[];

  @ManyToMany(() => EventSession, (eventSession) => eventSession.trainers)
  event_sessions: EventSession[];
}
