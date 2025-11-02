import { Document } from "src/event/document/entities/document.entity";
import { Event } from "src/event/entities/event.entity";
import { activity_status_type, progres_status } from "src/common/enums/status_enums";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('actitity')
export class Activity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: activity_status_type })
    activity_status_type: activity_status_type;

    @Column({ type: 'enum', enum: progres_status })
    activity_status: progres_status;

    @Column({ type: 'json', nullable: true })
    request: Record<string, any> | null;

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

    @ManyToOne(() => Event, (event) => event.activities, {
        onDelete: 'CASCADE'
    })
    event: Event;

    // Document relationship (only for LOGISTICS)
    @OneToMany(() => Document, (document) => document.activity, { cascade: true })
    documents: Document[];
}
