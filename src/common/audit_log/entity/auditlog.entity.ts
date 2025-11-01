import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'status_audit_log' })
export class StatusAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  entity_table: string;

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'text' })
  status_field: string;

  @Column({ type: 'text' })
  old_status: string;

  @Column({ type: 'text' })
  new_status: string;

  @Column({ type: 'text' })
  changed_by: string;

  @CreateDateColumn({ type: 'timestamp' })
  changed_at: Date;

  @Column({ type: 'text', nullable: true })
  reason?: string;
}
