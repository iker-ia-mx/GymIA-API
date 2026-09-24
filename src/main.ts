import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

const DEFAULT_DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const configuredOrigins = configService.get<string>('CORS_ORIGIN');
  const allowedOrigins = configuredOrigins
    ? configuredOrigins.split(',').map((origin) => origin.trim())
    : DEFAULT_DEV_ORIGINS;
  app.enableCors({ origin: allowedOrigins });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
