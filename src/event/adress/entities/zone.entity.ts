import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Region } from './region.entity';
import { Woreda } from './woreda.entity';

@Entity()
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @ManyToOne(() => Region, region => region.zones, { onDelete: 'CASCADE' })
  region: Region;

  @OneToMany(() => Woreda, woreda => woreda.zone)
  woredas: Woreda[];
}
