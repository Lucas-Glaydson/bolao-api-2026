// check-nestjs-db.ts
// Checks what MongoDB URI the NestJS context actually connects to
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const cfg = app.get(ConfigService);
  const uri = cfg.get<string>('database.uri') ?? '(not found)';
  console.log('NestJS database.uri prefix:', uri.substring(0, 50));
  console.log('Mongoose connection state:', mongoose.connection.readyState);
  console.log('Mongoose host:', mongoose.connection.host);
  console.log('Mongoose db name:', mongoose.connection.db?.databaseName);
  await app.close();
}
bootstrap().catch(e => { console.error(e.message); process.exit(1); });
