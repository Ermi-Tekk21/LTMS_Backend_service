import { Controller, Get, UseGuards } from '@nestjs/common';
import { EmailService } from './common/notification/email.service';
// import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
 import { Permission } from './common/decorators/permission.decorator';
//  import { PermissionGuard } from './common/guards/permission.guard';
import { AppService } from './app.service';
import { CurrentUser } from './common/decorators/current-user.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly emailService: EmailService,
    private readonly appService: AppService,
  ) {}

  @Get('test-email')
  // @UseGuards(JwtAuthGuard,PermissionGuard )
   @Permission('read', 'farmers')
  async testEmail(@CurrentUser() user: any) {
    console.log(' Current User:', user);

    await this.emailService.sendMail(
      'solomontadesse@gmail.com',
      'NestJS Email Test',
      'This is a plain text message from NestJS.',
      '<h3>This is an <b>HTML</b> message from NestJS</h3>',
    );

    return { message: 'Test email sent!', currentUser: user };
  }

  @Get()
  async test() {
    return this.appService.getHello();
  }
}
