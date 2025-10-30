import { Event } from "src/event/entities/event.entity";
import { doc_type } from "src/shared/enums/status_enums";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('document')
export class Document {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: "text" })
    path: string;

    @Column({ type: "text" })
    file_type: string;

    @Column({ type: 'enum', enum: doc_type })
    doc_type: doc_type;

    // relationship
    @ManyToOne(() => Event, (event) => event.document)
    event: Event;
}
