import { Controller, Get, UseGuards } from '@nestjs/common';
import { EmailService } from './common/notification/email.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly emailService: EmailService) {}

  @Get('test-email')
   @UseGuards(JwtAuthGuard)
  async testEmail() {
    await this.emailService.sendMail(
      'solomontadesse@gmail.com', 
      'NestJS Email Test ',
      'This is a plain text message from NestJS.',
      '<h3>This is an <b>HTML</b> message from NestJS </h3>',
    );

    return { message: 'Test email sent!' };
  }
}
