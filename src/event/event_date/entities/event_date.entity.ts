import { Event } from "src/event/entities/event.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { EventSession } from "src/event/event_session/entities/event_session.entity";

@Entity('event-date')
export class EventDate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "text", nullable: true })
    agenda: string;

    @Column({ type: "date" })
    date: Date;

    @ManyToOne(() => Event, (event) => event.event_dates, {
        onDelete: 'CASCADE'
    })
    event: Event;

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

    @OneToMany(() => EventSession, (eventSession) => eventSession.event_date )
    event_sessions: EventSession[];
}
