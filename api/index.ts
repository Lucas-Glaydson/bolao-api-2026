import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AppModule } from '../src/app.module';

const server = express();

let isInitialized = false;

async function createApp() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const rawOrigins = configService.get<string[]>('corsOrigins') ?? [];
  app.enableCors({
    origin: rawOrigins.length > 0 ? rawOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mata-Mata Bolão API')
    .setDescription('API para sistema de bolão de futebol mata-mata entre amigos')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Autenticação')
    .addTag('users', 'Gerenciamento de usuários')
    .addTag('matches', 'Gerenciamento de partidas')
    .addTag('predictions', 'Palpites dos usuários')
    .addTag('ranking', 'Ranking e pontuação')
    .addTag('stages', 'Controle de fases')
    .addTag('stats', 'Estatísticas e dashboard')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  isInitialized = true;
}

export default async function handler(req: express.Request, res: express.Response) {
  if (!isInitialized) {
    await createApp();
  }
  server(req, res);
}
