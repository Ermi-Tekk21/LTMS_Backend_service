import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Zone } from './zone.entity';

@Entity()
export class Region {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => Zone, zone => zone.region)
  zones: Zone[];
}
