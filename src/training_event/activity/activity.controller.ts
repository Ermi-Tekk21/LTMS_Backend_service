import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @MessagePattern('createActivity')
  create(@Payload() createActivityDto: CreateActivityDto) {
    return this.activityService.create(createActivityDto);
  }

  @MessagePattern('findAllActivity')
  findAll() {
    return this.activityService.findAll();
  }

  @MessagePattern('findOneActivity')
  findOne(@Payload() id: number) {
    return this.activityService.findOne(id);
  }

  @MessagePattern('updateActivity')
  update(@Payload() updateActivityDto: UpdateActivityDto) {
    return this.activityService.update(updateActivityDto.id, updateActivityDto);
  }

  @MessagePattern('removeActivity')
  remove(@Payload() id: number) {
    return this.activityService.remove(id);
  }
}
