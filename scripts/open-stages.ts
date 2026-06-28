import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StageControlRepository } from '../src/infrastructure/database/repositories';
import { MatchStage } from '../src/domain/entities';

const OPEN_STAGES = [MatchStage.GROUP_STAGE, MatchStage.ROUND_OF_32];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const repo = app.get(StageControlRepository);
  const now = new Date();

  console.log('Opening stages...');
  for (const stage of OPEN_STAGES) {
    let sc = await repo.findByStage(stage);
    if (!sc) {
      sc = await repo.create({ stage, isOpen: false, openedAt: null, closedAt: null, allowPredictions: false, displayOrder: 99 });
    }
    await repo.update(sc.id, { isOpen: true, allowPredictions: true, openedAt: now });
    console.log('  Opened:', stage);
  }

  console.log('\nAll stages:');
  const all = await repo.findAll();
  all.forEach(s =>
    console.log(` ${s.stage.padEnd(20)} | open: ${s.isOpen} | allowPredictions: ${s.allowPredictions}`)
  );

  await app.close();
}

bootstrap().catch(err => { console.error(err); process.exit(1); });
