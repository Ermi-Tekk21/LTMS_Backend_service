import { Event } from "src/event/entities/event.entity";
import { doc_type } from "src/shared/enums/status_enums";
import {
    Column,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    ManyToMany,
    JoinTable,
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

    // 📘 Many-to-One - EventDate
    @ManyToOne(() => EventDate, (eventDate) => eventDate.event_session)
    event_date: Event;

    // 📘 One-to-Many - SessionParticipantMap
    @OneToMany(
        () => SessionParticipantMap,
        (sessionParticipantMap) => sessionParticipantMap.event_session
    )
    session_participant_maps: SessionParticipantMap[];

    // 🔗 Many-to-Many - Trainer
    @ManyToMany(() => Trainer, (trainer) => trainer.event_sessions)
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
