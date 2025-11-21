import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Woreda } from './woreda.entity';

@Entity()
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => Woreda, (woreda) => woreda.zone, {
    cascade: true,
  })
  woredas: Woreda[];
}
