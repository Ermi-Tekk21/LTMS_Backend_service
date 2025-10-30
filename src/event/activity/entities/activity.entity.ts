import { Event } from "src/event/entities/event.entity";
import { activity_status_type, progres_status } from "src/shared/enums/status_enums";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('actitity')
export class Activity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: activity_status_type })
    activity_status_type: activity_status_type;

    @Column({ type: 'enum', enum: progres_status })
    activity_status: progres_status;

    @Column({ type: 'json', nullable: true })
    request: Record<string, any>;

    // relationship
    @ManyToOne(() => Event, (event) => event.activity)
    event: Event;
}
