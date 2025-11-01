import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './shared/database/db_connector';
import { AuditLogModule } from './shared/audit_log/audit_log.module';
import { EmailModule } from './common/email/email.module';
import { AwsS3Module } from './common/aws-s3/aws-s3.module';
import { AuthModule } from './common/guards/auth.module';

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
    EventModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
