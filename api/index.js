/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const express = require('express');

const server = express();
let isInitialized = false;

async function createApp() {
  // Importa do dist/ compilado com tsc (emitDecoratorMetadata habilitado)
  const { NestFactory } = require('@nestjs/core');
  const { ExpressAdapter } = require('@nestjs/platform-express');
  const { ValidationPipe } = require('@nestjs/common');
  const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
  const { AppModule } = require('../dist/src/app.module');

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });

  const configService = app.get(
    require('@nestjs/config').ConfigService,
  );

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const rawOrigins = configService.get('corsOrigins') ?? [];
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

module.exports = async function handler(req, res) {
  if (!isInitialized) {
    await createApp();
  }
  server(req, res);
};
