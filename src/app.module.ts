import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './common/database/db_connector';
import { AuditLogModule } from './common/audit_log/audit_log.module';
import { EmailModule } from './common/notification/email.module';
import { AwsS3Module } from './common/aws-s3/aws-s3.module';
import { AuthModule } from './common/guards/auth.module';
import { EventDateModule } from './event/event_date/event_date.module';
import { EventSessionModule } from './event/event_session/event_session.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { DashboardReportModule } from './dashboard_report/dashboard_report.module';
// import { ZoneModule } from './event/adress/zone.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    AuditLogModule,
    AuthModule,
    EmailModule,
    AwsS3Module,
    EventModule,
    EventDateModule,
    EventSessionModule,
    DashboardReportModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // <-- GLOBAL GUARD
    },
    {
    provide: APP_GUARD,
    useClass: PermissionGuard,// permission guard
},
  ],
})
export class AppModule {}
