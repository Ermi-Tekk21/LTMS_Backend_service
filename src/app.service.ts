import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): 
  string {
    return 'Hello World! how have you been?';
  }
}
