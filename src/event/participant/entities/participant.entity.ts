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

@Entity('participant')
export class Participant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    first_name: string;

    @Column({ type: 'text' , nullable: true})
    last_name: string;

    @Column({ type: 'text' })
    gender: string 

    @Column({ type: 'text',unique:true})
    phone: string 

    @Column({ type: 'text', nullable: true })
    occupation: string | null;

    @Column({ type: 'text', nullable: true })
    organization: string | null;

    @Column({ type: 'text', nullable: true })
    community_type : string | null;

    @Column({type:'text', nullable: true})
    letracy_level:string 

    @Column({ type: 'text'})
    region: string | null;

    @Column({ type: 'text' })
    woreda: string ;

    @Column({ type: 'text' })
    kebele: string ;

    @Column({ type: "uuid", nullable: true })
    created_by: string

    @Column({ type: "uuid", nullable: true })
    updated_by: string |null

    @Column({ type: "uuid", nullable: true })
    deleted_by: string | null;

    @CreateDateColumn({ type: "timestamp" })
    created_at: Date

    @UpdateDateColumn({ type: "timestamp" })
    updated_at: Date;

    @DeleteDateColumn({ type: "timestamp", nullable: true, default: null })
    deleted_at: Date | null;

    @ManyToMany(() => Event, (event) => event.participants)
    events: Event[] | null;

    @OneToMany(
        () => SessionParticipantMap,
        (sessionParticipantMap) => sessionParticipantMap.participant, {
        cascade: true
    }
    )
    session_participant_maps: SessionParticipantMap[] | null;
}
