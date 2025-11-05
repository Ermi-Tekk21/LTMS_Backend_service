import { Controller, Get, Query, Param, Post, Body, Patch, Delete } from '@nestjs/common';
import { TrainerService } from './trainer.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';

@Controller('trainer')
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  @Post()
  create(@Body() dto: CreateTrainerDto) {
    return this.trainerService.create(dto);
  }

  @Get()
  findAll(@Query('page') page: number, @Query('limit') limit: number) {
    return this.trainerService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTrainerDto) {
    const updated_by = 'user-id'; 
    return this.trainerService.update(id, dto, updated_by);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string) {
    const deleted_by = 'user-id'; 
    return this.trainerService.softDelete(id, deleted_by);
  }
}
