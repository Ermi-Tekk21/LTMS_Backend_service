import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { TrainerDAL } from './dal/trainer.dal'; 
import { IsNull } from 'typeorm';

@Injectable()
export class TrainerService {
  constructor(private readonly trainerDAL: TrainerDAL) {}

  async create(createTrainerDto: CreateTrainerDto) {
    const trainer = await this.trainerDAL.create({
      ...createTrainerDto,
      created_at: new Date(),
    });
    return trainer;
  }
  async findAll(page = 1, limit = 10) {
    // Only return trainers not soft-deleted
    const result = await this.trainerDAL.findPaginated(
      { where: { deleted_at: IsNull() }, order: { created_at: 'DESC' } },
      page,
      limit,
    );
    return result;
  }
  

  async findOne(id: string) {
    const trainer = await this.trainerDAL.findById(id);
    if (!trainer || trainer.deleted_at) {
      throw new NotFoundException(`Trainer with id ${id} not found`);
    }
    return trainer;
  }

  async update(id: string, dto: UpdateTrainerDto, updated_by: string) {
    const trainer = await this.trainerDAL.findById(id);
    if (!trainer || trainer.deleted_at) {
      throw new NotFoundException(`Trainer with id ${id} not found`);
    }
    await this.trainerDAL.update(id, {
      ...dto,
      updated_by,
      updated_at: new Date(),
    });
    return await this.trainerDAL.findById(id);
  }

  async softDelete(id: string, deleted_by: string) {
    const trainer = await this.trainerDAL.findById(id);
    if (!trainer || trainer.deleted_at) {
      throw new NotFoundException(`Trainer with id ${id} not found`);
    }
    await this.trainerDAL.softDelete(id, 'deleted_at');
    await this.trainerDAL.update(id, { deleted_by, deleted_at: new Date() });
    return { message: 'Trainer soft-deleted successfully', softDeleted: true };
  }
}
