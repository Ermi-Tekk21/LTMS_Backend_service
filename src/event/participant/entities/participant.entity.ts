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

    @Column({ type: 'text' })
    first_name: string;

    @Column({ type: 'text' })
    last_name: string;

    @Column({ type: 'text', nullable: true })
    gender: string | null;

    @Column({ type: 'text', nullable: true })
    phone: string | null;

    @Index({ unique: true })
    @Column({ type: 'text' })
    email: string;

    @Column({ type: 'text', nullable: true })
    address: string | null;

    @Column({ default: false })
    is_deleted: boolean

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

    @ManyToMany(() => Event, (event) => event.participants)
    events: Event[];

    @OneToMany(
        () => SessionParticipantMap,
        (sessionParticipantMap) => sessionParticipantMap.participant, {
        cascade: true
    }
    )
    session_participant_maps: SessionParticipantMap[];
}
