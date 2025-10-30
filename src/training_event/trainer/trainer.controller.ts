import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TrainerService } from './trainer.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';

@Controller()
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  @MessagePattern('createTrainer')
  create(@Payload() createTrainerDto: CreateTrainerDto) {
    return this.trainerService.create(createTrainerDto);
  }

  @MessagePattern('findAllTrainer')
  findAll() {
    return this.trainerService.findAll();
  }

  @MessagePattern('findOneTrainer')
  findOne(@Payload() id: number) {
    return this.trainerService.findOne(id);
  }

  @MessagePattern('updateTrainer')
  update(@Payload() updateTrainerDto: UpdateTrainerDto) {
    return this.trainerService.update(updateTrainerDto.id, updateTrainerDto);
  }

  @MessagePattern('removeTrainer')
  remove(@Payload() id: number) {
    return this.trainerService.remove(id);
  }
}
