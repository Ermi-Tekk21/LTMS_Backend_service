import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { CapitalizeInterceptor } from './common/database/capitalize-response.interceptor';
import { ClassSerializerInterceptor } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Serializer
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Global Capitalize Interceptor
  app.useGlobalInterceptors(new CapitalizeInterceptor());

  app.enableCors({
    origin: ['http://localhost:3000','http://164.160.187.141:8092', 'http://13.50.253.205:8092'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  const port = process.env.PORT || 4499;
  await app.listen(port);

  console.log(`🚀 HTTP Server running on port ${port}`);
}
bootstrap();
