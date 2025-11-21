import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Zone } from './zone.entity';

@Entity()
export class Woreda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Zone, (zone) => zone.woredas, {
    onDelete: 'CASCADE',
  })
  zone: Zone;
}
