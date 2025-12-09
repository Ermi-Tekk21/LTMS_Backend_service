import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { doc_type } from "src/common/constants/enums";
import { Activity } from "src/event/activity/entities/activity.entity";
import { Event } from "src/event/entities/event.entity";

@Entity('document')
export class Document {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "text" })
    path: string;

    @Column({ type: "text" })
    file_type: string;

    @Column({ type: 'enum', enum: doc_type  })
    doc_type: doc_type;

    @Column({ default: false })
    is_deleted: boolean;

    @Column({ type: "uuid", nullable: true })
    created_by: string;

    @Column({ type: "uuid", nullable: true })
    updated_by: string;

    @Column({ type: "uuid", nullable: true })
    deleted_by: string | null;

    @CreateDateColumn({ type: "timestamp" })
    created_at: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updated_at: Date;

    @DeleteDateColumn({ type: "timestamp", nullable: true, default: null })
    deleted_at: Date | null;

    // Relation back to Activity
    @ManyToOne(() => Activity, (activity) => activity.documents, { onDelete: 'CASCADE' })
    activity: Activity;

    @ManyToOne(() => Event, (event) => event.documents, { onDelete: 'CASCADE' })
    event: Event;
}
