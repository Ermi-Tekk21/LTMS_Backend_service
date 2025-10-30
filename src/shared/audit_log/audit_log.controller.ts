import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuditLogService } from './audit_log.service';
import { CreateAuditLogDto } from './dto/create-audit_log.dto';
import { UpdateAuditLogDto } from './dto/update-audit_log.dto';

@Controller()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @MessagePattern('createAuditLog')
  create(@Payload() createAuditLogDto: CreateAuditLogDto) {
    return this.auditLogService.create(createAuditLogDto);
  }

  @MessagePattern('findAllAuditLog')
  findAll() {
    return this.auditLogService.findAll();
  }

  @MessagePattern('findOneAuditLog')
  findOne(@Payload() id: number) {
    return this.auditLogService.findOne(id);
  }

  @MessagePattern('updateAuditLog')
  update(@Payload() updateAuditLogDto: UpdateAuditLogDto) {
    return this.auditLogService.update(updateAuditLogDto.id, updateAuditLogDto);
  }

  @MessagePattern('removeAuditLog')
  remove(@Payload() id: number) {
    return this.auditLogService.remove(id);
  }
}
