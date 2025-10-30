import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './common/email/email.module';
import { AwsS3Module } from './common/aws-s3/aws-s3.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    EmailModule,
    AwsS3Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
