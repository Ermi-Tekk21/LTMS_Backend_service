import {
    Column,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    ManyToMany,
    JoinTable,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from "typeorm";
import { EventDate } from "src/event/event_date/entities/event_date.entity";
import { SessionParticipantMap } from "src/event/participant/entities/sessionParticipantMap.entity";
import { Trainer } from "src/event/trainer/entities/trainer.entity";
import { session_type } from "src/common/constants/enums";

@Entity('event-session')
export class EventSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "text", nullable: true })
    agenda: string;

    @Column({ type: "timestamp", nullable: true })
    starts_at: Date;

    @Column({ type: "timestamp", nullable: true })
    ends_at: Date;

    @Column({ type: 'text', nullable: true })
    venue: string;

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

    @Column({ type: "enum", enum: session_type })
    session_type: session_type | null;

    @UpdateDateColumn({ type: "timestamp" })
    updated_at: Date;

    @DeleteDateColumn({ type: "timestamp", nullable: true, default: null })
    deleted_at: Date | null;

    @ManyToOne(() => EventDate, (eventDate) => eventDate.event_sessions, {
        onDelete: 'CASCADE'
    })
    event_date: EventDate;

    @OneToMany(
        () => SessionParticipantMap,
        (sessionParticipantMap) => sessionParticipantMap.event_session,
        {
            cascade: true
        }
    )
    session_participant_maps: SessionParticipantMap[];

    @ManyToMany(() => Trainer, (trainer) => trainer.event_sessions, {
        cascade: true,
        onDelete: 'CASCADE'
    })
    @JoinTable({
        name: 'event_session_trainer_map',
        joinColumn: {
            name: 'event_session_id',
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: 'trainer_id',
            referencedColumnName: 'id',
        },
    })
    trainers: Trainer[];
}
