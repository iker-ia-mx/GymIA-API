import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

const DEFAULT_DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás del proxy del hosting (Render/Railway/Fly) todas las peticiones
  // llegan desde la IP del proxy: sin `trust proxy`, el rate limit por IP
  // (ThrottlerGuard) trataría a todos los usuarios como uno solo.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true',
    );
  }
  // Cierra Prisma y las conexiones abiertas en cada deploy (SIGTERM).
  app.enableShutdownHooks();

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
