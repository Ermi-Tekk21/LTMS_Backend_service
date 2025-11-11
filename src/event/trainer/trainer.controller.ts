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
  @UseInterceptors(FileInterceptor('file', multerOptions(true, ['pdf','image'], 10)))
  create(
    @Body("data") data:string,
    @UploadedFile() file?: Express.Multer.File, 
  ) 
  {
     const dto: CreateTrainerDto = JSON.parse(data);
    return this.trainerService.create(dto, file);
  }
@Get()
async getAllTrainers(
  @Query('page') page = 1,
  @Query('limit') limit = 10,
  @Query('search') search?: string,
) {
  return this.trainerService.findAll(Number(page), Number(limit), search);
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
