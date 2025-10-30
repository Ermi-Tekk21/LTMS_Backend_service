import { event_status } from 'src/shared/enums/status_enums';
import {
    Column,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    ManyToMany,
    JoinTable,
} from 'typeorm';
import { Activity } from '../activity/entities/activity.entity';
import { Document } from '../document/entities/document.entity';
import { Participant } from '../participant/entities/participant.entity';
import { Trainer } from '../trainer/entities/trainer.entity';

@Entity('event')
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'timestamp' })
    due_date: Date;

    @Column({ type: 'enum', enum: event_status })
    event_status: event_status;

    // 📘 One-to-Many - Activity
    @OneToMany(() => Activity, (activity) => activity.event)
    activity: Activity[];

    // 📘 One-to-Many - Document
    @OneToMany(() => Document, (document) => document.event)
    document: Document[];

    // 🔗 Many-to-Many - Participant
    @ManyToMany(() => Participant, (participant) => participant.events)
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

    // 🔗 Many-to-Many - Trainer
    @ManyToMany(() => Trainer, (trainer) => trainer.events)
    @JoinTable({
        name: 'event_trainer_map', // Join table name
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
