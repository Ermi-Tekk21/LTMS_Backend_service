import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToMany,
    OneToMany,
} from 'typeorm';
import { Event } from 'src/event/entities/event.entity';
    import { SessionParticipantMap } from './sessionParticipantMap.entity';
import { community_type } from 'src/common/enums/status_enums';

@Entity('participant')
export class Participant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    first_name: string;

    @Column({ type: 'text', nullable: true })
    father_name: string;

    @Column({ type: 'text', nullable: true })
    Grandfather_name: string;

    @Column({ type: 'text' })
    age: string;

    @Column({ type: 'text' })
    gender: string;

    @Column({ type: 'text', nullable: true })
    disability: string;

    @Column({ type: 'text', unique: true })
    phone: string;

    @Column({ type: 'text', nullable: true })
    occupation: string | null;

    @Column({ type: 'text', nullable: true })
    organization: string | null;

    @Column({
        type: 'enum',
        enum: community_type,
        nullable: true,
    })
    community_type: community_type | null;

    @Column({ type: 'text', nullable: true })
    letracy_level: string | null;

    
    // ADD THESE NEW LOCATION FIELDS
    // -----------------------------

    @Column({ type: 'int', nullable: true })
    location_id: number | null;

    @Column({ type: 'text', nullable: true })
    location_code: string | null;

    // ---------------------------------

    @Column({ type: 'text' })
    region: string;

    @Column({ type: 'text' })
    zone: string;

    @Column({ type: 'text' })
    woreda: string;

    @Column({ type: 'text' })
    kebele: string;

    @Column({ type: 'uuid', nullable: true })
    created_by: string;

    @Column({ type: 'uuid', nullable: true })
    updated_by: string | null;

    @Column({ type: 'uuid', nullable: true })
    deleted_by: string | null;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, default: null })
    deleted_at: Date | null;

    @ManyToMany(() => Event, (event) => event.participants, {
        onDelete: 'CASCADE',
    })
    events: Event[] | null;

    @OneToMany(
        () => SessionParticipantMap,
        (sessionParticipantMap) => sessionParticipantMap.participant,
        { cascade: true }
    )
    session_participant_maps: SessionParticipantMap[] | null;
}
