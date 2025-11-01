import { doc_type } from "src/common/enums/status_enums";
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
import { EventDate } from "./EventDate.entity";
import { SessionParticipantMap } from "src/event/participant/entities/sessionParticipantMap.entity";
import { Trainer } from "src/event/trainer/entities/trainer.entity";

@Entity('event-session')
export class EventSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "text" })
    agenda: string;

    @Column({ type: "date" })
    starts_at: Date;

    @Column({ type: "date" })
    ends_at: Date;

    @Column({ type: 'enum', enum: doc_type })
    doc_type: doc_type;

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
