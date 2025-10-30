import { Event } from "src/event/entities/event.entity";
import { doc_type } from "src/shared/enums/status_enums";
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { EventSession } from "./EventSession.entity";

@Entity('event-date')
export class EventDate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "text" })
    agenda: string;

    @Column({ type: "date" })
    date: Date;

    @Column({ type: 'enum', enum: doc_type })
    doc_type: doc_type;

    // relationship
    @ManyToOne(() => Event, (event) => event.document)
    event: Event;

    @OneToMany(() => EventSession, (eventSession) => eventSession)
    event_session: EventSession[];
}
