import { Module } from '@nestjs/common';
import { AuditLogModule } from './audit_log/audit_log.module';

@Module({
  controllers: [],
  providers: [],
  imports: [AuditLogModule],
})
export class SharedModule {}
