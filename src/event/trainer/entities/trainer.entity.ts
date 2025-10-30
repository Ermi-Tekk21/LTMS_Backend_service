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
import { EventSession } from 'src/event/schedule/entities/EventSession.entity';

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

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text', nullable: true })
  created_by: string;

  @Column({ type: 'text', nullable: true })
  updated_by: string;

  @Column({ type: 'text', nullable: true })
  deleted_by: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  // 🔗 Many-to-Many - Event
  @ManyToMany(() => Event, (event) => event.trainers)
  events: Event[];

  // 🔗 Many-to-Many - EventSession (inverse side, no JoinTable)
  @ManyToMany(() => EventSession, (eventSession) => eventSession.trainers)
  event_sessions: EventSession[];
}
