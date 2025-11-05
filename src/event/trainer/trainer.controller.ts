import { Controller, Get, Query, Param, Post, Body, Patch, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { TrainerService } from './trainer.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { multerOptions } from 'src/common/fileHandler/MulterOption';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('trainer')
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}
  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions(false, ['pdf'], 10)))
  create(
    @Body() dto: CreateTrainerDto,
    @UploadedFile() file?: Express.Multer.File, 
  ) {
    return this.trainerService.create(dto, file);
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
  @UseInterceptors(FileInterceptor('file', multerOptions(false, ['pdf'], 10)))
  update(@Param('id') id: string, @Body()
   dto: UpdateTrainerDto,@CurrentUser('userId') 
  userId: string, @UploadedFile() file?: Express.Multer.File,) 
  {
    return this.trainerService.update(id, dto, userId,file);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string,@CurrentUser('userId') userId: string) 
  {
    return this.trainerService.softDelete(id, userId);
  }
}
