import { Controller, Get } from '@nestjs/common';
import { EmailService } from './common/email/email.service';

@Controller()
export class AppController {
  constructor(private readonly emailService: EmailService) {}

  @Get('test-email')
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
