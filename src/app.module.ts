import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './shared/database/db_connector';
import { AuditLogModule } from './shared/audit_log/audit_log.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    EventModule,
    AuditLogModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
