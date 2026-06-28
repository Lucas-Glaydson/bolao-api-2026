import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const conn = app['httpAdapter']?.['instance'] || (app as any).httpServer;
  
  // Access mongoose directly
  const mongoose = require('mongoose');
  const preds = mongoose.connection.collection('predictions');
  const users = mongoose.connection.collection('users');

  const total = await preds.countDocuments();
  const autoFilled = await preds.countDocuments({ lockedAt: { $ne: null }, predictedHomeScore: 0, predictedAwayScore: 0 });
  const real = await preds.countDocuments({ lockedAt: null });
  const distinctUsers = await preds.distinct('userId');
  const totalUsers = await users.countDocuments();

  console.log('=== Predictions ===');
  console.log('Total predictions:', total);
  console.log('Auto-filled 0x0 (locked):', autoFilled);
  console.log('Manual predictions (lockedAt null):', real);
  console.log('Distinct users w/ predictions:', distinctUsers.length);
  console.log('Total users in DB:', totalUsers);

  await app.close();
}
bootstrap().catch(err => { console.error(err); process.exit(1); });
