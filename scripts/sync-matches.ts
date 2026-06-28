import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SyncMatchesUseCase } from '../src/application/use-cases/match/sync-matches.use-case';
import { MatchRepository } from '../src/infrastructure/database/repositories';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });

  const syncUseCase = app.get(SyncMatchesUseCase);
  const matchRepository = app.get(MatchRepository);

  console.log('\n=== SYNC MATCHES FROM EXTERNAL API ===\n');

  // Count before
  const beforeCount = (await matchRepository.findAll()).length;
  console.log(`Matches in DB before sync: ${beforeCount}`);

  // Run sync
  const result = await syncUseCase.execute();

  // Count after
  const afterCount = (await matchRepository.findAll()).length;
  console.log(`\nMatches in DB after sync: ${afterCount}`);
  console.log(`Synced: ${result.synced}, Errors: ${result.errors}`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
