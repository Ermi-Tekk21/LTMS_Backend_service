import { event_status } from 'src/common/enums/status_enums';
import {
    Column,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    ManyToMany,
    JoinTable,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';
import { Activity } from '../activity/entities/activity.entity';
import { Document } from 'src/document/entities/document.entity';
import { Participant } from '../participant/entities/participant.entity';
import { Trainer } from '../trainer/entities/trainer.entity';
import { EventDate } from '../event_date/entities/event_date.entity';

@Entity('event')
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    project_id: string;

    @Column({ type: 'text' })
    type: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', nullable: true })
    location_id: string;

    @Column({ type: 'text', nullable: true })
    venue: string;

    @Column({ nullable: true })
    expected_participant_number: number;

    @Column({ type: 'timestamp', nullable: true })
    due_date: Date;

    @Column({ type: 'enum', enum: event_status, default: event_status.INITATED })
    event_status: event_status;

    @OneToMany(() => Activity, (activity) => activity.event, {
        cascade: true,
        nullable: true,
    })
    activities: Activity[];

    @OneToMany(() => Document, (document) => document.event, {
        cascade: true,
        nullable: true
    })
    documents: Document[];

    @OneToMany(() => EventDate, (eventDate) => eventDate.event)
    event_dates: EventDate[];

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

    @ManyToMany(() => Participant, (participant) => participant.events, {
        cascade: true,
        
        nullable: true
    })
    @JoinTable({
        name: 'event_participant_map',
        joinColumn: {
            name: 'event_id',
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: 'participant_id',
            referencedColumnName: 'id',
        },
    })
    participants: Participant[];

    @ManyToMany(() => Trainer, (trainer) => trainer.events, {
        cascade: true,
        onDelete: 'CASCADE',
        nullable: true,
    })
    @JoinTable({
        name: 'event_trainer_map',
        joinColumn: {
            name: 'event_id',
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: 'trainer_id',
            referencedColumnName: 'id',
        },
    })
    trainers: Trainer[];
}
