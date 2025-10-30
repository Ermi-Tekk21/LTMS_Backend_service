import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    Index,
    ManyToMany,
    OneToMany,
} from 'typeorm';
import { Event } from 'src/event/entities/event.entity';
import { SessionParticipantMap } from './sessionParticipantMap.entity';

@Entity('participant')
export class Participant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    first_name: string;

    @Column({ type: 'varchar' })
    last_name: string;

    @Column({ type: 'varchar', nullable: true })
    gender: string | null;

    @Column({ type: 'varchar', nullable: true })
    phone: string | null;

    @Index({ unique: true })
    @Column({ type: 'varchar' })
    email: string;

    @Column({ type: 'varchar', nullable: true })
    address: string | null;

    @Column({ type: 'varchar' })
    created_by: string;

    @Column({ type: 'varchar', nullable: true })
    updated_by: string | null;

    @Column({ type: 'varchar', nullable: true })
    deleted_by: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
    deleted_at: Date | null;

    // Many-to-Many with Event through a join table
    @ManyToMany(() => Event, (event) => event.participants)
    events: Event[];

    @OneToMany(
        () => SessionParticipantMap,
        (sessionParticipantMap) => sessionParticipantMap.participant
    )
    session_participant_maps: SessionParticipantMap[];
}
