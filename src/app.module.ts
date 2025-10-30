import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TrainingEventModule } from './training_event/training_event.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [TrainingEventModule, SharedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
